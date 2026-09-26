import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sanitizarTextoPublico } from "@/lib/sanitize";
import { regrasCguEmendas, type CguEmendaLike } from "@/lib/data/qa";
import { parseValorPortal, somarValoresInformados } from "@/lib/data/real/portal-client";
import {
  ensureAdmin,
  montarVarreduraKey,
  sleep,
  varrerPaginado,
  type SweepRodada,
} from "@/lib/data/real/sweep";
import { ehPeriodoRecente, type OrigemRodada } from "@/lib/data/historico-rodada";
import { linkConsultaEmendaPortal } from "@/lib/links-oficiais";

/**
 * Ingest do endpoint /emendas do Portal da Transparência (CGU).
 *
 * DIFERENTE das demais entidades: /emendas NÃO é por órgão — filtra por ANO.
 * Por isso a varredura é POR ANO, reaproveitando o motor `varrerPaginado`.
 *
 * ENRIQUECIMENTO (espelha o double-fetch dos contratos, mas em lote): o endpoint
 * /emendas traz o resumo (empenhado/liquidado/pago), mas não o plano de ação das
 * Transferências Especiais (EC 105). A API do Transferegov
 * (`transferenciasespeciais/plano_acao_especial`) traz custeio/investimento,
 * situação, beneficiário e áreas de política pública. Como essa API é
 * lista-por-ano (não por-id), buscamos o plano de ação do ano UMA vez, indexamos
 * por código da emenda e juntamos durante o mapeamento. Chave de junção:
 * codigoEmenda ↔ numero_emenda_parlamentar_plano_acao (ambos 12 dígitos).
 */

const BASE_PLANO_ACAO =
  "https://api.transferegov.dth.api.gov.br/transferenciasespeciais/plano_acao_especial";

type PortalEmenda = {
  codigoEmenda?: string;
  ano?: number | string;
  tipoEmenda?: string;
  autor?: string;
  nomeAutor?: string;
  numeroEmenda?: string;
  localidadeDoGasto?: string;
  funcao?: string;
  subfuncao?: string;
  valorEmpenhado?: unknown;
  valorLiquidado?: unknown;
  valorPago?: unknown;
  valorRestoInscrito?: unknown;
  valorRestoPago?: unknown;
  valorRestoCancelado?: unknown;
};

type DetalheEspecial = {
  planos_acao_count: number;
  valor_custeio: number | null;
  valor_investimento: number | null;
  beneficiario_nome: string | null;
  beneficiario_cnpj: string | null;
  plano_acao_situacao: string | null;
  areas_politicas: string | null;
};

type EmendaRow = {
  id: string;
  ano: number;
  tipo_emenda: string | null;
  autor: string | null;
  numero_emenda: string | null;
  localidade: string | null;
  uf: string | null;
  funcao: string | null;
  subfuncao: string | null;
  valor_empenhado: number | null;
  valor_liquidado: number | null;
  valor_pago: number | null;
  valor_resto_inscrito: number | null;
  valor_resto_pago: number | null;
  valor_resto_cancelado: number | null;
  // Detalhe de execução das Especiais (Transferegov), null nas demais.
  planos_acao_count: number | null;
  valor_custeio: number | null;
  valor_investimento: number | null;
  beneficiario_nome: string | null;
  beneficiario_cnpj: string | null;
  plano_acao_situacao: string | null;
  areas_politicas: string | null;
  url_oficial: string | null;
  updated_at: string;
};

function strOuNull(v: unknown): string | null {
  if (v == null) return null;
  const t = String(v).trim();
  return t === "" ? null : t;
}

/** UF de 2 letras ao fim da localidade ("LONDRINA - PR" → "PR"). */
function ufDeLocalidade(loc: string | undefined): string | null {
  if (!loc) return null;
  const m = loc.match(/-\s*([A-Za-z]{2})\s*$/);
  return m ? m[1].toUpperCase() : null;
}

/**
 * Busca o plano de ação das Transferências Especiais de um ano (API Transferegov,
 * lista paginada) e agrega por código da emenda. Best-effort: se a API falhar,
 * devolve o que já juntou (a ingestão segue sem o detalhe que faltou).
 *
 * `prazo` (instante, em ms) limita a busca: ela come o orçamento da rodada, e
 * sem limite podia levar mais de um minuto antes da primeira página de
 * emendas. `completa` diz se a lista chegou ao fim.
 */
async function buscarDetalheEspecialPorAno(
  ano: number,
  prazo: number,
): Promise<{ mapa: Map<string, DetalheEspecial>; completa: boolean }> {
  const acc = new Map<string, DetalheEspecial>();
  const limit = 500;
  const headers = {
    accept: "application/json",
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    "accept-encoding": "identity",
  };
  for (let pagina = 0; pagina < 80; pagina++) {
    if (pagina > 0) await sleep(1000);
    if (Date.now() > prazo) return { mapa: acc, completa: false };
    const qs = new URLSearchParams({
      ano_plano_acao: `eq.${ano}`,
      limit: String(limit),
      offset: String(pagina * limit),
    }).toString();
    let arr: Array<Record<string, unknown>> = [];
    try {
      const res = await fetch(`${BASE_PLANO_ACAO}?${qs}`, { headers });
      if (!res.ok) return { mapa: acc, completa: false };
      const json = await res.json();
      arr = Array.isArray(json) ? (json as Array<Record<string, unknown>>) : [];
    } catch {
      return { mapa: acc, completa: false };
    }
    if (arr.length === 0) return { mapa: acc, completa: true };
    for (const r of arr) {
      const key = strOuNull(r.numero_emenda_parlamentar_plano_acao);
      if (!key) continue;
      const cur = acc.get(key) ?? {
        planos_acao_count: 0,
        valor_custeio: null,
        valor_investimento: null,
        beneficiario_nome: null,
        beneficiario_cnpj: null,
        plano_acao_situacao: null,
        areas_politicas: null,
      };
      cur.planos_acao_count += 1;
      // Soma só os planos que informam o valor; nenhum informado = null.
      cur.valor_custeio = somarValoresInformados(
        cur.valor_custeio,
        parseValorPortal(r.valor_custeio_plano_acao),
      );
      cur.valor_investimento = somarValoresInformados(
        cur.valor_investimento,
        parseValorPortal(r.valor_investimento_plano_acao),
      );
      cur.beneficiario_nome ??=
        sanitizarTextoPublico(String(r.nome_beneficiario_plano_acao ?? "").slice(0, 160)) || null;
      cur.beneficiario_cnpj ??= strOuNull(r.cnpj_beneficiario_plano_acao);
      cur.plano_acao_situacao ??= strOuNull(r.situacao_plano_acao);
      cur.areas_politicas ??= strOuNull(r.codigo_descricao_areas_politicas_publicas_plano_acao);
      acc.set(key, cur);
    }
    if (arr.length < limit) return { mapa: acc, completa: true };
  }
  return { mapa: acc, completa: false };
}

function mapearEmenda(
  raw: PortalEmenda,
  anoFallback: number,
  detalhe: DetalheEspecial | undefined,
): EmendaRow {
  const id = String(
    raw.codigoEmenda ?? `${anoFallback}-${raw.numeroEmenda ?? Math.random().toString(36).slice(2)}`,
  );
  return {
    id,
    ano: Number(raw.ano ?? anoFallback) || anoFallback,
    tipo_emenda: raw.tipoEmenda || null,
    autor: raw.autor || raw.nomeAutor || null,
    numero_emenda: raw.numeroEmenda || null,
    localidade: raw.localidadeDoGasto || null,
    uf: ufDeLocalidade(raw.localidadeDoGasto),
    funcao: raw.funcao || null,
    subfuncao: raw.subfuncao || null,
    valor_empenhado: parseValorPortal(raw.valorEmpenhado),
    valor_liquidado: parseValorPortal(raw.valorLiquidado),
    valor_pago: parseValorPortal(raw.valorPago),
    valor_resto_inscrito: parseValorPortal(raw.valorRestoInscrito),
    valor_resto_pago: parseValorPortal(raw.valorRestoPago),
    valor_resto_cancelado: parseValorPortal(raw.valorRestoCancelado),
    // Detalhe de execução (só para as Especiais que casam no plano de ação).
    planos_acao_count: detalhe?.planos_acao_count ?? null,
    valor_custeio: detalhe?.valor_custeio ?? null,
    valor_investimento: detalhe?.valor_investimento ?? null,
    beneficiario_nome: detalhe?.beneficiario_nome ?? null,
    beneficiario_cnpj: detalhe?.beneficiario_cnpj ?? null,
    plano_acao_situacao: detalhe?.plano_acao_situacao ?? null,
    areas_politicas: detalhe?.areas_politicas ?? null,
    url_oficial: linkConsultaEmendaPortal(id),
    updated_at: new Date().toISOString(),
  };
}

/**
 * Parâmetros da importação — fonte única da validação: a casca autenticada e
 * o modo nomeado de `/api/cron-importar` usam este mesmo schema.
 */
export const importarEmendasSchema = z.object({
  ano: z.number().int().min(2013).max(2100),
  maxPaginas: z.number().int().min(1).max(5000).default(5000),
  delayMs: z.number().int().min(0).max(10000).default(800),
  orcamentoMs: z.number().int().min(10000).max(230000).default(180000),
});

export type ParamsEmendas = z.infer<typeof importarEmendasSchema>;

/** Chave de varredura do ano — a mesma para painel e ferramenta. */
export const chaveVarreduraEmendas = (p: { ano: number }) =>
  montarVarreduraKey("emendas", String(p.ano));

/** Fração do orçamento da rodada que a pré-busca do plano de ação pode usar. */
const FRACAO_DA_PRE_BUSCA = 0.5;

/**
 * Núcleo chamável sem sessão: UMA rodada da varredura de emendas de um ano.
 * Usado pela casca autenticada e pelo modo nomeado.
 *
 * A pré-busca do plano de ação conta no orçamento de tempo: ela pode usar até
 * metade dele, e a varredura fica com o que sobrar. Antes ela rodava fora do
 * orçamento, e uma rodada podia passar do limite do Worker. Pré-busca
 * incompleta (tempo ou falha da API) vira aviso `info:` — as emendas sem o
 * plano de ação ficam sem o detalhe, como já acontecia quando a API falhava.
 *
 * A linha de rodada marca a célula do ano na cobertura (`mes = 1`, âncora).
 */
export async function rodadaEmendas(
  data: ParamsEmendas,
  userId: string | null,
  origem: OrigemRodada = {},
): Promise<SweepRodada> {
  const inicio = Date.now();
  const prazo = inicio + data.orcamentoMs * FRACAO_DA_PRE_BUSCA;
  let detalhe: Awaited<ReturnType<typeof buscarDetalheEspecialPorAno>>;
  try {
    detalhe = await buscarDetalheEspecialPorAno(data.ano, prazo);
  } catch {
    detalhe = { mapa: new Map(), completa: false };
  }
  const detalheMap = detalhe.mapa;
  const gasto = Date.now() - inicio;
  const avisos = detalhe.completa
    ? []
    : [
        `info: plano de ação das Transferências Especiais incompleto nesta rodada (${detalheMap.size} emendas com detalhe, ${Math.round(gasto / 1000)}s) — as demais ficaram sem o detalhe.`,
      ];

  const TAM_PAGINA = 15;
  return varrerPaginado<PortalEmenda, EmendaRow>({
    entidade: "emendas",
    fonte: "cgu_emendas",
    endpoint: "/emendas",
    orgaoCodLog: "",
    // Linha única na matriz de cobertura; célula do ano (mês 1 é a âncora).
    escopo: "",
    ano: data.ano,
    mes: 1,
    // Fonte anual: recente é o ano que fechou há menos de dois meses.
    periodoRecente: ehPeriodoRecente(data.ano, 12),
    userId,
    origem,
    avisos,
    varreduraKey: chaveVarreduraEmendas(data),
    tamPagina: TAM_PAGINA,
    maxPaginas: data.maxPaginas,
    delayMs: data.delayMs,
    orcamentoMs: Math.max(0, data.orcamentoMs - gasto),
    montarParams: (pagina) => ({ ano: String(data.ano), pagina: String(pagina) }),
    mapPagina: (list, _pagina, push) => {
      const rows = list.map((raw) =>
        mapearEmenda(raw, data.ano, detalheMap.get(String(raw.codigoEmenda ?? ""))),
      );
      for (const f of regrasCguEmendas(rows as CguEmendaLike[])) push.finding(f);
      return rows;
    },
    upsertBatch: async (rows) => {
      const erros: string[] = [];
      for (let i = 0; i < rows.length; i += 200) {
        const chunk = rows.slice(i, i + 200);
        const { error } = await supabaseAdmin.from("cgu_transferegov_emendas_cache").upsert(chunk);
        if (error) erros.push(`db: ${error.message}`);
      }
      return erros;
    },
  });
}

export const importEmendas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => importarEmendasSchema.parse(input))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);
    const r = await rodadaEmendas(data, context.userId);
    return {
      meta: {
        totalBruto: r.totalAcumulado,
        importados: r.totalAcumulado,
        erros: [...r.erros, ...r.avisos],
        fonte: "Portal da Transparência (CGU) — Emendas",
        consultadoEm: new Date().toISOString(),
        varredura: {
          ultimaPagina: r.ultimaPagina,
          completa: r.completa,
          haMais: r.haMais,
          totalAcumulado: r.totalAcumulado,
          orcamentoEsgotado: r.orcamentoEsgotado,
        },
      },
    };
  });
