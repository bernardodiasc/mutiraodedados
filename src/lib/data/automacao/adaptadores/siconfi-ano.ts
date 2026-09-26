/**
 * Modo nomeado — o ano todo de um ente no SICONFI: os 10 relatórios padrão
 * (RREO 1–6, RGF 1–3, DCA) de um exercício. É a varredura do conjunto "ente"
 * num exercício só (`siconfi-varredura.ts`): retomável pela mesma chave, com a
 * mesma linha de conferência (`escopo` = `varredura:ente:<código>`). As
 * pendentes são por exercício encerrado, de um ente: a consulta exige
 * `codIbge`.
 */
import { z } from "zod";
import {
  importarConjuntoSICONFISchema,
  varreduraDoAnoTodo,
} from "@/lib/data/siconfi/ingest.functions";
import { dentroDaJanelaAnual } from "@/lib/data/janelas";
import { adaptadorDeVarreduraSiconfi } from "@/lib/data/automacao/adaptadores/siconfi-varredura";

type Params = z.infer<typeof importarConjuntoSICONFISchema>;

/** O exercício está na janela de disponibilidade da fonte. */
const schema = importarConjuntoSICONFISchema.superRefine((p, ctx) => {
  if (!dentroDaJanelaAnual("siconfi", p.exercicio)) {
    ctx.addIssue({
      code: "custom",
      message: "fora da janela de disponibilidade da fonte (siconfi)",
    });
  }
}) as z.ZodType<Params>;

const pendentesSchema = importarConjuntoSICONFISchema.pick({ codIbge: true });

export const adaptadorSiconfiAno = adaptadorDeVarreduraSiconfi<Params>({
  schema,
  paraVarredura: varreduraDoAnoTodo,
  recorteDasPendentes: (params) => {
    const r = pendentesSchema.safeParse(params ?? {});
    return r.success
      ? { conjunto: "ente", codIbge: r.data.codIbge }
      : { recusa: `siconfi_ano: ${z.prettifyError(r.error)}` };
  },
});
