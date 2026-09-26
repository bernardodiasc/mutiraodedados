/**
 * Modo nomeado — PNCP (contratos). Janela natural: um mês de publicação.
 * Total da origem: `totalRegistros`, só sem filtro de UF ou município (esses
 * são recortados depois da busca).
 */
import type { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  chaveVarreduraPNCP,
  importarContratosPNCPSchema,
  rodadaContratosPNCP,
  totalDaOrigemPNCP,
} from "@/lib/data/pncp/ingest.functions";
import {
  janelaDeUmMes,
  limitesDoMes,
  mesDasDatas,
  type Adaptador,
} from "@/lib/data/automacao/adaptador";
import { textoDoErroDoBanco } from "@/lib/data/erros-banco";

type Params = z.infer<typeof importarContratosPNCPSchema>;

/** Contratos no cache assinados no mês — a célula da cobertura do PNCP. */
async function contarNaCelula(p: Params): Promise<number> {
  const { ano, mes } = mesDasDatas(p.dataInicial, p.dataFinal);
  const { de, ate } = limitesDoMes(ano, mes);
  const { count, error, status } = await supabaseAdmin
    .from("pncp_contratos_cache")
    .select("id", { count: "exact" })
    .gte("data_assinatura", de)
    .lte("data_assinatura", ate)
    .limit(0);
  if (error)
    throw new Error(
      `conferência: contagem em pncp_contratos_cache: ${textoDoErroDoBanco(error, status)}`,
    );
  return count ?? 0;
}

export const adaptadorPncp: Adaptador<Params> = {
  schema: janelaDeUmMes(importarContratosPNCPSchema, "pncp", ["dataInicial", "dataFinal"]),
  fonte: "pncp",
  chave: chaveVarreduraPNCP,
  janela: (p) => mesDasDatas(p.dataInicial, p.dataFinal),
  contarNaCelula,
  totalDaOrigem: totalDaOrigemPNCP,
  descricao: (p) => `PNCP: contratos de ${p.dataInicial} a ${p.dataFinal}`,
  unidades: ["contratos"],
  rodada: (p, origem) =>
    rodadaContratosPNCP(p, null, origem).then((r) => ({
      importados: { contratos: r.importados },
      erros: r.erros,
      varredura: r.varredura,
      origem: r.origem,
    })),
};
