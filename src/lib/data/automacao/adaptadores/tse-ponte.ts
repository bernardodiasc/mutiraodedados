/**
 * Modo nomeado — o vínculo parlamentar↔candidato (`tse_ponte`), por casa.
 *
 * A ponte percorre o cadastro da casa em lotes (`sincronizarPonteParlamentar`)
 * e não guarda onde parou: o `offset` do próximo lote volta no `cursor` da
 * resposta, e quem chama o manda de novo em `params.offset` na rodada
 * seguinte. A janela é o cadastro da casa inteiro — a primeira rodada vai com
 * `offset` 0, a última responde `haMais: false`. Precisa dos candidatos do TSE
 * e do cadastro da casa.
 *
 * O núcleo não grava linha no Histórico; o adaptador grava uma por rodada
 * (`fonte = tse_ponte`, `escopo` = a casa). Sem célula no tempo: a contagem é
 * o total de parlamentares percorridos, e a origem não informa total. As
 * pendentes são uma janela de cadastro por casa, com a casa no `escopo`.
 */
import { z } from "zod";
import { ponteParlamentarSchema } from "@/lib/data/tse/ponte.functions";
import { sincronizarPonteParlamentar } from "@/lib/data/tse/ponte.server";
import { janelaPendenteDeCadastro } from "@/lib/data/automacao/conferencia";
import { lerConferencias } from "@/lib/data/automacao/conferencia.server";
import type { Adaptador, ResultadoAdaptado } from "@/lib/data/automacao/adaptador";
import { registrarRodadaAvulsa } from "@/lib/data/automacao/adaptadores/linha-de-rodada";

type Params = z.infer<typeof ponteParlamentarSchema>;

const CASAS = ponteParlamentarSchema.shape.casa.options;
const FONTE = "tse_ponte";
const descricao = (p: Params) =>
  `TSE: vínculo parlamentar↔candidato (${p.casa === "camara" ? "Câmara" : "Senado"})`;

export const adaptadorTsePonte: Adaptador<Params> = {
  schema: ponteParlamentarSchema,
  fonte: FONTE,
  granularidade: "cadastro",
  escopo: (p) => p.casa,
  janela: () => null,
  descricao,
  unidades: ["parlamentares", "vinculos"],
  rodada: async (p, origem): Promise<ResultadoAdaptado> => {
    const erros: string[] = [];
    let processados = 0;
    let vinculados = 0;
    let proximoOffset: number | null = null;
    try {
      const r = await sincronizarPonteParlamentar(p.casa, p.offset);
      processados = r.processados;
      vinculados = r.vinculados;
      proximoOffset = r.proximoOffset;
      if (r.baixaConfianca > 0) {
        erros.push(`info: ${r.baixaConfianca} vínculo(s) por nome, na fila de revisão.`);
      }
    } catch (e) {
      erros.push((e as Error).message);
    }
    const aviso = await registrarRodadaAvulsa({
      fonte: FONTE,
      escopo: p.casa,
      ano: null,
      mes: null,
      importados: vinculados,
      processados,
      erros,
      endpoint: `${descricao(p)} a partir de ${p.offset}`,
      origem,
    });
    if (aviso) erros.push(aviso);
    const percorridos = p.offset + processados;
    return {
      importados: { parlamentares: processados, vinculos: vinculados },
      erros,
      varredura: {
        haMais: proximoOffset !== null,
        cursor: proximoOffset ?? percorridos,
        totalAcumulado: percorridos,
        orcamentoEsgotado: false,
        custoEsgotado: proximoOffset !== null,
      },
      origem: null,
    };
  },
  pendentes: async (params) => {
    const pedido = z
      .object({ casa: ponteParlamentarSchema.shape.casa.optional() })
      .safeParse(params ?? {});
    if (!pedido.success) return { recusa: `tse_ponte: ${z.prettifyError(pedido.error)}` };
    const casas = pedido.data.casa ? [pedido.data.casa] : CASAS;
    const porCasa = await Promise.all(
      casas.map(async (casa) =>
        janelaPendenteDeCadastro(await lerConferencias(FONTE, casa)).map((j) => ({
          ...j,
          escopo: casa,
        })),
      ),
    );
    return porCasa.flat();
  },
};
