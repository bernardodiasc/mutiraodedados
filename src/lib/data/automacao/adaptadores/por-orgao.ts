/**
 * Pendentes das fontes da CGU por órgão (contratos, licitações): a unidade é
 * órgão × mês, e o órgão vai no `escopo` das rodadas, da conferência e de
 * cada janela pendente. Aprovar março de 2024 do MEC não tira março de 2024
 * da Saúde das pendentes.
 *
 * Sem órgão no pedido, valem os ÓRGÃOS ATIVOS DO CATÁLOGO SIAFI
 * (`orgaosAtivosDoCatalogo`); com `codigoOrgao`, só ele; com `codigosOrgao`,
 * só a lista.
 */
import { z } from "zod";
import {
  janelasPendentes,
  type ConferenciaGravada,
  type JanelaPendente,
} from "@/lib/data/automacao/conferencia";
import { lerConferencias } from "@/lib/data/automacao/conferencia.server";
import type { RecusaNomeada } from "@/lib/data/automacao/adaptador";
import type { FonteJanela } from "@/lib/data/janelas";
import { orgaosAtivosDoCatalogo } from "@/lib/data/real/orgaos-siafi.functions";

const codigo = z.string().regex(/^\d{4,6}$/);

/** O que a consulta de pendentes aceita: um órgão, uma lista ou nada. */
export const recortePorOrgao = z
  .object({
    codigoOrgao: codigo.optional(),
    codigosOrgao: z.array(codigo).min(1).optional(),
  })
  .refine((p) => !(p.codigoOrgao && p.codigosOrgao), {
    message: "informe codigoOrgao ou codigosOrgao, não os dois",
  });

export async function pendentesPorOrgao(
  fonte: FonteJanela,
  params: unknown,
  hoje: Date = new Date(),
): Promise<JanelaPendente[] | RecusaNomeada> {
  const pedido = recortePorOrgao.safeParse(params ?? {});
  if (!pedido.success) return { recusa: z.prettifyError(pedido.error) };
  const { codigoOrgao, codigosOrgao } = pedido.data;
  const orgaos = codigosOrgao ?? (codigoOrgao ? [codigoOrgao] : await orgaosAtivosDoCatalogo());
  if (orgaos.length === 0) return [];

  // Um órgão: só as conferências dele. Vários: todas as da fonte, numa
  // leitura, separadas pelo escopo.
  const porOrgao = new Map<string, ConferenciaGravada[]>();
  if (orgaos.length === 1) {
    porOrgao.set(orgaos[0], await lerConferencias(fonte, orgaos[0]));
  } else {
    for (const c of await lerConferencias(fonte)) {
      const escopo = c.escopo ?? "";
      const lista = porOrgao.get(escopo);
      if (lista) lista.push(c);
      else porOrgao.set(escopo, [c]);
    }
  }

  const janelas = orgaos.flatMap((orgao) =>
    janelasPendentes(fonte, porOrgao.get(orgao) ?? [], hoje).map((j) => ({
      ...j,
      escopo: orgao,
    })),
  );
  // Do mês mais recente ao mais antigo; no mesmo mês, na ordem dos órgãos
  // (o `sort` é estável).
  return janelas.sort((a, b) => b.ano - a.ano || b.mes - a.mes);
}
