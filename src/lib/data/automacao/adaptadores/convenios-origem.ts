/**
 * Modo nomeado — o enriquecimento dos convênios pela origem
 * (`convenios_origem`): o CSV `siconv_convenio.zip` do Transferegov.
 *
 * Sem janela no tempo: o arquivo inteiro, em lotes de linhas, retomável em
 * `importacao_varredura` (chave `convenios_origem#csv`). Cada rodada infla o
 * zip de novo e pula até o cursor — no fim do arquivo isso custa cerca de um
 * segundo de CPU, longe do limite do Worker. Só atualiza convênios que já
 * existem: precisa do acervo de convênios antes. A origem não informa total
 * (a contagem "não se aplica"); `importados` são os convênios atualizados,
 * e os sem espelho no site vão como aviso. É pendente enquanto a última
 * conferência não for aprovada.
 */
import type { z } from "zod";
import {
  CHAVE_VARREDURA_ORIGEM,
  importarConveniosOrigemSchema,
  rodadaConveniosOrigem,
} from "@/lib/data/convenios-origem/ingest.functions";
import type { Adaptador } from "@/lib/data/automacao/adaptador";

type Params = z.infer<typeof importarConveniosOrigemSchema>;

export const adaptadorConveniosOrigem: Adaptador<Params> = {
  schema: importarConveniosOrigemSchema,
  fonte: "convenios_origem",
  chave: () => CHAVE_VARREDURA_ORIGEM,
  granularidade: "cadastro",
  janela: () => null,
  descricao: () => "Transferegov: enriquecimento dos convênios pela origem (CSV)",
  unidades: ["atualizados"],
  rodada: (_p, origem) =>
    rodadaConveniosOrigem(null, origem).then((r) => ({
      importados: { atualizados: r.atualizados },
      erros: r.erros,
      varredura: r.varredura,
      origem: null,
    })),
};
