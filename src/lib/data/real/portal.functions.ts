import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Contrato, Fornecedor, Orgao } from "../types";
import { ORGAOS_BASE } from "../catalog";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sanitizarTextoPublico } from "@/lib/sanitize";
import { FONTES_LIMPEZA, FONTE_IDS } from "@/lib/data/limpeza";
import { regrasCgu, flagQA, type CguContratoLike, type QaFinding } from "@/lib/data/qa";
import {
  parseValorPortal,
  portalGet,
  valorPortalSuspeito,
  corrigirComDetalhe,
} from "@/lib/data/real/portal-client";

// Re-export para compatibilidade (testes e código legado importam daqui).
export { parseValorPortal };
export const valorCguListagemPrecisaDetalhe = (vi: number, vf: number) =>
  valorPortalSuspeito(vf > 0 ? vf : vi);

type PortalContrato = {
  id?: number | string;
  numero?: string;
  objeto?: string;
  dataAssinatura?: string;
  // O endpoint JSON da CGU devolve moeda como número decimal com ponto
  // e 4 casas (ex.: 117560.3000 = R$ 117.560,30). Também aceitamos
  // strings em pt-BR quando algum endpoint/documento vier formatado.
  valorInicialCompra?: number | string;
  valorFinalCompra?: number | string;
  modalidadeCompra?: string;
  fornecedor?: {
    cnpjFormatado?: string | null;
    cpfFormatado?: string | null;
    numeroDeInscricao?: string;
    nome?: string;
    razaoSocial?: string;
  };
};

export function normalizarValoresCguListagem(rawInicial: unknown, rawFinal: unknown) {
  return {
    valorInicial: parseValorPortal(rawInicial),
    valorFinal: parseValorPortal(rawFinal),
  };
}

async function normalizarValoresCguComDetalheQuandoSuspeito(
  id: string,
  rawInicial: unknown,
  rawFinal: unknown,
): Promise<{ valorInicial: number; valorFinal: number; corrigidoPorDetalhe: boolean; valorInicialAntes?: number; valorFinalAntes?: number }> {
  const lista = normalizarValoresCguListagem(rawInicial, rawFinal);
  const r = await corrigirComDetalhe({
    id,
    endpointDetalhe: "/contratos/id",
    valoresLista: { valorInicial: lista.valorInicial, valorFinal: lista.valorFinal },
    extrairDoDetalhe: (det) => {
      const d = det as PortalContrato;
      return {
        valorInicial: parseValorPortal(d.valorInicialCompra),
        valorFinal: parseValorPortal(d.valorFinalCompra),
      };
    },
  });
  if (!r.ok) return { ...lista, corrigidoPorDetalhe: false };
  return {
    valorInicial: r.valores.valorInicial,
    valorFinal: r.valores.valorFinal,
    corrigidoPorDetalhe: r.corrigido,
    valorInicialAntes: r.valoresOriginais?.valorInicial,
    valorFinalAntes: r.valoresOriginais?.valorFinal,
  };
}

function parseDate(br: string | undefined): string {
  if (!br) return "";
  // A API às vezes retorna ISO (YYYY-MM-DD) e às vezes BR (DD/MM/YYYY).
  const iso = br.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const [d, m, y] = br.split("/");
  if (!d || !m || !y) return "";
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function normalizeModalidade(s: string | undefined): Contrato["modalidade"] {
  const x = (s ?? "").toLowerCase();
  if (x.includes("dispensa")) return "dispensa";
  if (x.includes("inexigi")) return "inexigibilidade";
  if (x.includes("concorr")) return "concorrencia";
  return "pregao";
}

function isoToBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

async function ensureAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error("Falha ao verificar permissão.");
  if (data?.role !== "admin") throw new Error("Acesso restrito: somente administradores.");
}

export const fetchPortalOrgao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        codigoOrgao: z.string().regex(/^\d{4,6}$/),
        // Datas ISO (YYYY-MM-DD)
        dataInicial: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        dataFinal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        maxPaginas: z.number().int().min(1).max(2000).default(2000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);

    const base = ORGAOS_BASE.find((o) => o.cod === data.codigoOrgao);
    if (!base) throw new Error(`Órgão ${data.codigoOrgao} não catalogado.`);
    if (!base.disponivelPortal) throw new Error(`${base.sigla} não é coberto pelo Portal. ${base.nota ?? ""}`);

    const contratosRaw: PortalContrato[] = [];
    const erros: string[] = [];

    for (let pagina = 1; pagina <= data.maxPaginas; pagina++) {
      try {
        const list = (await portalGet("/contratos", {
          codigoOrgao: data.codigoOrgao,
          dataInicial: isoToBR(data.dataInicial),
          dataFinal: isoToBR(data.dataFinal),
          pagina: String(pagina),
        })) as PortalContrato[];
        if (!Array.isArray(list) || list.length === 0) break;
        contratosRaw.push(...list);
        // Não inferir fim pelo tamanho da página — só parar quando vier vazia.
      } catch (e) {
        erros.push(`p${pagina}: ${(e as Error).message}`);
        break;
      }
    }

    const fornecedoresMap = new Map<string, Fornecedor>();
    const contratos: Contrato[] = [];
    const valorInicialPorId = new Map<string, number>();
    const descartes = new Map<string, number>();
    const correcoesDetalhe: string[] = [];
    const findingsAutoCorrecao: QaFinding[] = [];
    const addDescarte = (motivo: string) => {
      descartes.set(motivo, (descartes.get(motivo) ?? 0) + 1);
    };

    // A listagem da CGU às vezes retorna valores baixos truncados (ex.: 9.0000)
    // enquanto /contratos/id traz o valor real (ex.: 90000.0000). O parser
    // continua decimal puro; só valores suspeitos são conferidos no detalhe.
    for (const raw of contratosRaw) {
      const cnpj =
        raw.fornecedor?.cnpjFormatado ??
        raw.fornecedor?.cpfFormatado ??
        raw.fornecedor?.numeroDeInscricao ??
        "";
      if (!cnpj) {
        addDescarte("fornecedor sem CNPJ/CPF (sigiloso ou ausente)");
        continue;
      }
      const nome = raw.fornecedor?.nome ?? raw.fornecedor?.razaoSocial ?? cnpj;
      if (!fornecedoresMap.has(cnpj)) fornecedoresMap.set(cnpj, { cnpj, nome });

      const dataAssinatura = parseDate(raw.dataAssinatura);
      const ano = dataAssinatura ? Number(dataAssinatura.slice(0, 4)) : Number(data.dataInicial.slice(0, 4));
      const id = String(raw.id ?? `${data.codigoOrgao}-${raw.numero ?? Math.random().toString(36).slice(2)}`);
      const { valorInicial, valorFinal, corrigidoPorDetalhe, valorInicialAntes, valorFinalAntes } = await normalizarValoresCguComDetalheQuandoSuspeito(
        id,
        raw.valorInicialCompra,
        raw.valorFinalCompra,
      );
      if (corrigidoPorDetalhe) {
        correcoesDetalhe.push(id);
        findingsAutoCorrecao.push({
          fonte: "cgu",
          entidade_tipo: "contrato",
          entidade_id: id,
          regra: "valor_corrigido_via_detalhe",
          severidade: "aviso",
          origem: "auto_correcao",
          status: "corrigido_origem",
          valor_armazenado: valorFinalAntes ?? valorInicialAntes ?? 0,
          valor_esperado: valorFinal > 0 ? valorFinal : valorInicial,
          detalhes: {
            antes: { valor_inicial: valorInicialAntes, valor_final: valorFinalAntes },
            depois: { valor_inicial: valorInicial, valor_final: valorFinal },
            endpoint_detalhe: "/contratos/id",
            orgao_cod: data.codigoOrgao,
          },
        });
      }
      if (valorInicial > 0) valorInicialPorId.set(id, valorInicial);
      const valor = valorFinal > 0 ? valorFinal : valorInicial;

      contratos.push({
        id,
        orgaoCod: data.codigoOrgao,
        fornecedorCnpj: cnpj,
        // Sanitização na ingestão (Fase 3): PII em campo livre é mascarada
        // ANTES de persistir no cache, não só na exibição.
        objeto: sanitizarTextoPublico((raw.objeto ?? "").slice(0, 240)) || "(sem descrição)",
        modalidade: normalizeModalidade(raw.modalidadeCompra),
        valor,
        ano,
        dataAssinatura,
      });
    }

    // Persistir no banco (upsert)
    await supabaseAdmin.from("orgaos_cache").upsert({
      cod: base.cod,
      sigla: base.sigla,
      nome: base.nome,
      funcao: base.funcao,
      poder: base.poder,
      disponivel_portal: base.disponivelPortal,
      nota: base.nota ?? null,
      updated_at: new Date().toISOString(),
    });

    if (fornecedoresMap.size > 0) {
      await supabaseAdmin.from("fornecedores_cache").upsert(
        [...fornecedoresMap.values()].map((f) => ({ cnpj: f.cnpj, nome: f.nome, updated_at: new Date().toISOString() })),
      );
    }

    if (contratos.length > 0) {
      // Mês de referência = mês do intervalo solicitado. Usamos quando o
      // registro vem sem data_assinatura, pra ele aparecer na célula certa
      // da matriz em vez de cair em "sem data".
      const mesRef = Number(data.dataInicial.slice(5, 7));
      // chunk em lotes de 500
      for (let i = 0; i < contratos.length; i += 500) {
        const chunk = contratos.slice(i, i + 500).map((c) => ({
          id: c.id,
          orgao_cod: c.orgaoCod,
          fornecedor_cnpj: c.fornecedorCnpj,
          objeto: c.objeto,
          modalidade: c.modalidade,
          valor: c.valor,
          valor_inicial: valorInicialPorId.get(c.id) ?? null,
          ano: c.ano,
          data_assinatura: c.dataAssinatura || null,
          mes_referencia: mesRef,
          updated_at: new Date().toISOString(),
        }));
        const { error } = await supabaseAdmin.from("contratos_cache").upsert(chunk);
        if (error) erros.push(`db: ${error.message}`);
      }
      // Auditoria de qualidade: aplicar heurísticas e gravar findings.
      try {
        const paraQa: CguContratoLike[] = contratos.map((c) => ({
          id: c.id,
          valor: c.valor,
          valor_inicial: valorInicialPorId.get(c.id) ?? 0,
          orgao_cod: c.orgaoCod,
        }));
        await flagQA(regrasCgu(paraQa));
        if (findingsAutoCorrecao.length > 0) {
          await flagQA(findingsAutoCorrecao);
        }
      } catch (e) {
        erros.push(`qa: ${(e as Error).message}`);
      }
    }

    const consultadoEm = new Date().toISOString();
    const avisosImportacao = [
      ...Array.from(descartes.entries()).map(
        ([motivo, total]) => `info: descartados ${total} — ${motivo}`,
      ),
      ...(correcoesDetalhe.length > 0
        ? [
            `info: ${correcoesDetalhe.length} valor(es) baixo(s) da listagem corrigidos via /contratos/id (${correcoesDetalhe.slice(0, 8).join(", ")}${correcoesDetalhe.length > 8 ? ", …" : ""})`,
          ]
        : []),
    ];
    await supabaseAdmin.from("importacoes").insert({
      orgao_cod: data.codigoOrgao,
      data_inicial: data.dataInicial,
      data_final: data.dataFinal,
      total_bruto: contratosRaw.length,
      importados: contratos.length,
      erros: [...erros, ...avisosImportacao],
      consultado_em: consultadoEm,
      user_id: context.userId,
      endpoint: `GET https://api.portaldatransparencia.gov.br/api-de-dados/contratos?codigoOrgao=${data.codigoOrgao}&dataInicial=${isoToBR(data.dataInicial)}&dataFinal=${isoToBR(data.dataFinal)}`,
    });

    const orgaos: Orgao[] = [base];
    return {
      orgaos,
      fornecedores: [...fornecedoresMap.values()],
      contratos,
      meta: {
        totalBruto: contratosRaw.length,
        importados: contratos.length,
        erros: [...erros, ...avisosImportacao],
        fonte: "Portal da Transparência (CGU)",
        consultadoEm,
      },
    };
  });

export const listImportacoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("importacoes")
      .select("id,orgao_cod,data_inicial,data_final,total_bruto,importados,erros,consultado_em")
      .order("consultado_em", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/**
 * Histórico unificado de importações. Após a unificação do esquema, todas
 * as fontes (CGU, PNCP, Câmara, Senado, Siconfi, Transferegov) gravam na
 * mesma tabela `importacoes`. Campos específicos do Portal CGU
 * (orgao_cod, data_inicial, data_final) ficam NULL para as demais.
 */
export type HistoricoEntrada = {
  id: string;
  fonte: string;          // ex. "CGU", "PNCP", "Câmara CEAP"
  escopo: string;         // ex. sigla do órgão, ou "—"
  periodo: string;        // ex. "01/2024 → 01/2024" ou "Mar/2024"
  bruto: number | null;   // total bruto retornado pela API (quando disponível)
  importados: number;
  erros: string[];        // falhas reais (timeouts, db, qa errors)
  avisos: string[];       // notas informativas (ex.: correção automática)
  quando: string;         // ISO
  endpoint: string | null; // URL/endpoint efetivamente consultado
};

const FONTE_LABEL: Record<string, string> = {
  camara_ceap: "Câmara CEAP",
  camara_vot: "Câmara votações",
  senado_ceaps: "Senado CEAPS",
  senado_vot: "Senado votações",
  pncp: "PNCP",
  transferegov: "Transferegov",
  transferegov_especiais: "Transferegov — Especiais",
  transferegov_finalidade: "Transferegov — Finalidade",
  siconfi: "SICONFI",
  cgu: "Portal CGU",
};

const MESES_CURTO = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

export const listHistoricoUnificado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        offset: z.number().int().min(0).max(10000).default(0),
        limit: z.number().int().min(1).max(100).default(50),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);

    const from = data.offset;
    const to = data.offset + data.limit - 1;
    const { data: rows, error } = await supabaseAdmin
      .from("importacoes")
      .select("id,fonte,escopo,orgao_cod,ano,mes,data_inicial,data_final,total_bruto,importados,erros,consultado_em,endpoint")
      .order("consultado_em", { ascending: false })
      .range(from, to + 1); // pega 1 extra pra detectar hasMore

    if (error) throw new Error(error.message);
    const all = rows ?? [];
    const hasMore = all.length > data.limit;
    const page = all.slice(0, data.limit);

    const entradas: HistoricoEntrada[] = page.map((r) => {
      const errs = Array.isArray(r.erros) ? (r.erros as string[]) : [];
      // Mensagens com prefixo "info:" são notas/avisos, não falhas. São
      // gravadas no mesmo array no banco (compat) mas separamos na API.
      const avisos: string[] = [];
      const erros: string[] = [];
      for (const e of errs) {
        if (typeof e === "string" && e.trim().toLowerCase().startsWith("info:")) {
          avisos.push(e.replace(/^\s*info:\s*/i, ""));
        } else {
          erros.push(e);
        }
      }
      const isCgu = r.fonte === "cgu" && r.data_inicial && r.data_final;
      const isAnual =
        r.fonte === "transferegov_especiais" || r.fonte === "transferegov_finalidade";
      let escopo = r.escopo || "—";
      if (isCgu && r.orgao_cod) {
        const o = ORGAOS_BASE.find((x) => x.cod === r.orgao_cod);
        escopo = o?.sigla ?? r.orgao_cod;
      }
      const periodo = isCgu
        ? `${r.data_inicial} → ${r.data_final}`
        : isAnual && r.ano != null
          ? `${r.ano}`
          : r.ano != null && r.mes != null
            ? `${MESES_CURTO[(r.mes ?? 1) - 1] ?? "—"}/${r.ano}`
            : r.ano != null
              ? `${r.ano}`
              : "—";
      return {
        id: r.id,
        fonte: FONTE_LABEL[r.fonte] ?? r.fonte,
        escopo,
        periodo,
        bruto: r.total_bruto ?? null,
        importados: r.importados ?? 0,
        erros,
        avisos,
        quando: r.consultado_em,
        endpoint: (r as { endpoint?: string | null }).endpoint ?? null,
      };
    });
    return { entradas, hasMore };
  });

export const clearImportData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        confirm: z.literal("APAGAR"),
        // Modo legado (apaga tudo). Quando ausente, exige `fontes`.
        contratos: z.boolean().optional(),
        cache: z.boolean().optional(),
        logs: z.boolean().optional(),
        // Modo seletivo.
        fontes: z.array(z.string().min(1).max(60)).max(50).optional(),
        anoIni: z.number().int().min(2000).max(2100).optional(),
        anoFim: z.number().int().min(2000).max(2100).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);
    const removed: Record<string, number | string> = {};

    // ============ MODO SELETIVO (preferido) ============
    if (data.fontes && data.fontes.length > 0) {
      const anoIni = data.anoIni;
      const anoFim = data.anoFim;
      const periodoAtivo = typeof anoIni === "number" && typeof anoFim === "number";
      // Mapeia id da fonte de limpeza → valor de `fonte` na tabela
      // qa_findings. Só fontes que têm regras de qualidade aparecem aqui.
      const QA_FONTE_MAP: Record<string, string> = {
        cgu: "cgu",
        camara_ceap: "camara_ceap",
        senado_ceaps: "senado_ceaps",
        pncp: "pncp",
        siconfi: "siconfi",
        transferegov: "transferegov",
      };
      const pruneQaFindings = async (qaFonte: string, table: Parameters<typeof supabaseAdmin.from>[0]) => {
        // Coleta ids ainda presentes na tabela-fonte e remove qualquer
        // qa_findings cujo entidade_id não exista mais (alerta órfão).
        const { data: rem, error: remErr } = await supabaseAdmin
          .from(table)
          .select("id")
          .limit(100000);
        if (remErr) throw new Error(`${table} qa-prune select: ${remErr.message}`);
        const remSet = new Set((rem ?? []).map((r) => String((r as { id: unknown }).id)));
        if (remSet.size === 0) {
          const r = await supabaseAdmin
            .from("qa_findings")
            .delete({ count: "exact" })
            .eq("fonte", qaFonte);
          if (r.error) throw new Error(`qa_findings(${qaFonte}): ${r.error.message}`);
          removed[`qa_findings:${qaFonte}`] = r.count ?? 0;
          return;
        }
        const { data: qaRows, error: qaErr } = await supabaseAdmin
          .from("qa_findings")
          .select("id,entidade_id")
          .eq("fonte", qaFonte)
          .limit(100000);
        if (qaErr) throw new Error(`qa_findings select: ${qaErr.message}`);
        const toDelete = (qaRows ?? [])
          .filter((r) => !remSet.has(String(r.entidade_id)))
          .map((r) => r.id);
        let cnt = 0;
        for (let i = 0; i < toDelete.length; i += 500) {
          const slice = toDelete.slice(i, i + 500);
          const r = await supabaseAdmin
            .from("qa_findings")
            .delete({ count: "exact" })
            .in("id", slice);
          if (r.error) throw new Error(`qa_findings delete: ${r.error.message}`);
          cnt += r.count ?? 0;
        }
        removed[`qa_findings:${qaFonte}`] = cnt;
      };
      for (const fid of data.fontes) {
        if (!FONTE_IDS.includes(fid)) continue;
        const fonte = FONTES_LIMPEZA.find((f) => f.id === fid)!;
        const tName = fonte.table as Parameters<typeof supabaseAdmin.from>[0];

        // Resolver filtro por período
        let parentIdsForChild: Array<string | number> | null = null;
        const buildQuery = () => {
          let q = supabaseAdmin.from(tName).delete({ count: "exact" });
          if (periodoAtivo && fonte.yearCol) {
            q = q.gte(fonte.yearCol, anoIni!).lte(fonte.yearCol, anoFim!);
          } else if (periodoAtivo && fonte.dateCol) {
            q = q
              .gte(fonte.dateCol, `${anoIni}-01-01`)
              .lte(fonte.dateCol, `${anoFim}-12-31`);
          } else {
            // Sem filtro: precisa de uma cláusula WHERE (PostgREST exige).
            // Quando há logKind (caso da tabela `importacoes`), os filtros
            // adicionais abaixo já satisfazem essa exigência. Caso contrário
            // usamos a PK declarada (ou heurística por nome de tabela), pois
            // nem toda tabela tem coluna `id` — `fornecedores_cache` usa
            // `cnpj` e `orgaos_cache` usa `cod`.
            if (!fonte.logKind) {
              const anyPk =
                fonte.parentPk ??
                (fonte.table === "fornecedores_cache"
                  ? "cnpj"
                  : fonte.table === "orgaos_cache"
                    ? "cod"
                    : "id");
              q = q.not(anyPk, "is", null);
            }
          }
          if (fonte.extraEq) q = q.eq(fonte.extraEq.col, fonte.extraEq.value);
          // Sub-modo para a tabela `importacoes`: separa o que conta como
          // "histórico visível" dos marcadores de "consultado, vazio".
          if (fonte.logKind === "ativos") {
            // importados > 0 OU erros não vazio
            q = q.or("importados.gt.0,erros.neq.[]");
          } else if (fonte.logKind === "vazios") {
            q = q.eq("importados", 0).eq("erros", "[]");
          }
          return q;
        };

        // Cascata: precisa coletar PKs antes de apagar a pai
        if (fonte.childTable && fonte.childRef && fonte.parentPk) {
          let psel = supabaseAdmin.from(tName).select(fonte.parentPk);
          if (periodoAtivo && fonte.yearCol) {
            psel = psel.gte(fonte.yearCol, anoIni!).lte(fonte.yearCol, anoFim!);
          } else if (periodoAtivo && fonte.dateCol) {
            psel = psel
              .gte(fonte.dateCol, `${anoIni}-01-01`)
              .lte(fonte.dateCol, `${anoFim}-12-31`);
          }
          if (fonte.extraEq) psel = psel.eq(fonte.extraEq.col, fonte.extraEq.value);
          const { data: pRows, error: pErr } = await psel.limit(50000);
          if (pErr) throw new Error(`${fonte.table} select: ${pErr.message}`);
          parentIdsForChild = (pRows ?? []).map((r) => (r as Record<string, string | number>)[fonte.parentPk!]).filter((v) => v != null);
          if (parentIdsForChild.length > 0) {
            const cName = fonte.childTable as Parameters<typeof supabaseAdmin.from>[0];
            // chunk de 500 ids
            let childCount = 0;
            for (let i = 0; i < parentIdsForChild.length; i += 500) {
              const slice = parentIdsForChild.slice(i, i + 500);
              const r = await supabaseAdmin.from(cName).delete({ count: "exact" }).in(fonte.childRef!, slice);
              if (r.error) throw new Error(`${fonte.childTable}: ${r.error.message}`);
              childCount += r.count ?? 0;
            }
            removed[fonte.childTable!] = childCount;
          } else {
            removed[fonte.childTable!] = 0;
          }
        }

        const r = await buildQuery();
        if (r.error) throw new Error(`${fonte.table}: ${r.error.message}`);
        removed[fonte.table] = r.count ?? 0;

        // Limpa também os logs de importação dessa fonte — assim a matriz
        // de cobertura volta a mostrar os meses como "nunca consultados"
        // e o usuário pode reimportar do zero. Após a unificação, todos
        // os logs (CGU e demais fontes) ficam em `importacoes`.
        if (fonte.tentativaFonte) {
          let tq = supabaseAdmin
            .from("importacoes")
            .delete({ count: "exact" })
            .eq("fonte", fonte.tentativaFonte);
          if (periodoAtivo) tq = tq.gte("ano", anoIni!).lte("ano", anoFim!);
          const tr = await tq;
          if (tr.error) throw new Error(`importacoes(${fonte.tentativaFonte}): ${tr.error.message}`);
          removed[`importacoes:${fonte.tentativaFonte}`] = tr.count ?? 0;
        }

        // Remove suspeitas de qualidade órfãs dessa fonte.
        const qaFonte = QA_FONTE_MAP[fid];
        if (qaFonte) {
          await pruneQaFindings(qaFonte, tName);
        }
      }
      return { ok: true, removed };
    }

    // ============ MODO LEGADO ============
    if (data.contratos) {
      const { error, count } = await supabaseAdmin
        .from("contratos_cache")
        .delete({ count: "exact" })
        .not("id", "is", null);
      if (error) throw new Error(`contratos_cache: ${error.message}`);
      removed.contratos = count ?? "ok";
    }
    if (data.cache) {
      const f = await supabaseAdmin.from("fornecedores_cache").delete({ count: "exact" }).not("cnpj", "is", null);
      if (f.error) throw new Error(`fornecedores_cache: ${f.error.message}`);
      removed.fornecedores = f.count ?? "ok";
      const o = await supabaseAdmin.from("orgaos_cache").delete({ count: "exact" }).not("cod", "is", null);
      if (o.error) throw new Error(`orgaos_cache: ${o.error.message}`);
      removed.orgaos = o.count ?? "ok";
      // Demais caches consultados pela matriz de cobertura
      const extras: Array<{ table: "camara_despesas_cache" | "camara_votacoes_cache" | "camara_votos_cache" | "senado_despesas_cache" | "senado_votacoes_cache" | "senado_votos_cache" | "pncp_contratos_cache" | "siconfi_relatorios_cache" | "transferegov_instrumentos_cache"; key: string }> = [
        { table: "camara_despesas_cache", key: "id" },
        { table: "camara_votacoes_cache", key: "id" },
        { table: "camara_votos_cache", key: "votacao_id" },
        { table: "senado_despesas_cache", key: "id" },
        { table: "senado_votacoes_cache", key: "id" },
        { table: "senado_votos_cache", key: "votacao_id" },
        { table: "pncp_contratos_cache", key: "id" },
        { table: "siconfi_relatorios_cache", key: "id" },
        { table: "transferegov_instrumentos_cache", key: "id" },
      ];
      for (const { table, key } of extras) {
        const r = await supabaseAdmin.from(table).delete({ count: "exact" }).not(key, "is", null);
        if (r.error) throw new Error(`${table}: ${r.error.message}`);
        removed[table] = r.count ?? "ok";
      }
      // Cache zerado: descarta todas as suspeitas de qualidade.
      const qa = await supabaseAdmin
        .from("qa_findings")
        .delete({ count: "exact" })
        .not("id", "is", null);
      if (qa.error) throw new Error(`qa_findings: ${qa.error.message}`);
      removed.qa_findings = qa.count ?? 0;
    }
    if (data.logs) {
      const { error, count } = await supabaseAdmin
        .from("importacoes")
        .delete({ count: "exact" })
        .not("id", "is", null);
      if (error) throw new Error(`importacoes: ${error.message}`);
      removed.logs = count ?? "ok";
    }
    return { ok: true, removed };
  });

export const loadStoredDataset = createServerFn({ method: "GET" }).handler(async () => {
  const [orgaosRes, fornRes, contRes] = await Promise.all([
    supabaseAdmin.from("orgaos_cache").select("*"),
    supabaseAdmin.from("fornecedores_cache").select("cnpj,nome"),
    supabaseAdmin.from("contratos_cache").select("*").limit(10000),
  ]);
  const orgaos: Orgao[] = (orgaosRes.data ?? []).map((o) => ({
    cod: o.cod,
    sigla: o.sigla,
    nome: o.nome,
    funcao: o.funcao,
    poder: o.poder as Orgao["poder"],
    disponivelPortal: o.disponivel_portal,
    nota: o.nota ?? undefined,
  }));
  const fornecedores: Fornecedor[] = (fornRes.data ?? []).map((f) => ({ cnpj: f.cnpj, nome: f.nome }));
  const contratos: Contrato[] = (contRes.data ?? []).map((c) => ({
    id: c.id,
    orgaoCod: c.orgao_cod,
    fornecedorCnpj: c.fornecedor_cnpj,
    objeto: c.objeto,
    modalidade: c.modalidade as Contrato["modalidade"],
    valor: Number(c.valor) || 0,
    ano: c.ano,
    dataAssinatura: c.data_assinatura ?? "",
  }));
  return { orgaos, fornecedores, contratos };
});
