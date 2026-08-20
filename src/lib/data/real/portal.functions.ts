import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { RESULTADOS, type ResultadoClassificado } from "@/lib/data/resultado-rodada";
import type { Contrato, Fornecedor, Orgao } from "../types";
import { ORGAOS_BASE } from "../catalog";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sanitizarTextoPublico } from "@/lib/sanitize";
import { FONTE_LABEL } from "@/lib/data/fonte-rotulos";
import { FONTES_LIMPEZA, FONTE_IDS, type FonteLimpeza } from "@/lib/data/limpeza";
import { funcaoRpcAusente } from "@/lib/data/erros-banco";
import type { Database } from "@/integrations/supabase/types";

// Nomes de TABELA (sem views) — o catálogo de limpeza só aponta para tabelas;
// restringir aqui mantém a resolução de tipos do PostgREST no overload certo.
type TabelaLimpeza = keyof Database["public"]["Tables"];
import {
  sincronizarQaCgu,
  flagQA,
  findingValorCorrigidoListagem,
  findingFornecedorAusente,
  valorAutoritativoCgu,
  CNPJ_FORNECEDOR_AUSENTE,
  type QaFinding,
} from "@/lib/data/qa";
import {
  parseValorPortal,
  portalGet,
  portalGetComTexto,
  PORTAL_BASE,
} from "@/lib/data/real/portal-client";
import {
  sleep,
  parseDatePortal as parseDate,
  isoToBR,
  ensureAdmin,
  tabelaVarreduraAusente,
  inserirLogsRequisicao,
  persistirVarredura,
  montarVarreduraKey,
  parseVarreduraKey,
  type LogRequisicao,
} from "@/lib/data/real/sweep";

// Re-export para compatibilidade (testes e código legado importam daqui).
export { parseValorPortal };

type PortalContrato = {
  id?: number | string;
  numero?: string;
  objeto?: string;
  dataAssinatura?: string;
  dataInicioVigencia?: string;
  valorInicialCompra?: unknown;
  valorFinalCompra?: unknown;
  modalidadeCompra?: string;
  fornecedor?: {
    id?: number | string;
    cnpjFormatado?: string | null;
    cpfFormatado?: string | null;
    // A API usa `numeroInscricaoSocial`; mantemos `numeroDeInscricao` como
    // fallback legado por segurança.
    numeroInscricaoSocial?: string | null;
    numeroDeInscricao?: string | null;
    nome?: string | null;
    razaoSocialReceita?: string | null;
    razaoSocial?: string | null;
    tipo?: string | null;
  };
};

export function normalizarValoresCguListagem(rawInicial: unknown, rawFinal: unknown) {
  return {
    valorInicial: parseValorPortal(rawInicial),
    valorFinal: parseValorPortal(rawFinal),
  };
}

function normalizeModalidade(s: string | undefined): Contrato["modalidade"] {
  const x = (s ?? "").toLowerCase();
  if (x.includes("dispensa")) return "dispensa";
  if (x.includes("inexigi")) return "inexigibilidade";
  if (x.includes("concorr")) return "concorrencia";
  return "pregao";
}

// ---------------------------------------------------------------------------
// Helpers de ingestão (compartilhados entre varredura por detalhe e modo janela)
// ---------------------------------------------------------------------------

/** Primeira string não-vazia (após trim); "" se todas vazias. NÃO usar `??` com
 * os campos da API: ela manda "" (string vazia, não null) para os ausentes, e
 * `??` só pula null/undefined — deixaria PF (cnpjFormatado="") cair como vazio. */
function primeiraNaoVazia(...vals: Array<string | number | null | undefined>): string {
  for (const v of vals) {
    const s = typeof v === "number" ? String(v) : typeof v === "string" ? v.trim() : "";
    if (s) return s;
  }
  return "";
}

function fornecedorDeRaw(raw: PortalContrato): Fornecedor | null {
  const f = raw.fornecedor;
  // Documento identificador: CNPJ (PJ) ou CPF (PF, mascarado pela própria CGU,
  // ex.: "***.441.092-**") ou nº de inscrição social. Só é "ausente" quando NÃO
  // há documento algum (fornecedor genuinamente sigiloso/omisso).
  const doc = primeiraNaoVazia(
    f?.cnpjFormatado,
    f?.cpfFormatado,
    f?.numeroInscricaoSocial,
    f?.numeroDeInscricao,
  );
  if (!doc) return null;
  const nome = primeiraNaoVazia(f?.nome, f?.razaoSocialReceita, f?.razaoSocial) || doc;
  return { cnpj: doc, nome };
}

/** Constrói o Contrato normalizado a partir do raw + valores autoritativos. */
function construirContratoCgu(
  raw: PortalContrato,
  codigoOrgao: string,
  cnpj: string,
  valorFinal: number,
  valorInicial: number,
  anoFallback: number,
): Contrato {
  const dataAssinatura = parseDate(raw.dataAssinatura);
  const dataInicioVigencia = parseDate(raw.dataInicioVigencia);
  // Sem dataAssinatura, dataInicioVigencia serve de referência temporal.
  const dataReferencia = dataAssinatura || dataInicioVigencia;
  const ano = dataReferencia ? Number(dataReferencia.slice(0, 4)) : anoFallback;
  const id = String(
    raw.id ?? `${codigoOrgao}-${raw.numero ?? Math.random().toString(36).slice(2)}`,
  );
  const valor = valorFinal > 0 ? valorFinal : valorInicial;
  return {
    id,
    orgaoCod: codigoOrgao,
    fornecedorCnpj: cnpj,
    // Sanitização na ingestão (Fase 3): PII em campo livre é mascarada ANTES
    // de persistir no cache, não só na exibição.
    objeto: sanitizarTextoPublico((raw.objeto ?? "").slice(0, 240)) || "(sem descrição)",
    modalidade: normalizeModalidade(raw.modalidadeCompra),
    valor,
    ano,
    dataAssinatura,
    dataInicioVigencia,
  };
}

async function upsertOrgaoCache(base: Orgao): Promise<void> {
  // Quando não temos um nome real do órgão (código importado avulso, fora do
  // catálogo enriquecido), o `nome` é o próprio código. Nesse caso NÃO
  // sobrescrevemos uma linha existente — o nome bom vem do sync SIAFI
  // (`sincronizarOrgaosSIAFI`). `ignoreDuplicates` só insere se ainda não houver
  // linha, preservando nome/sigla já sincronizados.
  const nomeConhecido = !!base.nome && base.nome !== base.cod;
  const row = {
    cod: base.cod,
    sigla: base.sigla || null,
    nome: base.nome,
    funcao: base.funcao || null,
    poder: base.poder,
    disponivel_portal: base.disponivelPortal,
    nota: base.nota ?? null,
    updated_at: new Date().toISOString(),
  };
  await supabaseAdmin
    .from("orgaos_cache")
    .upsert(
      row,
      nomeConhecido ? { onConflict: "cod" } : { onConflict: "cod", ignoreDuplicates: true },
    );
}

async function upsertFornecedoresCache(map: Map<string, Fornecedor>): Promise<void> {
  if (map.size === 0) return;
  // Mesma regra do `upsertOrgaoCache`: quando o nome é só o documento cru
  // (placeholder de PF mascarada/sigilosa), NÃO sobrescreve uma linha que já
  // tenha o nome real — `ignoreDuplicates` só insere se ainda não houver linha.
  const agora = new Date().toISOString();
  const comNome: Array<{ cnpj: string; nome: string; updated_at: string }> = [];
  const placeholders: typeof comNome = [];
  for (const f of map.values()) {
    const row = { cnpj: f.cnpj, nome: f.nome, updated_at: agora };
    if (f.nome && f.nome !== f.cnpj) comNome.push(row);
    else placeholders.push(row);
  }
  if (comNome.length > 0) await supabaseAdmin.from("fornecedores_cache").upsert(comNome);
  if (placeholders.length > 0)
    await supabaseAdmin
      .from("fornecedores_cache")
      .upsert(placeholders, { onConflict: "cnpj", ignoreDuplicates: true });
}

async function upsertContratosCache(
  contratos: Contrato[],
  valorInicialPorId: Map<string, number>,
  numeroPorId?: Map<string, string>,
): Promise<string[]> {
  const erros: string[] = [];
  for (let i = 0; i < contratos.length; i += 500) {
    const chunk = contratos.slice(i, i + 500).map((c) => ({
      id: c.id,
      orgao_cod: c.orgaoCod,
      fornecedor_cnpj: c.fornecedorCnpj,
      objeto: c.objeto,
      modalidade: c.modalidade,
      valor: c.valor,
      valor_inicial: valorInicialPorId.get(c.id) ?? null,
      numero: numeroPorId?.get(c.id) ?? null,
      ano: c.ano,
      data_assinatura: c.dataAssinatura || null,
      data_inicio_vigencia: c.dataInicioVigencia || null,
      // Mês de referência = mês de INÍCIO DE VIGÊNCIA (dimensão da cobertura e do
      // filtro da CGU). Fallback para o mês da assinatura quando a vigência não
      // veio. A cobertura_cgu também aloca por data_inicio_vigencia.
      mes_referencia: c.dataInicioVigencia
        ? Number(c.dataInicioVigencia.slice(5, 7))
        : c.dataAssinatura
          ? Number(c.dataAssinatura.slice(5, 7))
          : null,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await supabaseAdmin.from("contratos_cache").upsert(chunk);
    if (error) erros.push(`db: ${error.message}`);
  }
  return erros;
}

/** Fornecedor placeholder para contratos sem CNPJ/CPF na fonte. */
const FORNECEDOR_AUSENTE: Fornecedor = {
  cnpj: CNPJ_FORNECEDOR_AUSENTE,
  nome: "Fornecedor sigiloso ou ausente",
};

/** Detalhe autoritativo de um contrato (`/contratos/id`). Devolve também o
 * trecho cru do JSON + timestamp para a evidência bruta dos findings de valor
 * (prova da intermitência do bug de escala da API). */
async function fetchDetalheContrato(
  id: string,
): Promise<{ valorInicial: number; valorFinal: number; em: string; rawSnippet: string }> {
  const { data: det, rawText } = await portalGetComTexto<{
    valorInicialCompra?: unknown;
    valorFinalCompra?: unknown;
  }>("/contratos/id", { id });
  return {
    valorInicial: parseValorPortal(det.valorInicialCompra),
    valorFinal: parseValorPortal(det.valorFinalCompra),
    em: new Date().toISOString(),
    rawSnippet: rawText.slice(0, 600),
  };
}

export const fetchPortalOrgao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        codigoOrgao: z.string().regex(/^\d{4,6}$/),
        // Datas ISO (YYYY-MM-DD). OPCIONAIS: na API da CGU, dataInicial/
        // dataFinal filtram por VIGÊNCIA, não por assinatura. A ingestão roda em
        // modo VARREDURA (sem janela), puxando o histórico completo do órgão.
        dataInicial: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        dataFinal: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        // Teto de páginas por rodada (rede de segurança). A varredura é
        // primariamente limitada por TEMPO (orcamentoMs), não por páginas.
        maxPaginas: z.number().int().min(1).max(5000).default(5000),
        // Pausa entre TODAS as requisições (páginas E detalhes). A varredura
        // confere o detalhe de cada contrato; 800ms entre GETs respeita o
        // rate-limit da CGU e evita a degradação ÷10000 da listagem.
        delayMs: z.number().int().min(0).max(10000).default(800),
        // Orçamento de tempo por rodada. A varredura é retomável: cada rodada
        // paginar até esgotar este tempo, salvando progresso POR PÁGINA, e a
        // próxima rodada (manual ou auto) continua de onde parou. ~3min cabe no
        // timeout de 4min do runBatch no cliente.
        orcamentoMs: z.number().int().min(10000).max(230000).default(180000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);

    // Órgão pode não estar no catálogo enriquecido (ORGAOS_BASE): o Portal
    // /contratos aceita qualquer código de órgão máximo do Executivo. Se estiver
    // catalogado e explicitamente marcado como fora do Portal (Câmara/Senado, com
    // integração própria), bloqueia; senão, importa com um base mínimo (o nome bom
    // vem do sync SIAFI / do payload dos contratos).
    const catalogado = ORGAOS_BASE.find((o) => o.cod === data.codigoOrgao);
    if (catalogado && !catalogado.disponivelPortal) {
      throw new Error(`${catalogado.sigla} não é coberto pelo Portal. ${catalogado.nota ?? ""}`);
    }
    const base: Orgao = catalogado ?? {
      cod: data.codigoOrgao,
      sigla: data.codigoOrgao,
      nome: data.codigoOrgao,
      funcao: "",
      poder: "executivo",
      disponivelPortal: true,
    };

    const temJanela = !!data.dataInicial && !!data.dataFinal;
    // O endpoint /contratos pagina em blocos fixos de 15. Página menor = última.
    const TAM_PAGINA = 15;
    await upsertOrgaoCache(base);

    // =========================================================================
    // VARREDURA POR DETALHE (varredura completa do órgão OU janela de vigência).
    // Para cada página, para cada item mantido, busca o /contratos/id
    // (autoritativo) e grava o valor não-truncado. Quando a listagem diverge do
    // detalhe, cria `valor_corrigido_listagem`. Retomável por TEMPO, com
    // progresso persistido por página (sobrevive a kill do servidor).
    //
    // JANELA DE VIGÊNCIA (temJanela): a API /contratos filtra por vigência
    // (dataInicial=dataInicioVigencia, dataFinal=dataFimVigencia). Ela devolve
    // contratos cuja vigência SE SOBREPÕE à janela (inclui os que começaram
    // antes); guardamos só os com INÍCIO de vigência DENTRO da janela. O estado
    // de retomada é independente da varredura completa (chave composta).
    // =========================================================================
    // Chave da varredura em cgu_varredura: órgão (varredura completa) ou
    // órgão#dataIni#dataFim (janela). Estados independentes, ambos retomáveis.
    // Contratos mantêm o formato legado (sem prefixo de entidade); ver
    // `montarVarreduraKey` em `sweep.ts`.
    const varreduraKey = montarVarreduraKey(
      "contratos",
      data.codigoOrgao,
      data.dataInicial,
      data.dataFinal,
    );
    {
      // Retoma de onde parou (cgu_varredura). Sem estado, ou já completa →
      // recomeça do zero (re-varredura).
      let paginaInicial = 1;
      let totalAcumulado = 0;
      {
        const { data: est } = await supabaseAdmin
          .from("cgu_varredura")
          .select("ultima_pagina, completa, total_importado")
          .eq("orgao_cod", varreduraKey)
          .maybeSingle();
        if (est && !est.completa && (est.ultima_pagina ?? 0) > 0) {
          paginaInicial = (est.ultima_pagina ?? 0) + 1;
          totalAcumulado = est.total_importado ?? 0;
        }
      }

      const inicio = Date.now();
      const contratosRodada: Contrato[] = [];
      const fornecedoresRodada = new Map<string, Fornecedor>();
      const erros: string[] = [];
      let ultimaPaginaVarrida = paginaInicial - 1;
      let varreduraCompleta = false;
      let varreduraPersistida = true;
      let totalCorrigidos = 0;
      let totalDetalhes = 0;
      let totalDetalhesFalhos = 0;
      let totalSemFornecedor = 0;
      let orcamentoEsgotado = false;

      for (let n = 0; n < data.maxPaginas; n++) {
        if (Date.now() - inicio > data.orcamentoMs) {
          orcamentoEsgotado = true;
          break;
        }
        const pagina = paginaInicial + n;
        const params: Record<string, string> = {
          codigoOrgao: data.codigoOrgao,
          pagina: String(pagina),
        };
        if (temJanela) {
          // dataInicial/dataFinal filtram por vigência (formato BR DD/MM/YYYY).
          params.dataInicial = isoToBR(data.dataInicial!);
          params.dataFinal = isoToBR(data.dataFinal!);
        }
        const urlPagina = `${PORTAL_BASE}/contratos?${new URLSearchParams(params).toString()}`;
        let list: PortalContrato[];
        let paginaLidaEm = new Date().toISOString();
        try {
          list = await portalGet<PortalContrato[]>("/contratos", params);
          paginaLidaEm = new Date().toISOString();
        } catch (e) {
          const msg = (e as Error).message;
          erros.push(`p${pagina}: ${msg}`);
          if (msg.includes("JSON inválido") || msg.includes("não-JSON")) {
            if (data.delayMs > 0) await sleep(data.delayMs);
            continue;
          }
          break;
        }
        if (data.delayMs > 0) await sleep(data.delayMs);
        if (!Array.isArray(list) || list.length === 0) {
          varreduraCompleta = true;
          break;
        }

        // Uma linha de log por requisição (a da página + uma por detalhe).
        const reqLogs: LogRequisicao[] = [
          {
            fonte: "cgu",
            orgao_cod: data.codigoOrgao,
            escopo: base.sigla,
            log_kind: "requisicao",
            endpoint: `GET ${urlPagina}`,
            total_bruto: list.length,
            importados: list.length,
            erros: [],
            consultado_em: new Date().toISOString(),
            user_id: context.userId,
          },
        ];

        const contratosPagina: Contrato[] = [];
        const valorInicialPorIdPagina = new Map<string, number>();
        const fornecedoresPagina = new Map<string, Fornecedor>();
        const numeroPorIdPagina = new Map<string, string>();
        const paginaPorId = new Map<string, number>();
        const findingsPagina: QaFinding[] = [];

        for (const raw of list) {
          // Janela de vigência: a API devolve contratos cuja vigência se
          // sobrepõe à janela; guardamos só os com INÍCIO de vigência DENTRO
          // dela. Filtra ANTES de conferir o detalhe (economiza requisições).
          if (temJanela) {
            const iv = parseDate(raw.dataInicioVigencia); // ISO YYYY-MM-DD ou ""
            if (!iv || iv < data.dataInicial! || iv > data.dataFinal!) continue;
          }
          // Fornecedor sigiloso/ausente: NÃO descarta — salva com placeholder e
          // abre um alerta `fornecedor_ausente` para investigação.
          const fornReal = fornecedorDeRaw(raw);
          const semFornecedor = !fornReal;
          const forn = fornReal ?? FORNECEDOR_AUSENTE;

          const listValores = normalizarValoresCguListagem(
            raw.valorInicialCompra,
            raw.valorFinalCompra,
          );
          let valorFinal = listValores.valorFinal;
          let valorInicial = listValores.valorInicial;
          let truncadoFinal: number | null = null;
          const idStr = raw.id != null ? String(raw.id) : null;

          if (idStr) {
            const urlDet = `${PORTAL_BASE}/contratos/id?id=${encodeURIComponent(idStr)}`;
            try {
              const det = await fetchDetalheContrato(idStr);
              totalDetalhes++;
              if (data.delayMs > 0) await sleep(data.delayMs);
              // Valor autoritativo = o NÃO-truncado (listagem ou detalhe). O bug
              // de escala ÷10000 aparece em qualquer um dos dois endpoints.
              const finalAut = valorAutoritativoCgu(listValores.valorFinal, det.valorFinal);
              const inicialAut = valorAutoritativoCgu(listValores.valorInicial, det.valorInicial);
              valorFinal = finalAut.valor;
              valorInicial = inicialAut.valor;
              truncadoFinal = finalAut.truncado;
              const corrigido = truncadoFinal != null;
              reqLogs.push({
                fonte: "cgu",
                orgao_cod: data.codigoOrgao,
                escopo: base.sigla,
                log_kind: "requisicao",
                endpoint: `GET ${urlDet}`,
                total_bruto: 1,
                importados: 1,
                erros: corrigido
                  ? [
                      `info: valor_corrigido_listagem id=${idStr} truncado=${truncadoFinal} correto=${valorFinal} (listagem=${listValores.valorFinal} detalhe=${det.valorFinal})`,
                    ]
                  : [],
                consultado_em: new Date().toISOString(),
                user_id: context.userId,
              });
              if (corrigido) {
                totalCorrigidos++;
                findingsPagina.push(
                  findingValorCorrigidoListagem({
                    id: idStr,
                    orgao_cod: data.codigoOrgao,
                    valor_truncado: truncadoFinal!,
                    valor_correto: valorFinal,
                    valor_listagem: listValores.valorFinal || null,
                    valor_detalhe: det.valorFinal || null,
                    pagina_varredura: pagina,
                    razao: finalAut.razao,
                    evidencia_bruta: [
                      {
                        origem: "listagem",
                        valorFinal: listValores.valorFinal,
                        valorInicial: listValores.valorInicial,
                        em: paginaLidaEm,
                      },
                      {
                        origem: "detalhe",
                        valorFinal: det.valorFinal,
                        valorInicial: det.valorInicial,
                        em: det.em,
                        rawSnippet: det.rawSnippet,
                      },
                    ],
                  }),
                );
              }
            } catch (e) {
              const msg = (e as Error).message;
              totalDetalhesFalhos++;
              erros.push(`detalhe ${idStr}: ${msg}`);
              reqLogs.push({
                fonte: "cgu",
                orgao_cod: data.codigoOrgao,
                escopo: base.sigla,
                log_kind: "requisicao",
                endpoint: `GET ${urlDet}`,
                total_bruto: 1,
                importados: 0,
                erros: [msg],
                consultado_em: new Date().toISOString(),
                user_id: context.userId,
              });
              if (data.delayMs > 0) await sleep(data.delayMs);
              // Detalhe indisponível: cai para o valor da listagem (não bloqueia).
            }
          }

          const contrato = construirContratoCgu(
            raw,
            data.codigoOrgao,
            forn.cnpj,
            valorFinal,
            valorInicial,
            new Date().getFullYear(),
          );
          contratosPagina.push(contrato);
          fornecedoresPagina.set(forn.cnpj, forn);
          if (valorInicial > 0) valorInicialPorIdPagina.set(contrato.id, valorInicial);
          if (raw.numero) numeroPorIdPagina.set(contrato.id, raw.numero);
          if (idStr) paginaPorId.set(idStr, pagina);
          if (semFornecedor) {
            totalSemFornecedor++;
            findingsPagina.push(
              findingFornecedorAusente({
                id: contrato.id,
                orgao_cod: data.codigoOrgao,
                pagina_varredura: idStr ? pagina : null,
              }),
            );
          }
        }

        // ---- PERSISTÊNCIA INCREMENTAL (sobrevive a kill do servidor) ----
        await upsertFornecedoresCache(fornecedoresPagina);
        erros.push(
          ...(await upsertContratosCache(
            contratosPagina,
            valorInicialPorIdPagina,
            numeroPorIdPagina,
          )),
        );
        try {
          // regrasCgu lê o cache pós-upsert (agora com o valor não-truncado).
          await sincronizarQaCgu(
            contratosPagina.map((c) => c.id),
            paginaPorId,
          );
        } catch (e) {
          erros.push(`qa: ${(e as Error).message}`);
        }
        if (findingsPagina.length > 0) {
          try {
            // valor_corrigido_listagem (corrigido_automaticamente) + fornecedor_ausente.
            await flagQA(findingsPagina);
          } catch (e) {
            erros.push(`qa_alertas: ${(e as Error).message}`);
          }
        }
        try {
          await inserirLogsRequisicao(reqLogs);
        } catch (e) {
          erros.push(`log: ${(e as Error).message}`);
        }

        ultimaPaginaVarrida = pagina;
        totalAcumulado += contratosPagina.length;
        // Avança o ponteiro ANTES de ir para a próxima página, para retomar
        // exatamente daqui se o servidor for morto no meio.
        const pv = await persistirVarredura(
          varreduraKey,
          ultimaPaginaVarrida,
          false,
          totalAcumulado,
        );
        varreduraPersistida = pv.persistida;
        if (pv.erro) erros.push(pv.erro);

        contratosRodada.push(...contratosPagina);
        for (const [k, v] of fornecedoresPagina) fornecedoresRodada.set(k, v);

        if (list.length < TAM_PAGINA) {
          varreduraCompleta = true;
          break;
        }
      }

      // Estado final da varredura (marca completa quando chegou ao fim).
      {
        const pv = await persistirVarredura(
          varreduraKey,
          ultimaPaginaVarrida,
          varreduraCompleta,
          totalAcumulado,
        );
        varreduraPersistida = pv.persistida;
        if (pv.erro) erros.push(pv.erro);
      }

      const haMais = !varreduraCompleta;
      const consultadoEm = new Date().toISOString();
      const avisos: string[] = [];
      avisos.push(
        `info: detalhes conferidos ${totalDetalhes}${totalDetalhesFalhos ? `, falharam ${totalDetalhesFalhos}` : ""}; valores corrigidos pela conferência ${totalCorrigidos}${totalSemFornecedor ? `; ${totalSemFornecedor} sem fornecedor (salvos + alerta fornecedor_ausente)` : ""}`,
      );
      const rotuloModo = temJanela ? "janela" : "varredura";
      if (haMais) {
        avisos.push(
          varreduraPersistida
            ? `info: ${rotuloModo} parcial (até pág. ${ultimaPaginaVarrida}${orcamentoEsgotado ? ", tempo da rodada esgotado" : ""}) — há mais contratos; continue para baixar o restante.`
            : `info: ${rotuloModo} parcial (até pág. ${ultimaPaginaVarrida}) — a tabela cgu_varredura não existe (migração pendente), então NÃO retoma. Aplique a migração.`,
        );
      }
      // Log da RODADA (uma linha, log_kind NULL → aparece no Histórico).
      const datasAssinatura = contratosRodada
        .map((c) => c.dataAssinatura)
        .filter((d): d is string => !!d)
        .sort();
      await supabaseAdmin.from("importacoes").insert({
        fonte: "cgu",
        orgao_cod: data.codigoOrgao,
        escopo: base.sigla,
        data_inicial: temJanela ? data.dataInicial! : (datasAssinatura[0] ?? null),
        data_final: temJanela
          ? data.dataFinal!
          : (datasAssinatura[datasAssinatura.length - 1] ?? null),
        total_bruto: contratosRodada.length,
        importados: contratosRodada.length,
        erros: [...erros, ...avisos],
        consultado_em: consultadoEm,
        user_id: context.userId,
        endpoint: `GET ${PORTAL_BASE}/contratos?codigoOrgao=${data.codigoOrgao}${temJanela ? `&dataInicial=${isoToBR(data.dataInicial!)}&dataFinal=${isoToBR(data.dataFinal!)}` : ""} (varredura por detalhe${temJanela ? ` [vigência ${data.dataInicial}→${data.dataFinal}]` : ""}, pág. ${paginaInicial}–${ultimaPaginaVarrida}${varreduraCompleta ? " — completa" : " — parcial"})`,
      });

      return {
        orgaos: [base] as Orgao[],
        fornecedores: [...fornecedoresRodada.values()],
        contratos: contratosRodada,
        meta: {
          totalBruto: contratosRodada.length,
          importados: contratosRodada.length,
          erros: [...erros, ...avisos],
          fonte: "Portal da Transparência (CGU)",
          consultadoEm,
          varredura: {
            ultimaPagina: ultimaPaginaVarrida,
            completa: varreduraCompleta,
            haMais,
            totalAcumulado,
            corrigidos: totalCorrigidos,
            orcamentoEsgotado,
          },
        },
      };
    }
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
 * Órgãos da CGU com varredura incompleta (há mais contratos a baixar). Alimenta
 * o aviso persistente na aba Portal CGU. Tolerante à migração ainda não
 * aplicada (tabela ausente → lista vazia).
 */
export type VarreduraIncompleta = {
  /** Entidade da varredura (contratos, licitacoes, …). Ver `sweep.ts`. */
  entidade: string;
  orgaoCod: string;
  ultimaPagina: number;
  /** Janela de vigência (ISO), quando a varredura é por período. */
  dataInicial?: string;
  dataFinal?: string;
};

export const listarVarredurasIncompletas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({ context }): Promise<{ varreduras: VarreduraIncompleta[]; tabelaAusente: boolean }> => {
      await ensureAdmin(context.userId);
      const { data, error } = await supabaseAdmin
        .from("cgu_varredura")
        .select("orgao_cod, ultima_pagina")
        .eq("completa", false)
        .gt("ultima_pagina", 0);
      if (error) {
        // Migração `cgu_varredura` ainda não aplicada: as varreduras RODAM mas
        // não retomam de onde pararam. Sinalizamos para o admin ver o aviso em
        // vez de falhar silenciosamente.
        if (tabelaVarreduraAusente(error)) return { varreduras: [], tabelaAusente: true };
        throw new Error(error.message);
      }
      // A chave compõe entidade + órgão + janela opcional (ver `parseVarreduraKey`
      // em `sweep.ts`). Devolvemos TODAS as entidades; cada aba filtra a sua.
      const varreduras = (data ?? []).map((r): VarreduraIncompleta => {
        const { entidade, orgaoCod, dataInicial, dataFinal } = parseVarreduraKey(
          String(r.orgao_cod),
        );
        return {
          entidade,
          orgaoCod,
          ultimaPagina: r.ultima_pagina,
          ...(dataInicial && dataFinal ? { dataInicial, dataFinal } : {}),
        };
      });
      return { varreduras, tabelaAusente: false };
    },
  );

/**
 * Histórico unificado de importações. Após a unificação do esquema, todas
 * as fontes (CGU, PNCP, Câmara, Senado, Siconfi, Transferegov) gravam na
 * mesma tabela `importacoes`. Campos específicos do Portal CGU
 * (orgao_cod, data_inicial, data_final) ficam NULL para as demais.
 */
/** Aceita só os valores que o classificador conhece — linhas antigas viram null. */
function ehResultadoConhecido(v: string | null | undefined): boolean {
  return typeof v === "string" && (RESULTADOS as readonly string[]).includes(v);
}

export type HistoricoEntrada = {
  id: string;
  fonte: string; // ex. "CGU", "PNCP", "Câmara CEAP"
  escopo: string; // ex. sigla do órgão, ou "—"
  periodo: string; // ex. "01/2024 → 01/2024" ou "Mar/2024"
  bruto: number | null; // total bruto retornado pela API (quando disponível)
  importados: number;
  erros: string[]; // falhas reais (timeouts, db, qa errors)
  avisos: string[]; // notas informativas (ex.: correção automática)
  quando: string; // ISO
  endpoint: string | null; // URL/endpoint efetivamente consultado
  /**
   * Como ler o `importados` (ver `resultado-rodada.ts`). `null` em linhas
   * anteriores à v0.6.0 — não dá para apurar a classificação retroativamente.
   */
  resultado: ResultadoClassificado | null;
};

const MESES_CURTO = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

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
      .select(
        "id,fonte,escopo,orgao_cod,ano,mes,data_inicial,data_final,total_bruto,importados,erros,consultado_em,endpoint,resultado",
      )
      // Exclui as linhas de REQUISIÇÃO da varredura por detalhe (uma por GET) —
      // elas inundariam o Histórico. Mantém as linhas de rodada (log_kind NULL).
      .or("log_kind.is.null,log_kind.neq.requisicao")
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
      const isAnual = r.fonte === "cgu_emendas";
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
        resultado: ehResultadoConhecido((r as { resultado?: string | null }).resultado)
          ? ((r as { resultado?: string | null }).resultado as ResultadoClassificado)
          : null,
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
        cgu_licitacoes: "cgu_licitacoes",
        cgu_emendas: "cgu_emendas",
        cgu_convenios: "cgu_convenios",
        camara_ceap: "camara_ceap",
        senado_ceaps: "senado_ceaps",
        pncp: "pncp",
        siconfi: "siconfi",
        transferegov: "transferegov",
      };
      /** Caches que a fonte TSE alimenta — usados para decidir se ela zerou. */
      const TABELAS_CACHE_TSE = [
        "tse_candidatos_cache",
        "tse_bens_candidato_cache",
        "tse_resultados_cache",
        "tse_receitas_campanha_cache",
        "tse_despesas_campanha_cache",
        "tse_parlamentar_candidato",
      ] as const satisfies readonly TabelaLimpeza[];

      const tabelaVazia = async (t: TabelaLimpeza): Promise<boolean> => {
        // head+count: não traz linha nenhuma e não depende de existir coluna
        // `id` — as tabelas do TSE têm PK composta.
        const { count, error } = await supabaseAdmin
          .from(t)
          .select("*", { count: "exact", head: true });
        if (error) throw new Error(`${t} contagem: ${error.message}`);
        return (count ?? 0) === 0;
      };

      const apagarFindingsDaFonte = async (qaFonte: string): Promise<number> => {
        const { data: qaIds, error: qaErr } = await supabaseAdmin
          .from("qa_findings")
          .select("id")
          .eq("fonte", qaFonte)
          .limit(100000);
        if (qaErr) throw new Error(`qa_findings ids(${qaFonte}): ${qaErr.message}`);
        const ids = (qaIds ?? []).map((r) => r.id);
        // Lacunas antes dos findings: a FK origem_qa_finding_id ficaria órfã.
        for (let i = 0; i < ids.length; i += 500) {
          const lr = await supabaseAdmin
            .from("lacunas")
            .delete({ count: "exact" })
            .in("origem_qa_finding_id", ids.slice(i, i + 500));
          if (lr.error) throw new Error(`lacunas(${qaFonte}): ${lr.error.message}`);
        }
        const r = await supabaseAdmin
          .from("qa_findings")
          .delete({ count: "exact" })
          .eq("fonte", qaFonte);
        if (r.error) throw new Error(`qa_findings(${qaFonte}): ${r.error.message}`);
        return r.count ?? 0;
      };

      /**
       * Sinais do TSE — não dá para usar o prune genérico.
       *
       * O genérico casa `qa_findings.entidade_id` com a coluna `id` da tabela.
       * No TSE não existe coluna `id` (PK composta) e o `entidade_id` é
       * derivado: "<sq>-<ano>" para candidatura, "<tipo>-<id>" para a ponte
       * parlamentar — que nem sequer vive num cache de candidato.
       *
       * Então a regra aqui é de tudo-ou-nada, e deliberadamente conservadora:
       * só apaga os sinais quando TODOS os caches da fonte estão vazios. Cinco
       * fontes de limpeza (candidatos, bens, resultados, receitas, despesas)
       * compartilham a mesma `fonte='tse'`; apagar os sinais ao limpar só uma
       * delas derrubaria alertas sobre dados que continuam lá.
       */
      const podarSinaisTse = async () => {
        for (const t of TABELAS_CACHE_TSE) {
          if (!(await tabelaVazia(t))) {
            removed["qa_findings:tse"] =
              `mantidos — ${t} ainda tem dados (sinais do TSE só são apagados quando todos os caches da fonte estão vazios)`;
            return;
          }
        }
        for (const qaFonte of ["tse", "tse-cruzamento"]) {
          removed[`qa_findings:${qaFonte}`] = await apagarFindingsDaFonte(qaFonte);
        }
      };

      const pruneQaFindings = async (qaFonte: string, table: TabelaLimpeza) => {
        // Coleta ids ainda presentes na tabela-fonte e remove qualquer
        // qa_findings cujo entidade_id não exista mais (alerta órfão).
        const { data: rem, error: remErr } = await supabaseAdmin
          .from(table)
          .select("id")
          .limit(100000);
        if (remErr) throw new Error(`${table} qa-prune select: ${remErr.message}`);
        const remSet = new Set(
          (rem ?? []).map((r) => String((r as unknown as { id: unknown }).id)),
        );
        if (remSet.size === 0) {
          // Apaga lacunas geradas por findings dessa fonte antes dos findings
          // (a FK origem_qa_finding_id ficaria órfã).
          const { data: qaIds, error: qaIdsErr } = await supabaseAdmin
            .from("qa_findings")
            .select("id")
            .eq("fonte", qaFonte)
            .limit(100000);
          if (qaIdsErr) throw new Error(`qa_findings ids: ${qaIdsErr.message}`);
          const ids = (qaIds ?? []).map((r) => r.id);
          let lacCnt = 0;
          for (let i = 0; i < ids.length; i += 500) {
            const slice = ids.slice(i, i + 500);
            const lr = await supabaseAdmin
              .from("lacunas")
              .delete({ count: "exact" })
              .in("origem_qa_finding_id", slice);
            if (lr.error) throw new Error(`lacunas: ${lr.error.message}`);
            lacCnt += lr.count ?? 0;
          }
          removed[`lacunas:${qaFonte}`] = lacCnt;
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
        // Remove lacunas que apontam para esses findings antes de apagá-los.
        let lacCnt = 0;
        for (let i = 0; i < toDelete.length; i += 500) {
          const slice = toDelete.slice(i, i + 500);
          const lr = await supabaseAdmin
            .from("lacunas")
            .delete({ count: "exact" })
            .in("origem_qa_finding_id", slice);
          if (lr.error) throw new Error(`lacunas: ${lr.error.message}`);
          lacCnt += lr.count ?? 0;
        }
        removed[`lacunas:${qaFonte}`] = lacCnt;
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
      /**
       * Apaga a tabela principal da fonte.
       *
       * Caminho preferido: as RPCs de manutenção, que rodam com orçamento de
       * tempo próprio — `truncar_cache` nem percorre linhas. Um DELETE único
       * pelo PostgREST estourava o statement_timeout em tabelas grandes
       * (492 mil candidaturas do TSE já batiam no limite).
       *
       * Fica no caminho antigo quem a RPC não cobre: `importacoes` (filtros de
       * sub-modo), fontes com `extraEq` e recortes por data. São tabelas
       * pequenas ou seletivas, onde o DELETE cabe no tempo.
       *
       * Devolver `null` significa "use o DELETE" — inclusive quando a RPC ainda
       * não existe no banco. A migration entra em produção depois do código, e
       * tornar a RPC obrigatória quebraria a limpeza inteira nesse intervalo:
       * preferência, não dependência.
       */
      // Só quando a RPC existe mas o banco ainda não a tem — não vale para os
      // casos que a RPC nunca cobriu.
      let rpcAusente = false;
      const apagarPrincipal = async (fonte: FonteLimpeza): Promise<number | null> => {
        if (fonte.logKind || fonte.extraEq) return null;
        if (periodoAtivo && fonte.dateCol) return null;
        if (periodoAtivo && !fonte.yearCol) return null;

        if (periodoAtivo && fonte.yearCol) {
          const { data: n, error } = await supabaseAdmin.rpc("limpar_cache_por_ano", {
            _tabela: fonte.table,
            _ano_col: fonte.yearCol,
            _ano_ini: anoIni!,
            _ano_fim: anoFim!,
          });
          if (funcaoRpcAusente(error)) {
            rpcAusente = true;
            return null;
          }
          if (error) throw new Error(`${fonte.table}: ${error.message}`);
          return Number(n ?? 0);
        }
        const { data: n, error } = await supabaseAdmin.rpc("truncar_cache", {
          _tabela: fonte.table,
        });
        if (funcaoRpcAusente(error)) {
          rpcAusente = true;
          return null;
        }
        if (error) throw new Error(`${fonte.table}: ${error.message}`);
        return Number(n ?? 0);
      };

      /**
       * Uma fonte que falha não pode levar as outras junto.
       *
       * Antes, o primeiro `throw` saía da função inteira: as fontes seguintes
       * da seleção nunca rodavam e o usuário via um toast citando uma tabela,
       * sem saber que as outras tinham sido puladas — enquanto as anteriores já
       * estavam commitadas (cada DELETE do PostgREST é uma transação própria).
       * Agora cada fonte reporta o que apagou ou por que falhou.
       */
      const falhas: Record<string, string> = {};

      for (const fid of data.fontes) {
        if (!FONTE_IDS.includes(fid)) continue;
        const fonte = FONTES_LIMPEZA.find((f) => f.id === fid)!;
        const tName = fonte.table as TabelaLimpeza;

        try {
          // Resolver filtro por período
          let parentIdsForChild: Array<string | number> | null = null;
          const buildQuery = () => {
            let q = supabaseAdmin.from(tName).delete({ count: "exact" });
            if (periodoAtivo && fonte.yearCol) {
              q = q.gte(fonte.yearCol, anoIni!).lte(fonte.yearCol, anoFim!);
            } else if (periodoAtivo && fonte.dateCol) {
              q = q.gte(fonte.dateCol, `${anoIni}-01-01`).lte(fonte.dateCol, `${anoFim}-12-31`);
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
                  fonte.pk ??
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
              q = q.filter("importados", "eq", 0).filter("erros", "eq", "[]");
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
            parentIdsForChild = (pRows ?? [])
              .map((r) => (r as unknown as Record<string, string | number>)[fonte.parentPk!])
              .filter((v) => v != null);
            if (parentIdsForChild.length > 0) {
              const cName = fonte.childTable as TabelaLimpeza;
              // chunk de 500 ids
              let childCount = 0;
              for (let i = 0; i < parentIdsForChild.length; i += 500) {
                const slice = parentIdsForChild.slice(i, i + 500);
                const r = await supabaseAdmin
                  .from(cName)
                  .delete({ count: "exact" })
                  .in(fonte.childRef!, slice);
                if (r.error) throw new Error(`${fonte.childTable}: ${r.error.message}`);
                childCount += r.count ?? 0;
              }
              removed[fonte.childTable!] = childCount;
            } else {
              removed[fonte.childTable!] = 0;
            }
          }

          const viaRpc = await apagarPrincipal(fonte);
          if (viaRpc !== null) {
            removed[fonte.table] = viaRpc;
          } else {
            const r = await buildQuery();
            if (r.error) throw new Error(`${fonte.table}: ${r.error.message}`);
            removed[fonte.table] = r.count ?? 0;
          }

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
            if (tr.error)
              throw new Error(`importacoes(${fonte.tentativaFonte}): ${tr.error.message}`);
            removed[`importacoes:${fonte.tentativaFonte}`] = tr.count ?? 0;
          }

          // Remove suspeitas de qualidade órfãs dessa fonte.
          const qaFonte = QA_FONTE_MAP[fid];
          if (qaFonte) {
            await pruneQaFindings(qaFonte, tName);
          }

          // A ponte parlamentar↔candidato é DERIVADA do catálogo de candidatos:
          // sem candidatos, cada vínculo aponta para um sq_candidato que não
          // existe mais. Some junto, como a varredura — não é uma fonte que o
          // admin escolhe limpar, é um subproduto.
          if (fid === "tse_candidatos" && !periodoAtivo) {
            const pr = await supabaseAdmin
              .from("tse_parlamentar_candidato")
              .delete({ count: "exact" })
              .not("sq_candidato", "is", null);
            if (pr.error) throw new Error(`tse_parlamentar_candidato: ${pr.error.message}`);
            removed["tse_parlamentar_candidato"] = pr.count ?? 0;
          }

          // TSE: zera o estado retomável (tse_varredura) da entidade limpa,
          // senão a reimportação pularia linhas de um cache que não existe mais.
          if (fid.startsWith("tse_")) {
            const tipoTse = fid.slice(4); // tse_candidatos → candidatos
            const vr = await supabaseAdmin
              .from("tse_varredura")
              .delete({ count: "exact" })
              .like("chave", `${tipoTse}#%`);
            if (vr.error && !tabelaVarreduraAusente(vr.error)) {
              throw new Error(`tse_varredura: ${vr.error.message}`);
            }
            removed[`tse_varredura:${tipoTse}`] = vr.error
              ? "ausente (migração pendente)"
              : (vr.count ?? 0);
          }

          // CGU: zera o estado da varredura retomável, senão uma reimportação
          // continuaria de uma página obsoleta em vez de varrer do início.
          // Tolerante à migração ainda não aplicada (tabela ausente = nada a zerar).
          if (fid === "cgu") {
            const vr = await supabaseAdmin
              .from("cgu_varredura")
              .delete({ count: "exact" })
              .not("orgao_cod", "is", null);
            if (vr.error && !tabelaVarreduraAusente(vr.error)) {
              throw new Error(`cgu_varredura: ${vr.error.message}`);
            }
            removed["cgu_varredura"] = vr.error ? "ausente (migração pendente)" : (vr.count ?? 0);
          }
        } catch (e) {
          falhas[fonte.label] = e instanceof Error ? e.message : String(e);
        }
      }

      // Uma vez só, depois de todas as fontes: os sinais do TSE dependem do
      // estado final de vários caches, não do de uma fonte isolada.
      if (data.fontes.some((f) => f.startsWith("tse_"))) {
        try {
          await podarSinaisTse();
        } catch (e) {
          falhas["Sinais do TSE"] = e instanceof Error ? e.message : String(e);
        }
      }
      if (rpcAusente) {
        // Funcionou, mas pelo caminho lento — que é justamente o que estoura o
        // tempo em tabela grande. Dizer isso agora evita o diagnóstico errado
        // ("a limpeza é instável") quando o timeout voltar.
        removed["migrations pendentes"] =
          "limpeza usou DELETE (as funções truncar_cache/limpar_cache_por_ano ainda não existem no banco — rode supabase db push)";
      }
      return {
        ok: Object.keys(falhas).length === 0,
        removed,
        falhas: Object.keys(falhas).length > 0 ? falhas : undefined,
      };
    }

    // ============ MODO LEGADO ============
    if (data.contratos) {
      const { error, count } = await supabaseAdmin
        .from("contratos_cache")
        .delete({ count: "exact" })
        .not("id", "is", null);
      if (error) throw new Error(`contratos_cache: ${error.message}`);
      removed.contratos = count ?? "ok";
      const vr = await supabaseAdmin
        .from("cgu_varredura")
        .delete({ count: "exact" })
        .not("orgao_cod", "is", null);
      if (vr.error && !tabelaVarreduraAusente(vr.error)) {
        throw new Error(`cgu_varredura: ${vr.error.message}`);
      }
      removed["cgu_varredura"] = vr.error ? "ausente (migração pendente)" : (vr.count ?? 0);
    }
    if (data.cache) {
      const f = await supabaseAdmin
        .from("fornecedores_cache")
        .delete({ count: "exact" })
        .not("cnpj", "is", null);
      if (f.error) throw new Error(`fornecedores_cache: ${f.error.message}`);
      removed.fornecedores = f.count ?? "ok";
      const o = await supabaseAdmin
        .from("orgaos_cache")
        .delete({ count: "exact" })
        .not("cod", "is", null);
      if (o.error) throw new Error(`orgaos_cache: ${o.error.message}`);
      removed.orgaos = o.count ?? "ok";
      // Demais caches consultados pela matriz de cobertura
      const extras: Array<{
        table:
          | "camara_despesas_cache"
          | "camara_votacoes_cache"
          | "camara_votos_cache"
          | "senado_despesas_cache"
          | "senado_votacoes_cache"
          | "senado_votos_cache"
          | "pncp_contratos_cache"
          | "siconfi_relatorios_cache"
          | "transferegov_instrumentos_cache";
        key: string;
      }> = [
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
      // Antes, apaga as lacunas geradas a partir delas para não deixar FK órfã.
      const lac = await supabaseAdmin
        .from("lacunas")
        .delete({ count: "exact" })
        .not("origem_qa_finding_id", "is", null);
      if (lac.error) throw new Error(`lacunas: ${lac.error.message}`);
      removed.lacunas = lac.count ?? 0;
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

export const diagnosticarPortalPagina = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        codigoOrgao: z.string().regex(/^\d{4,6}$/),
        // Datas opcionais: a varredura da CGU não usa janela (filtra vigência).
        // O diagnóstico inspeciona a página exatamente como o import a recebe.
        dataInicial: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        dataFinal: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        pagina: z.number().int().min(1).max(2000).default(1),
        filtrarId: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);
    const params: Record<string, string> = {
      codigoOrgao: data.codigoOrgao,
      pagina: String(data.pagina),
    };
    if (data.dataInicial && data.dataFinal) {
      params.dataInicial = isoToBR(data.dataInicial);
      params.dataFinal = isoToBR(data.dataFinal);
    }
    const qs = new URLSearchParams(params).toString();
    const urlConsultada = `https://api.portaldatransparencia.gov.br/api-de-dados/contratos?${qs}`;
    const { data: list, rawText } = await portalGetComTexto<PortalContrato[]>("/contratos", params);
    const contratos = Array.isArray(list) ? list : [];
    const zerosMatches = rawText.match(/\b\d+\.\d{4,}\b/g);
    const numerosComDecimaisNoJson = zerosMatches ? [...new Set(zerosMatches)] : [];
    const resultado = (
      data.filtrarId ? contratos.filter((c) => String(c.id) === data.filtrarId) : contratos
    ).map((c) => {
      const { valorInicial, valorFinal } = normalizarValoresCguListagem(
        c.valorInicialCompra,
        c.valorFinalCompra,
      );
      const toRaw = (v: unknown): string | number | null =>
        v == null ? null : typeof v === "number" || typeof v === "string" ? v : String(v);
      return {
        id: c.id ?? null,
        dataAssinatura: c.dataAssinatura ?? null,
        valorFinalCompra_raw: toRaw(c.valorFinalCompra),
        valorInicialCompra_raw: toRaw(c.valorInicialCompra),
        valorFinal_parseado: valorFinal,
        valorInicial_parseado: valorInicial,
        objeto: (c.objeto ?? "").slice(0, 120),
      };
    });
    return {
      urlConsultada,
      totalNaPagina: contratos.length,
      numerosComDecimaisNoJson,
      contratos: resultado,
    };
  });

/**
 * Inspeciona o JSON cru de QUALQUER endpoint do Portal da Transparência, sem
 * mapeamento específico de entidade. É a ferramenta de de-risking (Fase 0): o
 * admin aponta para `/licitacoes`, `/emendas`, `/transferencias`, `/convenios`
 * etc. e recebe os NOMES DE CAMPO reais (chaves de topo + um nível aninhado),
 * uma amostra de itens crus e os números com 4+ casas decimais (candidatos ao
 * bug de escala ÷10000). Serve para TRAVAR a lista de campos antes de escrever
 * cada mapper — o passo de maior risco, pois os campos diferem por endpoint.
 *
 * `diagnosticarPortalPagina` continua sendo o inspetor específico de contratos
 * (parseia valores). Este é o genérico.
 */
export const diagnosticarPortalEndpoint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        // Caminho do endpoint sob /api-de-dados (ex.: "/licitacoes").
        endpoint: z.string().regex(/^\/[a-z0-9/-]{2,60}$/i),
        codigoOrgao: z
          .string()
          .regex(/^\d{4,6}$/)
          .optional(),
        dataInicial: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        dataFinal: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        // Como passar a janela à API: a maioria dos endpoints da CGU filtra em
        // BR (DD/MM/YYYY); alguns aceitam ISO. Default BR.
        datasBR: z.boolean().default(true),
        pagina: z.number().int().min(1).max(2000).default(1),
        amostra: z.number().int().min(1).max(10).default(3),
        // Parâmetros de query extras (ex.: ano, codigoIbge) por endpoint.
        params: z.record(z.string(), z.string()).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);
    const params: Record<string, string> = {
      pagina: String(data.pagina),
      ...(data.codigoOrgao ? { codigoOrgao: data.codigoOrgao } : {}),
      ...(data.params ?? {}),
    };
    if (data.dataInicial && data.dataFinal) {
      params.dataInicial = data.datasBR ? isoToBR(data.dataInicial) : data.dataInicial;
      params.dataFinal = data.datasBR ? isoToBR(data.dataFinal) : data.dataFinal;
    }
    const qs = new URLSearchParams(params).toString();
    const urlConsultada = `${PORTAL_BASE}${data.endpoint}?${qs}`;
    const { data: list, rawText } = await portalGetComTexto<unknown[]>(data.endpoint, params);
    const itens = Array.isArray(list) ? list : list != null ? [list] : [];

    // Chaves de topo + um nível aninhado (caminhos pontilhados), para travar os
    // nomes de campo. Amostra de até 50 itens cobre variação de presença.
    const chaves = new Set<string>();
    for (const it of itens.slice(0, 50)) {
      if (it && typeof it === "object" && !Array.isArray(it)) {
        for (const [k, v] of Object.entries(it as Record<string, unknown>)) {
          chaves.add(k);
          if (v && typeof v === "object" && !Array.isArray(v)) {
            for (const k2 of Object.keys(v as Record<string, unknown>)) chaves.add(`${k}.${k2}`);
          }
        }
      }
    }

    const zerosMatches = rawText.match(/\b\d+\.\d{4,}\b/g);
    const numerosComDecimaisNoJson = zerosMatches ? [...new Set(zerosMatches)].slice(0, 40) : [];

    return {
      urlConsultada,
      totalNaPagina: itens.length,
      // Lista de campos reais — copie daqui para escrever o mapper da entidade.
      camposDetectados: [...chaves].sort(),
      numerosComDecimaisNoJson,
      // Itens crus (primeiros N) como JSON identado, para inspeção dos formatos
      // de valor/data. String (não objeto) por ser sempre serializável e mais
      // legível no painel admin.
      amostra: itens.slice(0, data.amostra).map((it) => {
        const s = JSON.stringify(it, null, 2);
        return s.length > 4000 ? `${s.slice(0, 4000)}\n… (truncado)` : s;
      }),
    };
  });

/**
 * Busca UM contrato do cache por id. A página de detalhe usa isto como
 * fallback quando o contrato não está no dataset do cliente (que é limitado a
 * 10k linhas) — comum após varreduras grandes. Sem isso, contratos válidos
 * (inclusive os que geram alertas de QA) davam 404.
 */
export const getContratoPorId = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ id: z.string().min(1).max(120) }).parse(input))
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("contratos_cache")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return { contrato: null, fornecedor: null, orgao: null };
    const contrato: Contrato = {
      id: row.id,
      orgaoCod: row.orgao_cod,
      fornecedorCnpj: row.fornecedor_cnpj,
      objeto: row.objeto,
      modalidade: row.modalidade as Contrato["modalidade"],
      valor: Number(row.valor) || 0,
      ano: row.ano,
      dataAssinatura: row.data_assinatura ?? "",
      dataInicioVigencia: row.data_inicio_vigencia ?? "",
    };
    const [{ data: forn }, { data: org }] = await Promise.all([
      supabaseAdmin
        .from("fornecedores_cache")
        .select("cnpj,nome")
        .eq("cnpj", contrato.fornecedorCnpj)
        .maybeSingle(),
      supabaseAdmin.from("orgaos_cache").select("*").eq("cod", contrato.orgaoCod).maybeSingle(),
    ]);
    const fornecedor: Fornecedor | null = forn ? { cnpj: forn.cnpj, nome: forn.nome } : null;
    const orgao: Orgao | null = org
      ? {
          cod: org.cod,
          sigla: org.sigla ?? "",
          nome: org.nome,
          funcao: org.funcao ?? "",
          poder: org.poder as Orgao["poder"],
          disponivelPortal: org.disponivel_portal,
          nota: org.nota ?? undefined,
          ativo: org.ativo,
        }
      : null;
    return { contrato, fornecedor, orgao };
  });

export const loadStoredDataset = createServerFn({ method: "GET" }).handler(async () => {
  const [orgaosRes, fornRes, contRes] = await Promise.all([
    supabaseAdmin.from("orgaos_cache").select("*"),
    supabaseAdmin.from("fornecedores_cache").select("cnpj,nome"),
    supabaseAdmin.from("contratos_cache").select("*").limit(10000),
  ]);
  const orgaos: Orgao[] = (orgaosRes.data ?? []).map((o) => ({
    cod: o.cod,
    sigla: o.sigla ?? "",
    nome: o.nome,
    funcao: o.funcao ?? "",
    poder: o.poder as Orgao["poder"],
    disponivelPortal: o.disponivel_portal,
    nota: o.nota ?? undefined,
    ativo: o.ativo,
  }));
  const fornecedores: Fornecedor[] = (fornRes.data ?? []).map((f) => ({
    cnpj: f.cnpj,
    nome: f.nome,
  }));
  const contratos: Contrato[] = (contRes.data ?? []).map((c) => ({
    id: c.id,
    orgaoCod: c.orgao_cod,
    fornecedorCnpj: c.fornecedor_cnpj,
    objeto: c.objeto,
    modalidade: c.modalidade as Contrato["modalidade"],
    valor: Number(c.valor) || 0,
    ano: c.ano,
    dataAssinatura: c.data_assinatura ?? "",
    dataInicioVigencia: c.data_inicio_vigencia ?? "",
  }));
  return { orgaos, fornecedores, contratos };
});
