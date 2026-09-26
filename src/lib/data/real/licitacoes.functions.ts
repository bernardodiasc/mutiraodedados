import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sanitizarTextoPublico } from "@/lib/sanitize";
import { regrasCguLicitacoes, type CguLicitacaoLike } from "@/lib/data/qa";
import { parseValorPortal } from "@/lib/data/real/portal-client";
import {
  ensureAdmin,
  isoToBR,
  montarVarreduraKey,
  parseDatePortal,
  varrerPaginado,
  type SweepRodada,
} from "@/lib/data/real/sweep";
import { anoMesDaJanela, type OrigemRodada } from "@/lib/data/historico-rodada";
import { ORGAOS_BASE } from "@/lib/data/catalog";
import { linkConsultaLicitacaoPortal } from "@/lib/links-oficiais";

/**
 * Ingest do endpoint /licitacoes do Portal da Transparência (CGU).
 *
 * Entidade-tópico "Licitações". Varredura por órgão + janela (o endpoint exige
 * `dataInicial`/`dataFinal`), reaproveitando o motor genérico `varrerPaginado`
 * (sem a dupla-busca por detalhe que é específica de contratos). Campos travados
 * por inspeção ao vivo (de-risking Fase 0).
 *
 * Acoplamento PNCP: a API NÃO traz `numeroControlePNCP` — o cross-link para o
 * PNCP é um link de BUSCA por CNPJ do órgão + número (ver links-oficiais.ts).
 */

// Forma crua do item de /licitacoes (apenas os campos que usamos).
type PortalLicitacao = {
  id?: number | string;
  licitacao?: { numero?: string; objeto?: string; numeroProcesso?: string };
  dataAbertura?: string | null;
  dataPublicacao?: string | null;
  dataResultadoCompra?: string | null;
  situacaoCompra?: string;
  modalidadeLicitacao?: string;
  valor?: unknown;
  municipio?: {
    codigoIBGE?: string;
    nomeIBGE?: string;
    uf?: { sigla?: string; nome?: string };
  };
  unidadeGestora?: {
    nome?: string;
    orgaoMaximo?: { codigo?: string };
    orgaoVinculado?: { codigoSIAFI?: string; cnpj?: string };
  };
};

type LicitacaoRow = {
  id: string;
  orgao_cod: string;
  orgao_cnpj: string | null;
  unidade_gestora: string | null;
  ano: number;
  uf: string | null;
  municipio_ibge: string | null;
  municipio_nome: string | null;
  numero: string | null;
  numero_processo: string | null;
  objeto: string | null;
  modalidade: string | null;
  situacao: string | null;
  valor: number | null;
  data_abertura: string | null;
  data_publicacao: string | null;
  data_resultado: string | null;
  mes_referencia: number | null;
  url_oficial: string | null;
  updated_at: string;
};

/**
 * Sigla da UF de 2 letras. A API devolve o objeto `uf` com sigla/nome TROCADOS
 * (`{sigla:"RIO DE JANEIRO", nome:"RJ"}`), então pegamos qualquer um dos dois
 * que tenha exatamente 2 letras — robusto contra a troca.
 */
function ufDe(uf: { sigla?: string; nome?: string } | undefined): string | null {
  for (const cand of [uf?.nome, uf?.sigla]) {
    const s = (cand ?? "").trim();
    if (/^[A-Za-z]{2}$/.test(s)) return s.toUpperCase();
  }
  return null;
}

function mapearLicitacao(raw: PortalLicitacao, codigoOrgaoFallback: string): LicitacaoRow {
  const dataAbertura = parseDatePortal(raw.dataAbertura ?? undefined);
  const dataPublicacao = parseDatePortal(raw.dataPublicacao ?? undefined);
  const dataResultado = parseDatePortal(raw.dataResultadoCompra ?? undefined);
  const ref = dataAbertura || dataPublicacao;
  const ano = ref ? Number(ref.slice(0, 4)) : new Date().getFullYear();
  const orgaoCod = raw.unidadeGestora?.orgaoMaximo?.codigo || codigoOrgaoFallback;
  const id = String(
    raw.id ?? `${orgaoCod}-${raw.licitacao?.numero ?? Math.random().toString(36).slice(2)}`,
  );
  return {
    id,
    orgao_cod: orgaoCod,
    orgao_cnpj: raw.unidadeGestora?.orgaoVinculado?.cnpj || null,
    unidade_gestora: raw.unidadeGestora?.nome || null,
    ano,
    uf: ufDe(raw.municipio?.uf),
    municipio_ibge: raw.municipio?.codigoIBGE || null,
    municipio_nome: raw.municipio?.nomeIBGE || null,
    numero: raw.licitacao?.numero || null,
    numero_processo: raw.licitacao?.numeroProcesso || null,
    // Sanitização na ingestão: PII em texto livre é mascarada antes de persistir.
    objeto: sanitizarTextoPublico((raw.licitacao?.objeto ?? "").slice(0, 240)) || null,
    modalidade: raw.modalidadeLicitacao || null,
    situacao: raw.situacaoCompra || null,
    valor: parseValorPortal(raw.valor),
    data_abertura: dataAbertura || null,
    data_publicacao: dataPublicacao || null,
    data_resultado: dataResultado || null,
    mes_referencia: ref ? Number(ref.slice(5, 7)) : null,
    url_oficial: linkConsultaLicitacaoPortal({ orgaoCod }),
    updated_at: new Date().toISOString(),
  };
}

/**
 * Parâmetros da importação — fonte única da validação: a casca autenticada e
 * o modo nomeado de `/api/cron-importar` usam este mesmo schema.
 */
export const importarLicitacoesSchema = z.object({
  codigoOrgao: z.string().regex(/^\d{4,6}$/),
  // O endpoint /licitacoes EXIGE janela (filtra por data de abertura) e
  // recusa período maior que um mês.
  dataInicial: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dataFinal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  maxPaginas: z.number().int().min(1).max(5000).default(5000),
  delayMs: z.number().int().min(0).max(10000).default(800),
  orcamentoMs: z.number().int().min(10000).max(230000).default(180000),
});

export type ParamsLicitacoes = z.infer<typeof importarLicitacoesSchema>;

/** Chave de varredura da janela — a mesma para painel e ferramenta. */
export const chaveVarreduraLicitacoes = (p: {
  codigoOrgao: string;
  dataInicial: string;
  dataFinal: string;
}) => montarVarreduraKey("licitacoes", p.codigoOrgao, p.dataInicial, p.dataFinal);

/**
 * Motivo para recusar o órgão, ou `null`. Aceita qualquer órgão do Executivo
 * (não só o catálogo enriquecido); só recusa o catalogado como fora do Portal
 * (Câmara/Senado).
 */
export function orgaoForaDoPortal(codigoOrgao: string): string | null {
  const catalogado = ORGAOS_BASE.find((o) => o.cod === codigoOrgao);
  if (catalogado && !catalogado.disponivelPortal) {
    return `${catalogado.sigla} não é coberto pelo Portal. ${catalogado.nota ?? ""}`.trim();
  }
  return null;
}

/** O endpoint /licitacoes pagina em blocos fixos (mesmo default do Portal). */
const TAM_PAGINA = 15;

/**
 * Núcleo chamável sem sessão: UMA rodada da varredura de um órgão numa
 * janela. Usado pela casca autenticada e pelo modo nomeado. A linha de rodada
 * marca a célula órgão × mês da cobertura (escopo = código do órgão).
 */
export async function rodadaLicitacoes(
  data: ParamsLicitacoes,
  userId: string | null,
  origem: OrigemRodada = {},
): Promise<SweepRodada> {
  return varrerPaginado<PortalLicitacao, LicitacaoRow>({
    entidade: "licitacoes",
    fonte: "cgu_licitacoes",
    endpoint: "/licitacoes",
    orgaoCodLog: data.codigoOrgao,
    escopo: data.codigoOrgao,
    ...anoMesDaJanela(data.dataInicial, data.dataFinal),
    userId,
    origem,
    varreduraKey: chaveVarreduraLicitacoes(data),
    tamPagina: TAM_PAGINA,
    maxPaginas: data.maxPaginas,
    delayMs: data.delayMs,
    orcamentoMs: data.orcamentoMs,
    montarParams: (pagina) => ({
      codigoOrgao: data.codigoOrgao,
      dataInicial: isoToBR(data.dataInicial),
      dataFinal: isoToBR(data.dataFinal),
      pagina: String(pagina),
    }),
    mapPagina: (list, _pagina, push) => {
      const rows = list.map((raw) => mapearLicitacao(raw, data.codigoOrgao));
      // QA roda sobre as linhas mapeadas (sem conferência por detalhe).
      for (const f of regrasCguLicitacoes(rows as CguLicitacaoLike[])) push.finding(f);
      return rows;
    },
    upsertBatch: async (rows) => {
      const erros: string[] = [];
      for (let i = 0; i < rows.length; i += 200) {
        const chunk = rows.slice(i, i + 200);
        const { error } = await supabaseAdmin.from("cgu_licitacoes_cache").upsert(chunk);
        if (error) erros.push(`db: ${error.message}`);
      }
      return erros;
    },
    rowDateIso: (row) => row.data_abertura,
  });
}

export const importLicitacoes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => importarLicitacoesSchema.parse(input))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);
    const recusa = orgaoForaDoPortal(data.codigoOrgao);
    if (recusa) throw new Error(recusa);
    const r = await rodadaLicitacoes(data, context.userId);
    return {
      meta: {
        totalBruto: r.totalAcumulado,
        importados: r.totalAcumulado,
        erros: [...r.erros, ...r.avisos],
        fonte: "Portal da Transparência (CGU) — Licitações",
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
