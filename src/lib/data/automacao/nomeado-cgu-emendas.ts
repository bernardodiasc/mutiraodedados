/**
 * Modo nomeado — emendas parlamentares da CGU (`cgu_emendas`), por ano.
 *
 * Janela natural: o ano — o endpoint /emendas é consultado por ano inteiro. A
 * célula da cobertura é a do ano (`mes = 1`, âncora), e a consulta de
 * pendentes devolve uma janela por ano.
 */
import type { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { dentroDaJanelaAnual } from "@/lib/data/janelas";
import { checkpointCguVarredura } from "@/lib/data/real/sweep";
import {
  chaveVarreduraEmendas,
  importarEmendasSchema,
  rodadaEmendas,
  type ParamsEmendas,
} from "@/lib/data/real/emendas.functions";
import type { Adaptador } from "@/lib/data/automacao/nomeado";
import { adaptarVarreduraDoPortal, semTotalDaOrigem } from "@/lib/data/automacao/nomeado-portal";
import { textoDoErroDoBanco } from "@/lib/data/erros-banco";

const schema = importarEmendasSchema.superRefine((p, ctx) => {
  if (!dentroDaJanelaAnual("cgu_emendas", p.ano)) {
    ctx.addIssue({
      code: "custom",
      message: "fora da janela de disponibilidade da fonte (cgu_emendas)",
    });
  }
}) as z.ZodType<ParamsEmendas>;

/** Emendas do ano no cache — a célula anual da cobertura. */
export async function contarEmendasNaCelula(p: ParamsEmendas): Promise<number> {
  const { count, error, status } = await supabaseAdmin
    .from("cgu_transferegov_emendas_cache")
    .select("id", { count: "exact" })
    .eq("ano", p.ano)
    .limit(0);
  if (error)
    throw new Error(
      `conferência: contagem em cgu_transferegov_emendas_cache: ${textoDoErroDoBanco(error, status)}`,
    );
  return count ?? 0;
}

export const adaptadorCguEmendas: Adaptador<ParamsEmendas> = {
  schema,
  fonte: "cgu_emendas",
  chave: chaveVarreduraEmendas,
  checkpoint: checkpointCguVarredura,
  granularidade: "ano",
  janela: (p) => ({ ano: p.ano, mes: 1 }),
  contarNaCelula: contarEmendasNaCelula,
  totalDaOrigem: semTotalDaOrigem,
  descricao: (p) => `CGU: emendas parlamentares de ${p.ano}`,
  unidades: ["emendas"],
  rodada: (p, origem) =>
    rodadaEmendas(p, null, origem).then((r) => adaptarVarreduraDoPortal(r, "emendas")),
};
