/**
 * Modo nomeado — atividade dos órgãos do catálogo (`cgu_atividade`). Cadastro,
 * sem janela no tempo: a sonda de `/despesas/por-orgao`, um órgão por passo,
 * retomável em `importacao_varredura`. Marca cada órgão como ativo ou
 * inativo; os ativos são os que as tarefas por órgão percorrem por padrão.
 * A contagem contra a origem não se aplica; a cobertura exige ao menos um
 * órgão verificado. É pendente enquanto a última conferência não for
 * aprovada.
 */
import {
  CHAVE_VARREDURA_ATIVIDADE,
  ESCOPO_ATIVIDADE,
  FONTE_ORGAOS_SIAFI,
  rodadaAtividadeOrgaos,
  verificarAtividadeSchema,
  type ParamsAtividade,
} from "@/lib/data/real/orgaos-siafi.functions";
import type { Adaptador } from "@/lib/data/automacao/adaptador";
import { semTotalDaOrigem } from "@/lib/data/automacao/nomeado-portal";

export const adaptadorCguAtividade: Adaptador<ParamsAtividade> = {
  schema: verificarAtividadeSchema,
  fonte: FONTE_ORGAOS_SIAFI,
  chave: () => CHAVE_VARREDURA_ATIVIDADE,
  granularidade: "cadastro",
  escopo: () => ESCOPO_ATIVIDADE,
  janela: () => null,
  totalDaOrigem: semTotalDaOrigem,
  descricao: () => "CGU: atividade dos órgãos do catálogo",
  unidades: ["orgaos"],
  rodada: async (p, origem) => {
    const r = await rodadaAtividadeOrgaos(p, null, origem);
    return {
      importados: { orgaos: r.verificados },
      erros: [
        ...r.erros,
        `info: ${r.ativos} ativos e ${r.inativos} inativos nesta rodada, de ${r.total} órgãos na sonda`,
      ],
      varredura: r.varredura,
      origem: null,
    };
  },
};
