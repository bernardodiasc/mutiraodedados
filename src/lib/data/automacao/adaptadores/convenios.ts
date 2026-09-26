/**
 * Modo nomeado — convênios por período (Portal da Transparência, endpoint
 * `/convenios`). Janela natural: um mês (a API recusa período maior). A
 * origem não informa total: a contagem "não se aplica".
 */
import type { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  chaveVarreduraConvenios,
  importConveniosSchema,
  rodadaConvenios,
} from "@/lib/data/real/convenios.functions";
import { checkpointCguVarredura } from "@/lib/data/real/sweep";
import { janelaDeUmMes, mesDasDatas, type Adaptador } from "@/lib/data/automacao/adaptador";
import { textoDoErroDoBanco } from "@/lib/data/erros-banco";

type Params = z.infer<typeof importConveniosSchema>;

/** Convênios no cache com o mês de referência da janela — a célula da cobertura. */
async function contarNaCelula(p: Params): Promise<number> {
  const { ano, mes } = mesDasDatas(p.dataInicial, p.dataFinal);
  const { count, error, status } = await supabaseAdmin
    .from("convenios_cache")
    .select("id", { count: "exact" })
    .eq("ano", ano)
    .eq("mes_referencia", mes)
    .limit(0);
  if (error)
    throw new Error(
      `conferência: contagem em convenios_cache: ${textoDoErroDoBanco(error, status)}`,
    );
  return count ?? 0;
}

export const adaptadorConvenios: Adaptador<Params> = {
  schema: janelaDeUmMes(importConveniosSchema, "cgu_convenios", ["dataInicial", "dataFinal"]),
  fonte: "cgu_convenios",
  chave: chaveVarreduraConvenios,
  checkpoint: checkpointCguVarredura,
  janela: (p) => mesDasDatas(p.dataInicial, p.dataFinal),
  contarNaCelula,
  descricao: (p) => `Portal da Transparência: convênios de ${p.dataInicial} a ${p.dataFinal}`,
  unidades: ["convenios"],
  rodada: (p, origem) =>
    rodadaConvenios(p, null, origem).then(({ meta }) => ({
      importados: { convenios: meta.varredura.processados },
      erros: meta.erros,
      varredura: {
        haMais: meta.varredura.haMais,
        cursor: meta.varredura.ultimaPagina,
        totalAcumulado: meta.varredura.totalAcumulado,
        orcamentoEsgotado: meta.varredura.orcamentoEsgotado,
        custoEsgotado: false,
      },
      origem: null,
    })),
};
