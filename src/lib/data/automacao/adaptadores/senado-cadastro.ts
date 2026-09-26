/**
 * Modo nomeado — cadastro dos senadores em exercício (a legislatura atual).
 * Chamada única, sem varredura: sempre roda (a gravação é idempotente). Total
 * da origem: o tamanho da lista, que vem inteira numa chamada, com os itens
 * sem código e as repetições contados como descartados. Sem célula no tempo;
 * é pendente enquanto a última conferência não for aprovada.
 */
import type { z } from "zod";
import { importarSenadoresSchema, rodadaCadastroSenado } from "@/lib/data/senado/ingest.functions";
import type { Adaptador } from "@/lib/data/automacao/adaptador";

type Params = z.infer<typeof importarSenadoresSchema>;

export const adaptadorSenadoCadastro: Adaptador<Params> = {
  schema: importarSenadoresSchema,
  fonte: "senado_senadores",
  granularidade: "cadastro",
  janela: () => null,
  descricao: () => "Senado: cadastro dos senadores em exercício",
  unidades: ["senadores"],
  rodada: (_p, origem) =>
    rodadaCadastroSenado(null, origem).then((r) => ({
      importados: { senadores: r.importados },
      erros: r.erros,
      varredura: {
        haMais: false,
        cursor: null,
        totalAcumulado: r.importados,
        orcamentoEsgotado: false,
        custoEsgotado: false,
      },
      origem: r.origem,
    })),
};
