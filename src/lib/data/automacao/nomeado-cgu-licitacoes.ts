/**
 * Modo nomeado — licitações da CGU (`cgu_licitacoes`), por órgão e mês.
 *
 * Janela natural: um mês (o endpoint filtra pela data de abertura e recusa
 * período maior). A linha da matriz de cobertura é o órgão: as rodadas gravam
 * `escopo` = código do órgão. A consulta de pendentes é órgão × mês: dos
 * órgãos ativos do catálogo SIAFI, ou só dos pedidos em `params`
 * (`{ codigoOrgao }` ou `{ codigosOrgao }`) — ver `adaptadores/por-orgao.ts`.
 */
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { checkpointCguVarredura } from "@/lib/data/real/sweep";
import {
  chaveVarreduraLicitacoes,
  importarLicitacoesSchema,
  orgaoForaDoPortal,
  rodadaLicitacoes,
  type ParamsLicitacoes,
} from "@/lib/data/real/licitacoes.functions";
import type { Adaptador } from "@/lib/data/automacao/nomeado";
import {
  adaptarVarreduraDoPortal,
  janelaDeUmMesDoPortal,
  mesDaJanelaDoPortal,
  semTotalDaOrigem,
} from "@/lib/data/automacao/nomeado-portal";
import { pendentesPorOrgao, recortePorOrgao } from "@/lib/data/automacao/adaptadores/por-orgao";
import { textoDoErroDoBanco } from "@/lib/data/erros-banco";

const schema = janelaDeUmMesDoPortal(
  importarLicitacoesSchema.superRefine((p, ctx) => {
    const recusa = orgaoForaDoPortal(p.codigoOrgao);
    if (recusa) ctx.addIssue({ code: "custom", message: recusa });
  }) as z.ZodType<ParamsLicitacoes>,
  "cgu_licitacoes",
);

/**
 * Registros do órgão na célula do mês, como a cobertura os conta: pela data
 * de abertura ou, sem ela, pelo ano e mês de referência.
 */
export async function contarLicitacoesNaCelula(p: ParamsLicitacoes): Promise<number> {
  const { ano, mes } = mesDaJanelaDoPortal(p);
  const { count, error, status } = await supabaseAdmin
    .from("cgu_licitacoes_cache")
    .select("id", { count: "exact" })
    .eq("orgao_cod", p.codigoOrgao)
    .or(
      `and(data_abertura.gte.${p.dataInicial},data_abertura.lte.${p.dataFinal}),and(data_abertura.is.null,ano.eq.${ano},mes_referencia.eq.${mes})`,
    )
    .limit(0);
  if (error)
    throw new Error(
      `conferência: contagem em cgu_licitacoes_cache: ${textoDoErroDoBanco(error, status)}`,
    );
  return count ?? 0;
}

export const adaptadorCguLicitacoes: Adaptador<ParamsLicitacoes> = {
  schema,
  fonte: "cgu_licitacoes",
  chave: chaveVarreduraLicitacoes,
  checkpoint: checkpointCguVarredura,
  escopo: (p) => p.codigoOrgao,
  recorte: recortePorOrgao,
  janela: mesDaJanelaDoPortal,
  contarNaCelula: contarLicitacoesNaCelula,
  totalDaOrigem: semTotalDaOrigem,
  descricao: (p) =>
    `CGU: licitações do órgão ${p.codigoOrgao} de ${p.dataInicial} a ${p.dataFinal}`,
  unidades: ["licitacoes"],
  rodada: (p, origem) =>
    rodadaLicitacoes(p, null, origem).then((r) => adaptarVarreduraDoPortal(r, "licitacoes")),
  pendentes: (params) => pendentesPorOrgao("cgu_licitacoes", params),
};
