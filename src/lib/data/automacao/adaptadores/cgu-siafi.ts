/**
 * Modo nomeado — catálogo de órgãos SIAFI da CGU (`cgu_siafi`). Cadastro, sem
 * janela no tempo: a paginação inteira de `/orgaos-siafi`, uma página por
 * passo, retomável em `importacao_varredura`. A origem não informa o total
 * (contagem "não se aplica"); sem célula no tempo, a cobertura exige
 * contagem > 0. É pendente enquanto a última conferência não for aprovada.
 *
 * Divide a fonte do Histórico (`orgaos_siafi`) com a atividade dos órgãos:
 * cada rotina é uma linha — escopo `nomes` aqui, `atividade` lá.
 */
import {
  CHAVE_VARREDURA_CATALOGO_SIAFI,
  ESCOPO_CATALOGO_SIAFI,
  FONTE_ORGAOS_SIAFI,
  rodadaCatalogoSiafi,
  sincronizarCatalogoSiafiSchema,
  type ParamsCatalogoSiafi,
} from "@/lib/data/real/orgaos-siafi.functions";
import type { Adaptador } from "@/lib/data/automacao/adaptador";
import { semTotalDaOrigem } from "@/lib/data/automacao/nomeado-portal";

export const adaptadorCguSiafi: Adaptador<ParamsCatalogoSiafi> = {
  schema: sincronizarCatalogoSiafiSchema,
  fonte: FONTE_ORGAOS_SIAFI,
  chave: () => CHAVE_VARREDURA_CATALOGO_SIAFI,
  granularidade: "cadastro",
  escopo: () => ESCOPO_CATALOGO_SIAFI,
  janela: () => null,
  totalDaOrigem: semTotalDaOrigem,
  descricao: () => "CGU: catálogo de órgãos SIAFI",
  unidades: ["orgaos"],
  rodada: async (p, origem) => {
    const r = await rodadaCatalogoSiafi(p, null, origem);
    return {
      importados: { orgaos: r.importados },
      erros: r.erros,
      varredura: r.varredura,
      origem: null,
    };
  },
};
