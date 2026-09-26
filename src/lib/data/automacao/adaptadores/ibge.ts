/**
 * Modo nomeado — cadastro de municípios do IBGE. Sem janela: é o cadastro
 * inteiro, uma UF por passo. Total da origem: a lista nacional (a soma das
 * UFs), buscada na última rodada. Sem célula no tempo, a cobertura exige
 * contagem > 0; é pendente enquanto a última conferência não for aprovada.
 */
import type { z } from "zod";
import {
  CHAVE_VARREDURA_IBGE,
  importarMunicipiosIBGESchema,
  rodadaMunicipiosIBGE,
  totalDaOrigemIBGE,
} from "@/lib/data/ibge/ingest.functions";
import type { Adaptador, ResultadoAdaptado } from "@/lib/data/automacao/adaptador";

type Params = z.infer<typeof importarMunicipiosIBGESchema>;

export const adaptadorIbge: Adaptador<Params> = {
  schema: importarMunicipiosIBGESchema,
  fonte: "ibge",
  chave: () => CHAVE_VARREDURA_IBGE,
  granularidade: "cadastro",
  janela: () => null,
  totalDaOrigem: totalDaOrigemIBGE,
  descricao: () => "IBGE: cadastro de municípios",
  unidades: ["municipios"],
  rodada: async (_p, origem): Promise<ResultadoAdaptado> => {
    const r = await rodadaMunicipiosIBGE(null, origem);
    const resultado: ResultadoAdaptado = {
      importados: { municipios: r.importados },
      erros: r.erros,
      varredura: r.varredura,
      origem: null,
    };
    // A varredura vai por UF e as rodadas anteriores não guardam o que
    // leram: o total vem da lista nacional, numa chamada, no fim.
    if (!r.varredura.haMais) {
      try {
        resultado.origem = await totalDaOrigemIBGE();
      } catch (e) {
        resultado.falhaAoConsultarOrigem = (e as Error).message;
      }
    }
    return resultado;
  },
};
