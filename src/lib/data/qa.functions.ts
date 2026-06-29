import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { parseValorPortal } from "@/lib/data/real/portal-client";
import {
  regrasPncp,
  regrasCamaraCeap,
  regrasSenadoCeaps,
  regrasTransferegov,
  regrasTransferegovEmendas,
  regrasSiconfi,
  sincronizarQaCgu,
  flagQA,
  valorAutoritativoCgu,
  type QaFonte,
} from "./qa";
import type {
  AnomaliaInput,
  AnomaliaSeveridade,
  AnomaliaStatus,
} from "@/lib/anomalia";

// -------------------------------------------------------------
// Helpers
// -------------------------------------------------------------
async function ensureAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error("Falha ao verificar permissão.");
  if (data?.role !== "admin")
    throw new Error("Acesso restrito: somente administradores.");
}

function urlInternaPara(
  fonte: string,
  tipo: string,
  id: string,
): string | undefined {
  if (fonte === "cgu" && tipo === "contrato") return `/contratos/${id}`;
  if (fonte === "cgu" && tipo === "orgao") return `/orgaos/${id}`;
  if (fonte === "cgu" && tipo === "fornecedor") return `/fornecedores/${id}`;
  if (fonte === "pncp" && tipo === "contrato") return `/pncp`;
  if (fonte === "transferegov" && tipo === "instrumento") return `/convenios/${id}`;
  if (fonte === "transferegov" && tipo === "emenda") return `/transferencias/especiais/${id}`;
  return undefined;
}

/** ISO (YYYY-MM-DD) → BR (DD/MM/YYYY). */
function isoParaBR(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/**
 * Link da fonte oficial de um contrato CGU. A página /contratos/{id} dá 404
 * porque o id da API ≠ id interno do site. Montamos a busca em
 * /contratos/consulta com os dados do contrato (órgão + número + assinatura +
 * faixa de valor) — específica o bastante para cair no contrato.
 */
export function urlBuscaContratoCgu(args: {
  orgaoCod: string | null | undefined;
  numero: string | null | undefined;
  valor: number | null | undefined;
  dataAssinatura: string | null | undefined;
}): string | undefined {
  if (!args.orgaoCod) return undefined;
  const p = new URLSearchParams();
  p.set("paginacaoSimples", "true");
  p.set(
    "colunasSelecionadas",
    "linkDetalhamento,dataAssinatura,dataInicioVigencia,orgaoEntidadeVinculada,numeroContrato,nomeFornecedor,cpfCnpjFornecedor,situacao,valorContratado",
  );
  p.set("orgaos", `OS${args.orgaoCod}`);
  const num = (args.numero ?? "").replace(/\D/g, "");
  if (num) p.set("numeroContrato", num);
  const br = isoParaBR(args.dataAssinatura);
  if (br) {
    p.set("assinaturaDe", br);
    p.set("assinaturaAte", br);
  }
  if (args.valor != null && args.valor > 0) {
    p.set("valorDe", String(Math.floor(args.valor)));
    p.set("valorAte", String(Math.ceil(args.valor)));
  }
  return `https://portaldatransparencia.gov.br/contratos/consulta?${p.toString()}`;
}

function urlOficialPara(
  fonte: string,
  tipo: string,
  id: string,
): string | undefined {
  // CGU/contrato: sem URL confiável por id (o id da API ≠ id do site → 404). O
  // link de busca é montado por enriquecimento (urlBuscaContratoCgu), que tem
  // órgão/número/valor/data. Sem esses dados, fica sem link oficial.
  if (fonte === "cgu" && tipo === "contrato") return undefined;
  if (fonte === "cgu" && tipo === "orgao")
    return `https://portaldatransparencia.gov.br/orgaos/${encodeURIComponent(id)}`;
  if (fonte === "cgu" && tipo === "fornecedor")
    return `https://portaldatransparencia.gov.br/busca?termo=${encodeURIComponent(id)}&tipoBusca=2`;
  if (fonte === "pncp" && tipo === "contrato")
    return `https://pncp.gov.br/app/contratos/${encodeURIComponent(id)}`;
  if (fonte === "transferegov" && tipo === "instrumento")
    // O Portal da Transparência não tem URL pública por id de convênio.
    // O link "de verdade" é a página do transferegov.sistema.gov.br
    // (`sequencialConvenio={codigo}`), montada em listarQualidade* a partir
    // do `codigo_siconv` (dimConvenio.codigo da CGU). Quando o cache não
    // tem o código, caímos numa busca pelo número do convênio.
    return `https://portaldatransparencia.gov.br/convenios/consulta`;
  if (fonte === "transferegov" && tipo === "emenda")
    return `https://portaldatransparencia.gov.br/emendas/consulta?codigoEmenda=${encodeURIComponent(id)}`;
  return undefined;
}

function origemParaAnomalia(origem: string): "qa" | "marcacao_cidada" | "sinal" {
  if (origem === "marcacao_cidada" || origem === "sinal") return origem;
  return "qa";
}

type FindingRow = {
  id: string;
  fonte: string;
  entidade_tipo: string;
  entidade_id: string;
  regra: string;
  severidade: string;
  origem: string;
  valor_armazenado: number | null;
  valor_esperado: number | null;
  status: string;
  reportado_em: string | null;
  reporte_canal: string | null;
  reporte_protocolo: string | null;
  detectado_em: string;
  revalidado_em: string | null;
  resolvido_em: string | null;
  detalhes?: Record<string, unknown> | null;
};

function numberFromDetalhes(detalhes: Record<string, unknown> | null | undefined, key: string): number | null {
  const v = detalhes?.[key];
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

function comparacaoPara(r: FindingRow): AnomaliaInput["comparacao"] {
  const inicial = numberFromDetalhes(r.detalhes, "valor_inicial");
  const final = numberFromDetalhes(r.detalhes, "valor_final") ?? r.valor_esperado;
  // CGU: a verdade do valor "armazenado" é o cache. O valor da coluna
  // valor_armazenado é apenas o snapshot no momento da detecção e pode estar
  // defasado. O front prioriza cache_valor / cache_valor_inicial quando o
  // enrichment os carrega via contexto_origem.
  const cacheValor = numberFromDetalhes(r.detalhes, "__cache_valor");
  const cacheInicial = numberFromDetalhes(r.detalhes, "__cache_valor_inicial");
  const camposSuspeitos = Array.isArray(r.detalhes?.campos_suspeitos)
    ? (r.detalhes!.campos_suspeitos as unknown[]).filter(
        (x): x is string => typeof x === "string",
      )
    : [];
  const sufixoCampos =
    camposSuspeitos.length > 0
      ? ` Campo(s) suspeito(s) na fonte: ${camposSuspeitos.join(", ")}.`
      : "";
  if (r.regra === "discrepancia_extrema_inicial_final") {
    return {
      armazenado: cacheInicial ?? inicial ?? r.valor_armazenado,
      esperado: final,
      armazenadoLabel: "Valor inicial suspeito",
      esperadoLabel: "Valor final do contrato",
      observacao:
        "A regra avalia a escala do valor inicial: ele está milhares de vezes acima do valor final e merece investigação própria." +
        sufixoCampos,
    };
  }
  if (r.regra === "valor_truncado_suspeito" || r.regra === "valor_final_truncado_suspeito") {
    return {
      armazenado: cacheValor ?? r.valor_armazenado,
      esperado: r.valor_esperado,
      armazenadoLabel: "Valor armazenado (suspeito)",
      esperadoLabel: "Valor oficial (a confirmar)",
      observacao:
        "Valor abaixo do limite plausível para esta fonte. Confira no detalhe oficial via cURL abaixo." +
        sufixoCampos,
    };
  }
  if (r.regra === "valor_muito_baixo") {
    return {
      armazenado: cacheValor ?? r.valor_armazenado,
      esperado: r.valor_esperado,
      armazenadoLabel: "Valor atual no cache",
      esperadoLabel: "Valor oficial (a confirmar)",
      observacao:
        "Detectado por heurística (valor < R$ 100)." +
        sufixoCampos,
    };
  }
  if (r.regra === "valor_corrigido_listagem") {
    // valor_armazenado = valor DEFEITUOSO (truncado por escala);
    // valor_esperado = valor correto (não-truncado), já gravado no cache.
    return {
      armazenado: r.valor_armazenado,
      esperado: cacheValor ?? r.valor_esperado,
      armazenadoLabel: "Valor truncado recebido da fonte",
      esperadoLabel: "Valor oficial — corrigido no site",
      observacao:
        "A fonte (listagem ou detalhe) trouxe o valor truncado por escala (÷10.000). Gravamos o valor não-truncado, que bate com o documento oficial; este alerta fica como registro do defeito." +
        sufixoCampos,
    };
  }
  if (r.regra === "fornecedor_ausente") {
    return {
      armazenado: cacheValor ?? r.valor_armazenado,
      esperado: null,
      armazenadoLabel: "Valor do contrato",
      esperadoLabel: "",
      observacao:
        "A API não informou o CNPJ/CPF do fornecedor (sigiloso ou ausente). O contrato foi salvo assim mesmo para investigação." +
        sufixoCampos,
    };
  }
  return r.valor_armazenado != null || r.valor_esperado != null
    ? { armazenado: cacheValor ?? r.valor_armazenado, esperado: r.valor_esperado }
    : undefined;
}

function rowToAnomalia(r: FindingRow): AnomaliaInput {
  const trilha: AnomaliaInput["trilha"] = [
    {
      em: r.detectado_em,
      tipo: "deteccao",
      descricao:
        r.origem === "revalidacao"
          ? `Detectado via revalidação (${r.regra})`
          : `Detectado por heurística (${r.regra})`,
    },
  ];
  if (r.revalidado_em)
    trilha.push({
      em: r.revalidado_em,
      tipo: "revalidacao",
      descricao:
        r.valor_esperado != null
          ? `Revalidado via endpoint de detalhe — divergência confirmada`
          : `Revalidado — valores conferem`,
    });
  if (r.reportado_em)
    trilha.push({
      em: r.reportado_em,
      tipo: "reporte",
      descricao: r.reporte_protocolo
        ? `Reportado ao órgão (${r.reporte_canal ?? "—"}, protocolo ${r.reporte_protocolo})`
        : `Reportado ao órgão (${r.reporte_canal ?? "—"})`,
    });
  if (r.resolvido_em)
    trilha.push({
      em: r.resolvido_em,
      tipo: "resolucao",
      descricao: `Resolvido (${r.status})`,
    });

  return {
    id: r.id,
    origem: origemParaAnomalia(r.origem),
    fonte: r.fonte,
    severidade: (r.severidade as AnomaliaSeveridade) ?? "aviso",
    status: (r.status as AnomaliaStatus) ?? "aberto",
    regra: r.regra,
    resumo: r.regra,
    entidade: {
      tipo: r.entidade_tipo,
      id: r.entidade_id,
    url_interno: urlInternaPara(r.fonte, r.entidade_tipo, r.entidade_id),
      url_oficial: urlOficialPara(r.fonte, r.entidade_tipo, r.entidade_id),
    },
    comparacao: comparacaoPara(r),
    trilha,
    reporte: r.reportado_em
      ? {
          canal: r.reporte_canal ?? undefined,
          protocolo: r.reporte_protocolo ?? undefined,
          reportado_em: r.reportado_em ?? undefined,
        }
      : undefined,
    detectado_em: r.detectado_em,
    revalidado_em: r.revalidado_em ?? null,
  };
}

// -------------------------------------------------------------
// Leitura pública (via RPC SECURITY DEFINER)
// -------------------------------------------------------------
// Sinais (origem='sinal') e marcações cidadãs (origem='marcacao_cidada')
// reusam a tabela qa_findings só pra ter o fluxo de investigação/denúncia,
// mas NÃO devem aparecer nas listas de "Qualidade", que são exclusivamente
// sobre defeitos de importação/cobertura de dados.
const ORIGENS_FORA_QUALIDADE = ["sinal", "marcacao_cidada"] as const;

export const listarQualidadePublico = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        // Multi-seleção por grupo (caixas-filtro clicáveis do /qualidade).
        fontes: z.array(z.string().min(1).max(40)).max(20).optional(),
        statuses: z.array(z.string().min(1).max(40)).max(20).optional(),
        regras: z.array(z.string().min(1).max(120)).max(40).optional(),
        limit: z.number().int().min(1).max(500).default(200),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    // Consulta direto na tabela (service role ignora RLS). Evita depender de uma
    // RPC com arrays e suporta multi-seleção por grupo (fontes/status/regras).
    let q = supabaseAdmin
      .from("qa_findings")
      .select(
        "id,fonte,entidade_tipo,entidade_id,regra,severidade,origem,valor_armazenado,valor_esperado,status,reportado_em,reporte_canal,reporte_protocolo,detectado_em,revalidado_em,resolvido_em",
      )
      .not(
        "origem",
        "in",
        `(${ORIGENS_FORA_QUALIDADE.map((o) => `"${o}"`).join(",")})`,
      );
    if (data.fontes && data.fontes.length > 0) q = q.in("fonte", data.fontes);
    if (data.statuses && data.statuses.length > 0) q = q.in("status", data.statuses);
    if (data.regras && data.regras.length > 0) q = q.in("regra", data.regras);
    // Busca um teto generoso por recência e ordena por severidade no servidor de
    // app, para não cortar críticos antigos antes de ordenar.
    const { data: rows, error } = await q
      .order("detectado_em", { ascending: false })
      .limit(1500);
    if (error) throw new Error(error.message);
    const rank = (s: string) => (s === "critico" ? 0 : s === "aviso" ? 1 : 2);
    const lista = (rows ?? [])
      .map((r) => rowToAnomalia(r as FindingRow))
      .sort(
        (a, b) =>
          rank(a.severidade) - rank(b.severidade) ||
          (a.detectado_em < b.detectado_em ? 1 : a.detectado_em > b.detectado_em ? -1 : 0),
      )
      .slice(0, data.limit);

    // Link oficial dos contratos CGU = busca em /contratos/consulta (a página
    // por id dá 404 porque o id da API ≠ id do site). Monta a busca com os
    // dados do contrato no cache.
    const cguIds = lista
      .filter((a) => a.fonte === "cgu" && a.entidade.tipo === "contrato")
      .map((a) => a.entidade.id);
    if (cguIds.length > 0) {
      const { data: cs } = await supabaseAdmin
        .from("contratos_cache")
        .select("id, orgao_cod, numero, valor, data_assinatura")
        .in("id", cguIds);
      const byId = new Map((cs ?? []).map((c) => [c.id, c] as const));
      for (const a of lista) {
        if (a.fonte !== "cgu" || a.entidade.tipo !== "contrato") continue;
        const c = byId.get(a.entidade.id);
        if (!c) continue;
        a.entidade.url_oficial = urlBuscaContratoCgu({
          orgaoCod: c.orgao_cod,
          numero: (c as { numero?: string | null }).numero ?? null,
          valor: c.valor == null ? null : Number(c.valor),
          dataAssinatura: c.data_assinatura,
        });
      }
    }

    // Sobrescreve url_oficial dos instrumentos transferegov com o número do
    // convênio (o Portal não tem página pública por id interno).
    const instrIds = lista
      .filter((a) => a.fonte === "transferegov" && a.entidade.tipo === "instrumento")
      .map((a) => a.entidade.id);
    if (instrIds.length > 0) {
      const { data: cs } = await supabaseAdmin
        .from("transferegov_instrumentos_cache")
        .select("id, numero, codigo_siconv")
        .in("id", instrIds);
      const byId = new Map(
        (cs ?? []).map(
          (c) => [c.id, { numero: c.numero, codigo_siconv: c.codigo_siconv ?? null }] as const,
        ),
      );
      for (const a of lista) {
        const meta = byId.get(a.entidade.id);
        if (meta && a.fonte === "transferegov" && a.entidade.tipo === "instrumento") {
          if (meta.codigo_siconv) {
            a.entidade.url_oficial = `https://discricionarias.transferegov.sistema.gov.br/voluntarias/ConsultarProposta/ResultadoDaConsultaDeConvenioSelecionarConvenio.do?sequencialConvenio=${encodeURIComponent(meta.codigo_siconv)}`;
          } else if (meta.numero) {
            a.entidade.url_oficial = `https://portaldatransparencia.gov.br/convenios/consulta?nrConvenio=${encodeURIComponent(meta.numero)}`;
          }
          a.entidade.rotulo = meta.codigo_siconv
            ? `Convênio nº ${meta.numero} · SICONV ${meta.codigo_siconv}`
            : `Convênio nº ${meta.numero}`;
        }
      }
    }
    return lista;
  });

export const detalheQualidadePublico = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { data: rows, error } = await supabaseAdmin.rpc(
      "qa_finding_publico",
      { _id: data.id },
    );
    if (error) throw new Error(error.message);
    const r = (rows ?? [])[0] as FindingRow | undefined;
    if (!r) return null;
    return rowToAnomalia(r);
  });

/** Status vivos de um finding. `corrigido_origem` = a API corrigiu numa
 * reimportação posterior; `corrigido_automaticamente` = a NOSSA conferência por
 * detalhe corrigiu o valor no site (ex.: alerta `valor_corrigido_listagem`) — o
 * alerta fica como registro do defeito. */
export const STATUS_QA = [
  "aberto",
  "confirmado",
  "reportado",
  "corrigido_origem",
  "corrigido_automaticamente",
  "falso_positivo",
  "wontfix",
] as const;

export const agregadoQualidade = createServerFn({ method: "GET" }).handler(
  async () => {
    // Recalcula em JS pra poder excluir as origens não-qualidade.
    const { data, error } = await supabaseAdmin
      .from("qa_findings")
      .select("fonte, status, severidade, origem, regra")
      .not(
        "origem",
        "in",
        `(${ORIGENS_FORA_QUALIDADE.map((o) => `"${o}"`).join(",")})`,
      );
    if (error) throw new Error(error.message);
    const novoPorStatus = (): Record<string, number> =>
      Object.fromEntries(STATUS_QA.map((s) => [s, 0]));
    const agg = new Map<
      string,
      { fonte: string; total: number; criticos: number; porStatus: Record<string, number> }
    >();
    const regras = new Set<string>();
    // Contagens globais por fonte/status/regra — alimentam as caixas-filtro
    // clicáveis do /qualidade.
    const porFonte: Record<string, number> = {};
    const porStatus: Record<string, number> = {};
    const porRegra: Record<string, number> = {};
    for (const r of data ?? []) {
      const f = (r.fonte as string) || "—";
      const cur =
        agg.get(f) ?? { fonte: f, total: 0, criticos: 0, porStatus: novoPorStatus() };
      cur.total++;
      const s = (r.status as string) || "aberto";
      if (s in cur.porStatus) cur.porStatus[s]++;
      if ((r.severidade as string) === "critico") cur.criticos++;
      agg.set(f, cur);
      const rg = (r.regra as string) || "";
      if (rg) regras.add(rg);
      porFonte[f] = (porFonte[f] ?? 0) + 1;
      porStatus[s] = (porStatus[s] ?? 0) + 1;
      if (rg) porRegra[rg] = (porRegra[rg] ?? 0) + 1;
    }
    return {
      fontes: Array.from(agg.values()),
      regras: Array.from(regras).sort(),
      porFonte,
      porStatus,
      porRegra,
    };
  },
);

// Findings públicos (sem notas_admin) por entidade — usado pelo banner em
// páginas de registro tipo /contratos/$id.
export const findingsPorEntidade = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        fonte: z.string().min(1).max(40),
        entidade_tipo: z.string().min(1).max(40),
        entidade_id: z.string().min(1).max(200),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { data: rows, error } = await supabaseAdmin
      .from("qa_findings")
      .select(
        "id,fonte,entidade_tipo,entidade_id,regra,severidade,origem,valor_armazenado,valor_esperado,status,reportado_em,reporte_canal,reporte_protocolo,detectado_em,revalidado_em,resolvido_em",
      )
      .eq("fonte", data.fonte)
      .eq("entidade_tipo", data.entidade_tipo)
      .eq("entidade_id", data.entidade_id)
      .in("status", ["aberto", "confirmado", "reportado"])
      .not(
        "origem",
        "in",
        `(${ORIGENS_FORA_QUALIDADE.map((o) => `"${o}"`).join(",")})`,
      )
      .order("severidade", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => rowToAnomalia(r as FindingRow));
  });

// -------------------------------------------------------------
// Admin
// -------------------------------------------------------------
export const listarQualidadeAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        fonte: z.string().optional(),
        status: z.string().optional(),
        regra: z.string().optional(),
        limit: z.number().int().min(1).max(500).default(200),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);
    let q = supabaseAdmin
      .from("qa_findings")
      .select(
        "id,fonte,entidade_tipo,entidade_id,regra,severidade,origem,valor_armazenado,valor_esperado,status,reportado_em,reporte_canal,reporte_protocolo,detectado_em,revalidado_em,resolvido_em,notas_admin,detalhes",
      )
      .not(
        "origem",
        "in",
        `(${ORIGENS_FORA_QUALIDADE.map((o) => `"${o}"`).join(",")})`,
      )
      .order("severidade", { ascending: true })
      .order("detectado_em", { ascending: false })
      .limit(data.limit);
    if (data.fonte) q = q.eq("fonte", data.fonte);
    if (data.status) q = q.eq("status", data.status);
    if (data.regra) q = q.eq("regra", data.regra);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const lista = rows ?? [];

    // Enriquecer findings CGU com data_assinatura do contrato (necessário pra
    // reconstruir o cURL do endpoint /contratos lista).
    const cguIds = lista
      .filter((r) => r.fonte === "cgu" && r.entidade_tipo === "contrato")
      .map((r) => r.entidade_id);
    const ctxCgu = new Map<
      string,
      {
        data_assinatura: string | null;
        data_inicio_vigencia: string | null;
        orgao_cod: string | null;
        numero: string | null;
        ano: number | null;
        mes_referencia: number | null;
        cache_valor: number | null;
        cache_valor_inicial: number | null;
      }
    >();
    if (cguIds.length > 0) {
      const { data: cs } = await supabaseAdmin
        .from("contratos_cache")
        .select(
          "id, data_assinatura, data_inicio_vigencia, orgao_cod, numero, ano, mes_referencia, valor, valor_inicial",
        )
        .in("id", cguIds);
      for (const c of cs ?? []) {
        ctxCgu.set(c.id, {
          data_assinatura: c.data_assinatura ?? null,
          data_inicio_vigencia: c.data_inicio_vigencia ?? null,
          orgao_cod: c.orgao_cod ?? null,
          numero: (c as { numero?: string | null }).numero ?? null,
          ano: c.ano ?? null,
          mes_referencia: c.mes_referencia ?? null,
          cache_valor: c.valor == null ? null : Number(c.valor),
          cache_valor_inicial:
            c.valor_inicial == null ? null : Number(c.valor_inicial),
        });
      }
    }

    // Enriquecer findings de instrumentos do Transferegov (endpoint /convenios
    // do Portal da Transparência) com número, beneficiário e datas, pra montar
    // o cURL de re-checagem e mostrar contexto no card.
    const instrIds = lista
      .filter((r) => r.fonte === "transferegov" && r.entidade_tipo === "instrumento")
      .map((r) => r.entidade_id);
    const ctxInstr = new Map<
      string,
      {
        numero: string | null;
        codigo_siconv: string | null;
        modalidade: string | null;
        beneficiario_nome: string | null;
        data_assinatura: string | null;
        valor_global: number | null;
        valor_repasse: number | null;
        valor_contrapartida: number | null;
        municipio_ibge: string | null;
        uf_beneficiario: string | null;
      }
    >();
    if (instrIds.length > 0) {
      const { data: cs } = await supabaseAdmin
        .from("transferegov_instrumentos_cache")
        .select(
          "id,numero,codigo_siconv,modalidade,beneficiario_nome,data_assinatura,valor_global,valor_repasse,valor_contrapartida,municipio_ibge,uf_beneficiario",
        )
        .in("id", instrIds);
      for (const c of cs ?? []) {
        ctxInstr.set(c.id, {
          numero: c.numero ?? null,
          codigo_siconv: c.codigo_siconv ?? null,
          modalidade: c.modalidade ?? null,
          beneficiario_nome: c.beneficiario_nome ?? null,
          data_assinatura: c.data_assinatura ?? null,
          valor_global: c.valor_global ?? null,
          valor_repasse: c.valor_repasse ?? null,
          valor_contrapartida: c.valor_contrapartida ?? null,
          municipio_ibge: c.municipio_ibge ?? null,
          uf_beneficiario: c.uf_beneficiario ?? null,
        });
      }
    }

    // Enriquecer findings de emendas (Transferegov SE) com número, autor e
    // valor pago — usado pra contexto e pra montar o cURL ao endpoint público.
    const emendaIds = lista
      .filter((r) => r.fonte === "transferegov" && r.entidade_tipo === "emenda")
      .map((r) => r.entidade_id);
    const ctxEmenda = new Map<
      string,
      {
        modalidade: string | null;
        numero_emenda: string | null;
        codigo_emenda: string | null;
        autor_emenda: string | null;
        ano: number | null;
        valor: number | null;
        valor_pago: number | null;
      }
    >();
    if (emendaIds.length > 0) {
      const { data: cs } = await supabaseAdmin
        .from("transferegov_emendas_cache")
        .select(
          "id,modalidade,numero_emenda,codigo_emenda,autor_emenda,ano,valor,valor_pago",
        )
        .in("id", emendaIds);
      for (const c of cs ?? []) {
        ctxEmenda.set(c.id, {
          modalidade: c.modalidade ?? null,
          numero_emenda: c.numero_emenda ?? null,
          codigo_emenda: c.codigo_emenda ?? null,
          autor_emenda: c.autor_emenda ?? null,
          ano: c.ano ?? null,
          valor: c.valor ?? null,
          valor_pago: c.valor_pago ?? null,
        });
      }
    }

    return lista.map((r) => {
      // Injeta valores do cache em `detalhes` ANTES de chamar rowToAnomalia,
      // para que `comparacaoPara` exiba o valor atual em vez do snapshot
      // antigo gravado em valor_armazenado.
      const ctxForRow = ctxCgu.get(r.entidade_id);
      const rowComCache: FindingRow = ctxForRow
        ? ({
            ...(r as FindingRow),
            detalhes: {
              ...((r as FindingRow).detalhes ?? {}),
              __cache_valor: ctxForRow.cache_valor,
              __cache_valor_inicial: ctxForRow.cache_valor_inicial,
            },
          } as FindingRow)
        : (r as FindingRow);
      const base = rowToAnomalia(rowComCache);
      const extra = r as { notas_admin?: string | null; detalhes?: unknown };
      const ctx = ctxCgu.get(r.entidade_id);
      // Link oficial da CGU = busca em /contratos/consulta (a página por id dá 404).
      if (ctx && base.fonte === "cgu" && base.entidade.tipo === "contrato") {
        base.entidade.url_oficial = urlBuscaContratoCgu({
          orgaoCod: ctx.orgao_cod,
          numero: ctx.numero,
          valor: ctx.cache_valor,
          dataAssinatura: ctx.data_assinatura,
        });
      }
      const ctxI = ctxInstr.get(r.entidade_id);
      const ctxE = ctxEmenda.get(r.entidade_id);
      // Sobrescreve url_oficial: se temos o código SICONV (dimConvenio.codigo
      // da CGU), montamos o link direto pra página do convênio no
      // transferegov.sistema.gov.br. Sem código, caímos numa busca pelo
      // número do convênio no Portal da Transparência.
      if (ctxI && base.fonte === "transferegov" && base.entidade.tipo === "instrumento") {
        if (ctxI.codigo_siconv) {
          base.entidade.url_oficial = `https://discricionarias.transferegov.sistema.gov.br/voluntarias/ConsultarProposta/ResultadoDaConsultaDeConvenioSelecionarConvenio.do?sequencialConvenio=${encodeURIComponent(ctxI.codigo_siconv)}`;
        } else if (ctxI.numero) {
          base.entidade.url_oficial = `https://portaldatransparencia.gov.br/convenios/consulta?nrConvenio=${encodeURIComponent(ctxI.numero)}`;
        }
        if (ctxI.numero) {
          base.entidade.rotulo = ctxI.codigo_siconv
            ? `Convênio nº ${ctxI.numero} · SICONV ${ctxI.codigo_siconv}`
            : `Convênio nº ${ctxI.numero}`;
        }
      }
      // Página da varredura (gravada em detalhes na ingestão) — é por onde se
      // localiza o contrato no endpoint /contratos, já que a CGU não é
      // filtrável por data de assinatura.
      const paginaVarredura =
        (extra.detalhes as { pagina_varredura?: number | null } | null | undefined)
          ?.pagina_varredura ?? null;
      return {
        ...base,
        notas_admin: extra.notas_admin ?? null,
        detalhes_json: JSON.stringify(extra.detalhes ?? {}),
        contexto_origem: ctx
          ? {
              data_assinatura: ctx.data_assinatura,
              data_inicio_vigencia: ctx.data_inicio_vigencia,
              orgao_cod: ctx.orgao_cod,
              ano: ctx.ano,
              mes_referencia: ctx.mes_referencia,
              cache_valor: ctx.cache_valor,
              cache_valor_inicial: ctx.cache_valor_inicial,
              pagina_varredura: paginaVarredura,
              // mes_referencia agora = mês de início de vigência (igual à
              // dimensão da cobertura); a antiga flag janela_difere_assinatura
              // (mes_referencia vs assinatura) deixou de fazer sentido.
            }
          : null,
        contexto_instrumento: ctxI ?? null,
        contexto_emenda: ctxE ?? null,
      };
    });
  });

export const marcarStatusFinding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum([
          "aberto",
          "confirmado",
          "reportado",
          "corrigido_origem",
          "corrigido_automaticamente",
          "falso_positivo",
          "wontfix",
        ]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);
    const resolvendo =
      data.status === "corrigido_origem" ||
      data.status === "corrigido_automaticamente" ||
      data.status === "falso_positivo" ||
      data.status === "wontfix";
    const patch: { status: string; resolvido_em?: string } = {
      status: data.status,
    };
    if (resolvendo) patch.resolvido_em = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from("qa_findings")
      .update(patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const salvarReporteFinding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        canal: z.string().min(1).max(64),
        protocolo: z.string().max(120).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("qa_findings")
      .update({
        status: "reportado",
        reporte_canal: data.canal,
        reporte_protocolo: data.protocolo ?? null,
        reportado_em: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const salvarNotaFinding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        nota: z.string().max(4000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("qa_findings")
      .update({ notas_admin: data.nota || null })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// -------------------------------------------------------------
// Promover sinal/marcação cidadã em finding investigável
// -------------------------------------------------------------
// Retorna o finding existente (por chave fonte+entidade+regra+origem) ou
// cria um novo. Permite que /admin/sinais e /admin/marcacoes reusem o
// mesmo fluxo de investigação/denúncia de /admin/qualidade.
export const findingPorChave = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        fonte: z.string().min(1).max(40),
        entidade_tipo: z.string().min(1).max(40),
        entidade_id: z.string().min(1).max(200),
        regra: z.string().min(1).max(120),
        origem: z.string().min(1).max(40),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);
    const { data: rows, error } = await supabaseAdmin
      .from("qa_findings")
      .select(
        "id,fonte,entidade_tipo,entidade_id,regra,severidade,origem,valor_armazenado,valor_esperado,status,reportado_em,reporte_canal,reporte_protocolo,detectado_em,revalidado_em,resolvido_em,notas_admin",
      )
      .eq("fonte", data.fonte)
      .eq("entidade_id", data.entidade_id)
      .eq("regra", data.regra)
      .order("detectado_em", { ascending: false })
      .limit(1);
    if (error) throw new Error(error.message);
    const r = (rows ?? [])[0];
    if (!r) return null;
    const base = rowToAnomalia(r as FindingRow);
    return { ...base, notas_admin: (r as { notas_admin?: string | null }).notas_admin ?? null };
  });

export const promoverParaFinding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        fonte: z.string().min(1).max(40),
        entidade_tipo: z.string().min(1).max(40),
        entidade_id: z.string().min(1).max(200),
        regra: z.string().min(1).max(120),
        origem: z.enum(["sinal", "marcacao_cidada"]),
        severidade: z.enum(["info", "aviso", "critico"]).default("aviso"),
        valor_armazenado: z.number().nullable().optional(),
        valor_esperado: z.number().nullable().optional(),
        detalhes: z.record(z.string(), z.unknown()).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);
    // Dedup por chave. O índice único é (fonte, entidade_id, regra) — NÃO
    // inclui origem nem entidade_tipo. Se filtrarmos por origem aqui,
    // perdemos findings já criados pela heurística (origem="heuristica")
    // com a mesma chave e o INSERT bate em qa_findings_unique_open.
    const { data: existentes } = await supabaseAdmin
      .from("qa_findings")
      .select("id")
      .eq("fonte", data.fonte)
      .eq("entidade_id", data.entidade_id)
      .eq("regra", data.regra)
      .limit(1);
    if ((existentes ?? []).length > 0) {
      return { id: existentes![0].id as string, criado: false };
    }
    const { data: ins, error } = await supabaseAdmin
      .from("qa_findings")
      .insert({
        fonte: data.fonte,
        entidade_tipo: data.entidade_tipo,
        entidade_id: data.entidade_id,
        regra: data.regra,
        origem: data.origem,
        severidade: data.severidade,
        status: "aberto",
        valor_armazenado: data.valor_armazenado ?? null,
        valor_esperado: data.valor_esperado ?? null,
        detalhes: (data.detalhes ?? {}) as never,
      })
      .select("id")
      .single();
    if (error) {
      // Corrida: alguém criou no meio do caminho. Relê e devolve o existente.
      if (error.code === "23505" || /unique/i.test(error.message)) {
        const { data: again } = await supabaseAdmin
          .from("qa_findings")
          .select("id")
          .eq("fonte", data.fonte)
          .eq("entidade_id", data.entidade_id)
          .eq("regra", data.regra)
          .limit(1);
        if ((again ?? []).length > 0) {
          return { id: again![0].id as string, criado: false };
        }
      }
      throw new Error(error.message);
    }
    return { id: ins!.id as string, criado: true };
  });

// -------------------------------------------------------------
// Backfill / job de aplicar heurísticas em todo cache
// -------------------------------------------------------------
export const aplicarHeuristicasFonte = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        fonte: z.enum([
          "cgu",
          "pncp",
          "camara_ceap",
          "senado_ceaps",
          "transferegov",
          "siconfi",
        ]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);
    const fonte = data.fonte as QaFonte;
    let inseridos = 0;
    let totalAnalisado = 0;

    if (fonte === "cgu") {
      const { data: rows } = await supabaseAdmin
        .from("contratos_cache")
        .select("id");
      totalAnalisado = rows?.length ?? 0;
      const qa = await sincronizarQaCgu((rows ?? []).map((r) => String(r.id)));
      inseridos = qa.inseridos;
    } else if (fonte === "pncp") {
      const { data: rows } = await supabaseAdmin
        .from("pncp_contratos_cache")
        .select("id, valor_global, valor_inicial");
      totalAnalisado = rows?.length ?? 0;
      inseridos = await flagQA(regrasPncp(rows ?? []));
    } else if (fonte === "camara_ceap") {
      const { data: rows } = await supabaseAdmin
        .from("camara_despesas_cache")
        .select("id, valor_liquido, valor_documento, deputado_id");
      totalAnalisado = rows?.length ?? 0;
      inseridos = await flagQA(regrasCamaraCeap(rows ?? []));
    } else if (fonte === "senado_ceaps") {
      const { data: rows } = await supabaseAdmin
        .from("senado_despesas_cache")
        .select("id, valor_reembolsado, senador_id");
      totalAnalisado = rows?.length ?? 0;
      inseridos = await flagQA(regrasSenadoCeaps(rows ?? []));
    } else if (fonte === "transferegov") {
      const { data: rows } = await supabaseAdmin
        .from("transferegov_instrumentos_cache")
        .select("id, valor_repasse, valor_global");
      totalAnalisado = rows?.length ?? 0;
      inseridos = await flagQA(regrasTransferegov(rows ?? []));
      // Inclui também emendas (instrumentos + emendas compõem "transferegov").
      const { data: emRows } = await supabaseAdmin
        .from("transferegov_emendas_cache")
        .select("id, valor, valor_pago, modalidade");
      totalAnalisado += emRows?.length ?? 0;
      inseridos += await flagQA(regrasTransferegovEmendas(emRows ?? []));
    } else if (fonte === "siconfi") {
      const { data: rows } = await supabaseAdmin
        .from("siconfi_relatorios_cache")
        .select("id, valor, conta, tipo_relatorio");
      totalAnalisado = rows?.length ?? 0;
      inseridos = await flagQA(regrasSiconfi(rows ?? []));
    }
    return { fonte, totalAnalisado, novos: inseridos };
  });

// -------------------------------------------------------------
// Revalidação CGU — busca endpoint de detalhe para contratos suspeitos
// -------------------------------------------------------------
type PortalContratoDetalhe = {
  id?: number | string;
  valorInicialCompra?: number;
  valorFinalCompra?: number;
};

type PortalContratoListaItem = {
  id?: number | string;
  valorInicialCompra?: number;
  valorFinalCompra?: number;
  dataAssinatura?: string | null;
};

function detalhesRevalidacao(
  detalhes: Record<string, unknown> | null | undefined,
  valorAlertaRegistrado: number,
  valorInicialDetalhe: number,
  valorFinalDetalhe: number,
  lista?: {
    achado: boolean;
    pagina: number | null;
    valor_inicial: number | null;
    valor_final: number | null;
  },
  cache?: {
    valor_atual: number | null;
    valor_inicial_atual: number | null;
  },
) {
  return {
    ...((detalhes as Record<string, unknown>) ?? {}),
    fonte_detalhe: "portal_cgu_/contratos/id",
    valor_inicial: valorInicialDetalhe || null,
    valor_final: valorFinalDetalhe || null,
    revalidacao: {
      valor_alerta_registrado: valorAlertaRegistrado,
      valor_cache_atual: cache?.valor_atual ?? null,
      valor_inicial_cache_atual: cache?.valor_inicial_atual ?? null,
      valor_final_lista: lista?.valor_final ?? null,
      valor_inicial_lista: lista?.valor_inicial ?? null,
      valor_inicial_detalhe: valorInicialDetalhe,
      valor_final_detalhe: valorFinalDetalhe,
      lista_recheck: lista ?? null,
      em: new Date().toISOString(),
    },
  } as never;
}

async function portalGetDetalhe(id: string): Promise<PortalContratoDetalhe> {
  const key = process.env.PORTAL_TRANSPARENCIA_API_KEY;
  if (!key) throw new Error("PORTAL_TRANSPARENCIA_API_KEY não configurada.");
  const url = `https://api.portaldatransparencia.gov.br/api-de-dados/contratos/id?id=${encodeURIComponent(id)}`;
  const res = await fetch(url, {
    headers: { "chave-api-dados": key, accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Portal detalhe ${res.status}`);
  const text = await res.text();
  return JSON.parse(text) as PortalContratoDetalhe;
}

/**
 * Procura o item no endpoint /contratos (lista paginada). A API nem sempre
 * devolve o registro na página 1, por isso varremos até `maxPaginas` (limite
 * conservador para não esgotar a cota). Retorna o item e a página em que foi
 * encontrado, ou null se não apareceu na janela analisada.
 */
/**
 * Localiza o contrato na listagem usando a PÁGINA gravada na varredura
 * (`pagina_varredura` no finding). A CGU filtra por vigência, não por
 * assinatura, então não dá para localizar por data — vamos direto à página onde
 * o contrato apareceu na ingestão (sem `dataInicial`/`dataFinal`). Se a
 * paginação tiver mudado desde então, o item pode não estar mais ali (retorna
 * null) — a decisão da re-checagem não depende disso (usa o detalhe por id).
 */
async function portalAcharNaLista(
  alvoId: string,
  codigoOrgao: string,
  pagina: number | null,
): Promise<{ item: PortalContratoListaItem; pagina: number } | null> {
  if (!pagina || pagina < 1) return null;
  const key = process.env.PORTAL_TRANSPARENCIA_API_KEY;
  if (!key) throw new Error("PORTAL_TRANSPARENCIA_API_KEY não configurada.");
  const url =
    `https://api.portaldatransparencia.gov.br/api-de-dados/contratos?` +
    `codigoOrgao=${encodeURIComponent(codigoOrgao)}&pagina=${pagina}`;
  const res = await fetch(url, {
    headers: { "chave-api-dados": key, accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Portal lista ${res.status} (p${pagina})`);
  const arr = (await res.json()) as PortalContratoListaItem[];
  if (!Array.isArray(arr)) return null;
  const achado = arr.find((it) => String(it.id ?? "") === alvoId);
  return achado ? { item: achado, pagina } : null;
}

function fmtBRL(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  });
}

function regraCguAindaSuspeita(
  regra: string,
  valorInicial: number | null | undefined,
  valorFinal: number | null | undefined,
): boolean {
  const inicial = Number(valorInicial ?? 0);
  const final = Number(valorFinal ?? 0);
  if (regra === "discrepancia_extrema_inicial_final") {
    return inicial > 0 && final > 0 && (inicial >= final * 1000 || final >= inicial * 1000);
  }
  if (regra === "valor_final_truncado_suspeito") {
    return final > 0 && final < 100 && inicial > 1000;
  }
  if (regra === "valor_muito_baixo") {
    return final > 0 && final < 100;
  }
  // Regras legadas/aposentadas (possivel_ponto_fixo, valor_precisao_suspeita):
  // caem aqui e retornam false → se o detalhe diferir do cache, o cache é
  // corrigido; se coincidir, vira falso positivo. Comportamento adequado.
  return false;
}

function montarNotaRecheck(args: {
  regra: string;
  valorCacheAtual: number | null;
  valorInicialCache: number | null;
  valorInicialDetalhe: number;
  valorFinalDetalhe: number;
  lista: { achado: boolean; pagina: number | null; valor_inicial: number | null; valor_final: number | null };
  resultado: "confirmado" | "falso_positivo" | "corrigido_origem";
  cacheAtualizado?: { valor_final: number | null; valor_inicial: number | null } | null;
}): string {
  const listaFinal = args.lista.achado ? args.lista.valor_final : null;
  const cacheFinal = args.valorCacheAtual;
  const listaDetalheCoincidem =
    listaFinal != null &&
    args.valorFinalDetalhe > 0 &&
    Math.abs(listaFinal - args.valorFinalDetalhe) <=
      Math.max(listaFinal, args.valorFinalDetalhe) * 0.001;
  const reconciliacaoLista = args.lista.achado
    ? listaDetalheCoincidem
      ? " Listagem e detalhe concordam entre si."
      : " Atenção: a listagem diverge do detalhe (provável bug da listagem da CGU)."
    : "";
  const linhas = [
    `[re-checagem ${new Date().toISOString().slice(0, 16).replace("T", " ")}]`,
    `• Endpoint /contratos (lista): ${
      args.lista.achado
        ? `encontrado na pág. ${args.lista.pagina} — inicial ${fmtBRL(args.lista.valor_inicial)}, final ${fmtBRL(args.lista.valor_final)}`
        : "não localizado nas páginas varridas"
    }`,
    `• Endpoint /contratos/id (detalhe): inicial ${fmtBRL(args.valorInicialDetalhe)}, final ${fmtBRL(args.valorFinalDetalhe)}`,
    `• Cache local atual: final ${fmtBRL(cacheFinal)}${
      args.valorInicialCache != null ? `, inicial ${fmtBRL(args.valorInicialCache)}` : ""
    }`,
    args.cacheAtualizado
      ? `• Cache local corrigido com o valor oficial: final ${fmtBRL(args.cacheAtualizado.valor_final)}${
          args.cacheAtualizado.valor_inicial != null ? `, inicial ${fmtBRL(args.cacheAtualizado.valor_inicial)}` : ""
        }.`
      : `• Cache local não foi alterado nesta re-checagem.`,
    args.resultado === "confirmado"
      ? `• Conclusão: a suspeita (${args.regra}) se confirma no valor oficial do detalhe.${reconciliacaoLista} Segue para revisão/reporte.`
      : args.resultado === "corrigido_origem"
        ? `• Conclusão: o valor oficial (detalhe) difere do cache — cache corrigido com o valor oficial e suspeita resolvida.${reconciliacaoLista}`
        : `• Conclusão: detalhe não sustenta a suspeita — marcado como falso positivo.${reconciliacaoLista}`,
  ];
  return linhas.join("\n");
}

export const revalidarFindingsCgu = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({ limit: z.number().int().min(1).max(50).default(25) })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);

    const { data: pendentes } = await supabaseAdmin
      .from("qa_findings")
        .select("id, entidade_id, regra, valor_armazenado, detalhes")
      .eq("fonte", "cgu")
      .eq("status", "aberto")
      // fornecedor_ausente não tem valor a re-checar contra a fonte.
      .neq("regra", "fornecedor_ausente")
      .limit(data.limit);

    const lista = pendentes ?? [];
    let confirmados = 0;
    let falsos = 0;
    const erros: string[] = [];

    for (let i = 0; i < lista.length; i++) {
      const p = lista[i];
      if (i > 0) await new Promise((r) => setTimeout(r, 2000)); // rate limit
      try {
        const det = await portalGetDetalhe(p.entidade_id);
        const valorInicialDetalhe = parseValorPortal(det.valorInicialCompra);
        const valorFinalDetalhe = parseValorPortal(det.valorFinalCompra);
        const { data: cacheRow } = await supabaseAdmin
          .from("contratos_cache")
          .select("valor, valor_inicial")
          .eq("id", p.entidade_id)
          .maybeSingle();
        const valorCacheAtual = cacheRow?.valor == null ? null : Number(cacheRow.valor);
        const valorInicialCache = cacheRow?.valor_inicial == null ? null : Number(cacheRow.valor_inicial);
        const detalheAindaSuspeito = regraCguAindaSuspeita(
          p.regra,
          valorInicialDetalhe,
          valorFinalDetalhe,
        );
        const valorAtualDoAchado =
          p.regra === "discrepancia_extrema_inicial_final"
            ? (valorInicialCache ?? valorInicialDetalhe)
            : (valorCacheAtual ?? valorFinalDetalhe);

        if (detalheAindaSuspeito) {
          confirmados++;
          await supabaseAdmin
            .from("qa_findings")
            .update({
              status: "confirmado",
              severidade: "critico",
              valor_armazenado: valorAtualDoAchado,
              valor_esperado: valorFinalDetalhe || null,
              revalidado_em: new Date().toISOString(),
              resolvido_em: null,
              detalhes: detalhesRevalidacao(
                p.detalhes as Record<string, unknown> | null,
                valorAtualDoAchado ?? 0,
                valorInicialDetalhe,
                valorFinalDetalhe,
              ),
            })
            .eq("id", p.id);
        } else {
          falsos++;
          await supabaseAdmin
            .from("qa_findings")
            .update({
              status: "falso_positivo",
              revalidado_em: new Date().toISOString(),
              resolvido_em: new Date().toISOString(),
              valor_armazenado: valorAtualDoAchado,
              valor_esperado: valorFinalDetalhe || null,
            })
            .eq("id", p.id);
        }
      } catch (e) {
        erros.push(`${p.entidade_id}: ${(e as Error).message}`);
      }
    }

    return {
      processados: lista.length,
      confirmados,
      falsos_positivos: falsos,
      erros,
    };
  });

// Revalida UM finding CGU específico (botão por item).
export const revalidarFindingCgu = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);
    const { data: p, error: errFind } = await supabaseAdmin
      .from("qa_findings")
      .select("id, entidade_id, regra, valor_armazenado, detalhes, fonte, notas_admin")
      .eq("id", data.id)
      .maybeSingle();
    if (errFind) throw new Error(errFind.message);
    if (!p) throw new Error("Suspeita não encontrada.");
    if (p.fonte !== "cgu")
      throw new Error("Re-checagem automática só implementada para CGU.");
    // `valor_corrigido_listagem` é um REGISTRO histórico de defeito já corrigido
    // pela conferência por detalhe na ingestão (status corrigido_automaticamente).
    // O cache já tem o valor oficial, então re-checar só o rotularia falso
    // positivo e apagaria o registro do defeito. Não re-checamos.
    if (p.regra === "valor_corrigido_listagem")
      throw new Error("Este alerta registra uma correção automática já aplicada; não há o que re-checar.");
    if (p.regra === "fornecedor_ausente")
      throw new Error("Alerta de fornecedor ausente: não há valor a re-checar contra a fonte.");

    // 1) Detalhe (valor esperado / "verdade" do contrato no Portal).
    const det = await portalGetDetalhe(p.entidade_id);
    const valorInicialDetalhe = parseValorPortal(det.valorInicialCompra);
    const valorFinalDetalhe = parseValorPortal(det.valorFinalCompra);
    // valor_armazenado é apenas o snapshot do momento da detecção; a verdade
    // do "valor atual" vem do cache (lido logo abaixo).

    // 2) Lista paginada — localiza o item pela PÁGINA da varredura (gravada no
    // finding), já que a CGU não é filtrável por data de assinatura. Serve para
    // a nota evidenciar a divergência listagem×detalhe (a listagem da CGU às
    // vezes devolve o valor ÷10000). A decisão usa o detalhe por id.
    const { data: cacheRow } = await supabaseAdmin
      .from("contratos_cache")
      .select("id, orgao_cod, data_assinatura, valor, valor_inicial")
      .eq("id", p.entidade_id)
      .maybeSingle();
    const paginaVarredura =
      (p.detalhes as { pagina_varredura?: number | null } | null | undefined)?.pagina_varredura ??
      null;
    let listaInfo = {
      achado: false,
      pagina: null as number | null,
      valor_inicial: null as number | null,
      valor_final: null as number | null,
    };
    const valorCacheAtual = cacheRow?.valor ?? null;
    const valorInicialCache = cacheRow?.valor_inicial ?? null;
    if (cacheRow?.orgao_cod && paginaVarredura) {
      try {
        const achado = await portalAcharNaLista(
          p.entidade_id,
          cacheRow.orgao_cod,
          paginaVarredura,
        );
        if (achado) {
          const vIni = parseValorPortal(achado.item.valorInicialCompra);
          const vFin = parseValorPortal(achado.item.valorFinalCompra);
          listaInfo = {
            achado: true,
            pagina: achado.pagina,
            valor_inicial: vIni || null,
            valor_final: vFin || null,
          };
        }
      } catch {
        // Falha no endpoint de lista não bloqueia a re-checagem do detalhe.
      }
    }

    // Valor autoritativo = o NÃO-truncado entre listagem e detalhe (o bug ÷10000
    // pode estar em qualquer um dos dois). MESMA lógica do ingest, para a
    // re-checagem manual nunca re-introduzir um valor que a automática corrigiu.
    const listFinal = listaInfo.achado ? listaInfo.valor_final ?? 0 : 0;
    const listInicial = listaInfo.achado ? listaInfo.valor_inicial ?? 0 : 0;
    const finalAut = valorAutoritativoCgu(listFinal, valorFinalDetalhe);
    const inicialAut = valorAutoritativoCgu(listInicial, valorInicialDetalhe);
    const aindaSuspeito = regraCguAindaSuspeita(
      p.regra,
      inicialAut.valor,
      finalAut.valor,
    );
    const valorFinalCorreto = finalAut.valor > 0 ? finalAut.valor : inicialAut.valor;
    const valorInicialCorreto = inicialAut.valor > 0 ? inicialAut.valor : null;

    // Decisão:
    // - valor autoritativo ainda suspeito → o valor oficial é o próprio anômalo:
    //   erro real na origem (confirmado, segue para reporte); não há o que corrigir.
    // - valor autoritativo limpo e diferente do cache → o cache guardou um valor
    //   errado (truncamento por escala). Corrige o cache com o valor não-truncado
    //   e resolve a suspeita (corrigido_origem).
    // - limpo e igual ao cache → suspeita não se sustenta (falso positivo).
    let resultado: "confirmado" | "corrigido_origem" | "falso_positivo";
    let cacheAtualizadoInfo: { valor_final: number | null; valor_inicial: number | null } | null = null;
    if (aindaSuspeito) {
      resultado = "confirmado";
    } else {
      const difere =
        valorFinalCorreto > 0 &&
        (valorCacheAtual == null ||
          Math.abs(Number(valorCacheAtual) - valorFinalCorreto) >
            Math.max(1, valorFinalCorreto * 0.001));
      if (difere) {
        await supabaseAdmin
          .from("contratos_cache")
          .update({
            valor: valorFinalCorreto,
            valor_inicial: valorInicialCorreto,
            updated_at: new Date().toISOString(),
          })
          .eq("id", p.entidade_id);
        cacheAtualizadoInfo = { valor_final: valorFinalCorreto, valor_inicial: valorInicialCorreto };
        resultado = "corrigido_origem";
      } else {
        resultado = "falso_positivo";
      }
    }

    // valor_armazenado preserva o valor errado detectado; valor_esperado é o
    // oficial do detalhe.
    const valorDetectado =
      (p as { valor_armazenado?: number | null }).valor_armazenado ?? valorCacheAtual ?? null;
    const notaAuto = montarNotaRecheck({
      regra: p.regra,
      valorCacheAtual,
      valorInicialCache,
      valorInicialDetalhe,
      valorFinalDetalhe,
      lista: listaInfo,
      resultado,
      cacheAtualizado: cacheAtualizadoInfo,
    });
    const notasAtual = (p as { notas_admin?: string | null }).notas_admin ?? "";
    const notasNovas = notasAtual ? `${notasAtual}\n\n${notaAuto}` : notaAuto;

    const detalhesComuns = detalhesRevalidacao(
      p.detalhes as Record<string, unknown> | null,
      valorDetectado ?? 0,
      valorInicialDetalhe,
      valorFinalDetalhe,
      listaInfo,
      { valor_atual: valorCacheAtual, valor_inicial_atual: valorInicialCache },
    );

    await supabaseAdmin
      .from("qa_findings")
      .update({
        status: resultado,
        severidade: resultado === "confirmado" ? "critico" : undefined,
        valor_armazenado: valorDetectado,
        valor_esperado: valorFinalDetalhe || null,
        revalidado_em: new Date().toISOString(),
        resolvido_em: resultado === "confirmado" ? null : new Date().toISOString(),
        notas_admin: notasNovas,
        detalhes: detalhesComuns,
      })
      .eq("id", p.id);

    return {
      resultado,
      valor_armazenado: valorDetectado ?? 0,
      valor_detalhe: valorFinalDetalhe,
      lista: listaInfo,
      cache_atualizado: cacheAtualizadoInfo != null,
    };
  });
