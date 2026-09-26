/**
 * Modo nomeado — CEAP (cota parlamentar da Câmara). Janela natural: um mês.
 * Depende do cadastro de deputados da legislatura (`camara_cadastro`): sem
 * ele o núcleo recusa o mês. A origem informa total só por deputado, então a
 * contagem da janela "não se aplica".
 */
import type { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  chaveVarreduraCeapCamara,
  importarCEAPMesSchema,
  rodadaCEAPMes,
} from "@/lib/data/camara/ingest.functions";
import { mesDentroDaJanela, type Adaptador } from "@/lib/data/automacao/adaptador";
import { textoDoErroDoBanco } from "@/lib/data/erros-banco";

type Params = z.infer<typeof importarCEAPMesSchema>;

/** Despesas no cache do mês — a célula da cobertura da CEAP. */
async function contarNaCelula(p: Params): Promise<number> {
  const { count, error, status } = await supabaseAdmin
    .from("camara_despesas_cache")
    .select("id", { count: "exact" })
    .eq("ano", p.ano)
    .eq("mes", p.mes)
    .limit(0);
  if (error)
    throw new Error(
      `conferência: contagem em camara_despesas_cache: ${textoDoErroDoBanco(error, status)}`,
    );
  return count ?? 0;
}

export const adaptadorCeap: Adaptador<Params> = {
  schema: mesDentroDaJanela(importarCEAPMesSchema, "camara_ceap"),
  fonte: "camara_ceap",
  chave: chaveVarreduraCeapCamara,
  janela: (p) => ({ ano: p.ano, mes: p.mes }),
  contarNaCelula,
  descricao: (p) => `Câmara: CEAP de ${p.ano}-${String(p.mes).padStart(2, "0")}`,
  unidades: ["despesas", "deputados"],
  rodada: (p, origem) =>
    rodadaCEAPMes(p, null, origem).then((r) => ({
      importados: { despesas: r.importados, deputados: r.deputadosProcessados },
      erros: r.erros,
      varredura: r.varredura,
      origem: null,
    })),
};
