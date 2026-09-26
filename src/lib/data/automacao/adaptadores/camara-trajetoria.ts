/**
 * Modo nomeado — trajetória dos deputados de uma legislatura (padrão: a
 * atual), a linha do tempo de /historico. Exige o cadastro da legislatura.
 *
 * O progresso não fica numa varredura do servidor: cada rodada processa um
 * lote a partir de `offset` e devolve o próximo no `cursor`; quem chama o
 * manda de volta em `params.offset` na rodada seguinte, até `haMais` virar
 * falso. Uma execução nova começa do offset 0. A origem não informa total (o
 * total é a lista do nosso cadastro), então a contagem "não se aplica". Sem
 * célula no tempo; é pendente enquanto a última conferência não for aprovada.
 */
import type { z } from "zod";
import {
  importarTrajetoriaCamaraSchema,
  rodadaTrajetoriaCamara,
} from "@/lib/data/camara/ingest.functions";
import type { Adaptador } from "@/lib/data/automacao/adaptador";

type Params = z.infer<typeof importarTrajetoriaCamaraSchema>;

export const adaptadorCamaraTrajetoria: Adaptador<Params> = {
  schema: importarTrajetoriaCamaraSchema,
  fonte: "camara_trajetoria",
  granularidade: "cadastro",
  janela: () => null,
  descricao: (p) => `Câmara: trajetória dos deputados (legislatura ${p.idLegislatura ?? "atual"})`,
  unidades: ["deputados"],
  rodada: (p, origem) =>
    rodadaTrajetoriaCamara(p, null, origem).then((r) => ({
      importados: { deputados: r.processados - p.offset },
      erros: r.erros,
      varredura: {
        haMais: r.proximoOffset !== null,
        cursor: r.proximoOffset ?? r.processados,
        totalAcumulado: r.processados,
        orcamentoEsgotado: false,
        // O lote por rodada é o teto de subrequisições: parar nele não é
        // erro. Com erro e mais por fazer, a rodada foi interrompida.
        custoEsgotado: r.proximoOffset !== null && r.erros.length === 0,
      },
      origem: null,
    })),
};
