/**
 * Modo nomeado — cadastro de deputados da Câmara, de uma legislatura (padrão:
 * a atual). É o pré-requisito da CEAP. Chamada única, sem varredura: sempre
 * roda (a gravação é idempotente). Total da origem: o `X-Total-Count` da
 * listagem, com as repetições (titular e suplente) contadas como descartadas.
 * Sem célula no tempo; é pendente enquanto a última conferência não for
 * aprovada.
 */
import type { z } from "zod";
import { importarDeputadosSchema, rodadaCadastroCamara } from "@/lib/data/camara/ingest.functions";
import type { Adaptador } from "@/lib/data/automacao/adaptador";

type Params = z.infer<typeof importarDeputadosSchema>;

export const adaptadorCamaraCadastro: Adaptador<Params> = {
  schema: importarDeputadosSchema,
  fonte: "camara_deputados",
  granularidade: "cadastro",
  janela: () => null,
  descricao: (p) => `Câmara: cadastro de deputados (legislatura ${p.idLegislatura ?? "atual"})`,
  unidades: ["deputados"],
  rodada: (p, origem) =>
    rodadaCadastroCamara(p, null, origem).then((r) => ({
      importados: { deputados: r.importados },
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
