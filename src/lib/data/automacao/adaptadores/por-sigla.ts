/**
 * Pendentes das fontes anuais com uma varredura por sigla (matérias do
 * Senado) ou por tipo (proposições da Câmara): a unidade é (ano, sigla), e a
 * sigla vai no `escopo` das rodadas e da conferência. Aprovar as PL de 2024
 * não tira as PEC de 2024 das pendentes.
 *
 * Sem sigla no pedido, valem as que o painel importa
 * (`siglas-legislativas.ts`); com ela, só essa.
 */
import { z } from "zod";
import { janelasPendentes, type JanelaPendente } from "@/lib/data/automacao/conferencia";
import { lerConferencias } from "@/lib/data/automacao/conferencia.server";
import type { RecusaNomeada } from "@/lib/data/automacao/adaptador";
import type { FonteJanela } from "@/lib/data/janelas";

export async function pendentesPorSigla(
  fonte: FonteJanela,
  chave: "sigla" | "siglaTipo",
  siglasDoPainel: readonly string[],
  params: unknown,
): Promise<JanelaPendente[] | RecusaNomeada> {
  const pedido = z
    .object({ [chave]: z.string().min(2).max(10).optional() })
    .safeParse(params ?? {});
  if (!pedido.success) return { recusa: z.prettifyError(pedido.error) };
  const pedida = pedido.data[chave] as string | undefined;
  const siglas = pedida ? [pedida] : siglasDoPainel;

  const porSigla = await Promise.all(
    siglas.map(async (sigla) =>
      janelasPendentes(fonte, await lerConferencias(fonte, sigla), new Date(), "ano").map((j) => ({
        ...j,
        escopo: sigla,
      })),
    ),
  );
  // Do ano mais recente ao mais antigo; no mesmo ano, na ordem das siglas.
  return porSigla.flat().sort((a, b) => b.ano - a.ano);
}
