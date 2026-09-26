/**
 * Modo nomeado — contratos da CGU (`cgu_contratos`), por órgão e mês.
 *
 * Janela natural: um mês de um órgão. A API filtra por vigência e a rodada
 * guarda só os contratos com INÍCIO de vigência no mês — a célula órgão × mês
 * da cobertura (`cobertura_cgu`). As rodadas gravam `escopo` = código do
 * órgão, a linha da matriz. É a fonte mais cara da CGU (um GET de detalhe por
 * contrato): além do tempo, cada rodada tem teto de custo em subrequisições.
 *
 * Pendentes: órgão × mês, dos órgãos ativos do catálogo SIAFI ou dos pedidos
 * (`por-orgao.ts`).
 */
import type { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { checkpointCguVarredura } from "@/lib/data/real/sweep";
import {
  chaveVarreduraContratos,
  importarContratosCguSchema,
  rodadaContratosCgu,
} from "@/lib/data/real/portal.functions";
import { orgaoForaDoPortal } from "@/lib/data/real/licitacoes.functions";
import type { Adaptador } from "@/lib/data/automacao/adaptador";
import {
  janelaDeUmMesDoPortal,
  mesDaJanelaDoPortal,
  semTotalDaOrigem,
} from "@/lib/data/automacao/nomeado-portal";
import { pendentesPorOrgao, recortePorOrgao } from "@/lib/data/automacao/adaptadores/por-orgao";
import { textoDoErroDoBanco } from "@/lib/data/erros-banco";

/** No modo nomeado a janela é obrigatória: um mês de vigência. */
const schemaComJanela = importarContratosCguSchema.required({
  dataInicial: true,
  dataFinal: true,
});

type Params = z.infer<typeof schemaComJanela>;

const schema = janelaDeUmMesDoPortal(
  schemaComJanela.superRefine((p, ctx) => {
    const recusa = orgaoForaDoPortal(p.codigoOrgao);
    if (recusa) ctx.addIssue({ code: "custom", message: recusa });
  }) as z.ZodType<Params>,
  "cgu",
);

/**
 * Contratos do órgão na célula do mês, como a cobertura os conta: pelo
 * início de vigência ou, sem ele, pelo ano e mês de referência.
 */
export async function contarContratosNaCelula(p: Params): Promise<number> {
  const { ano, mes } = mesDaJanelaDoPortal(p);
  const { count, error, status } = await supabaseAdmin
    .from("contratos_cache")
    .select("id", { count: "exact" })
    .eq("orgao_cod", p.codigoOrgao)
    .or(
      `and(data_inicio_vigencia.gte.${p.dataInicial},data_inicio_vigencia.lte.${p.dataFinal}),and(data_inicio_vigencia.is.null,ano.eq.${ano},mes_referencia.eq.${mes})`,
    )
    .limit(0);
  if (error)
    throw new Error(
      `conferência: contagem em contratos_cache: ${textoDoErroDoBanco(error, status)}`,
    );
  return count ?? 0;
}

export const adaptadorCguContratos: Adaptador<Params> = {
  schema,
  // O id da cobertura e do Histórico dos contratos é `cgu`.
  fonte: "cgu",
  chave: chaveVarreduraContratos,
  checkpoint: checkpointCguVarredura,
  escopo: (p) => p.codigoOrgao,
  recorte: recortePorOrgao,
  janela: mesDaJanelaDoPortal,
  contarNaCelula: contarContratosNaCelula,
  totalDaOrigem: semTotalDaOrigem,
  descricao: (p) =>
    `CGU: contratos do órgão ${p.codigoOrgao} com início de vigência de ${p.dataInicial} a ${p.dataFinal}`,
  unidades: ["contratos"],
  rodada: async (p, origem) => {
    const r = await rodadaContratosCgu(p, null, origem);
    return {
      importados: { contratos: r.processados },
      // Os avisos `info:` voltam junto dos erros — a rota os separa.
      erros: [...r.erros, ...r.avisos],
      varredura: {
        haMais: r.haMais,
        cursor: r.cursor,
        totalAcumulado: r.totalAcumulado,
        orcamentoEsgotado: r.orcamentoEsgotado,
        custoEsgotado: r.custoEsgotado,
      },
      origem: null,
    };
  },
  pendentes: (params) => pendentesPorOrgao("cgu", params),
};
