/**
 * Modo nomeado — CEAPS (cota parlamentar do Senado). Janela natural: um mês.
 * Total da origem: o tamanho da lista do mês, que vem inteira a cada rodada
 * (a origem entrega o ano todo, ~9 MB); despesas ilegíveis contam como
 * descartadas.
 */
import type { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  chaveVarreduraCeaps,
  importarCEAPSMesSchema,
  rodadaCEAPSMes,
  totalDaOrigemCEAPS,
} from "@/lib/data/senado/ingest.functions";
import { mesDentroDaJanela, type Adaptador } from "@/lib/data/automacao/adaptador";
import { textoDoErroDoBanco } from "@/lib/data/erros-banco";

type Params = z.infer<typeof importarCEAPSMesSchema>;

/** Despesas no cache do mês — a célula da cobertura da CEAPS. */
async function contarNaCelula(p: Params): Promise<number> {
  const { count, error, status } = await supabaseAdmin
    .from("senado_despesas_cache")
    .select("id", { count: "exact" })
    .eq("ano", p.ano)
    .eq("mes", p.mes)
    .limit(0);
  if (error)
    throw new Error(
      `conferência: contagem em senado_despesas_cache: ${textoDoErroDoBanco(error, status)}`,
    );
  return count ?? 0;
}

export const adaptadorCeaps: Adaptador<Params> = {
  schema: mesDentroDaJanela(importarCEAPSMesSchema, "senado_ceaps"),
  fonte: "senado_ceaps",
  chave: chaveVarreduraCeaps,
  janela: (p) => ({ ano: p.ano, mes: p.mes }),
  contarNaCelula,
  totalDaOrigem: totalDaOrigemCEAPS,
  descricao: (p) => `Senado: CEAPS de ${p.ano}-${String(p.mes).padStart(2, "0")}`,
  unidades: ["despesas"],
  rodada: (p, origem) =>
    rodadaCEAPSMes(p, null, origem).then((r) => ({
      importados: { despesas: r.importados },
      erros: r.erros,
      varredura: r.varredura,
      origem: r.origem,
    })),
};
