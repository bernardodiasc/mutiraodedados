/**
 * Gravação da linha de rodada no Histórico (`importacoes`). Server-only.
 *
 * Nunca lança: o registro do histórico não pode derrubar uma importação que
 * já gravou dados. Falha aqui vira aviso no retorno da rodada.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { ResultadoRodada } from "@/lib/data/runner";
import { montarLinhaRodada, type MetaRodada } from "@/lib/data/historico-rodada";

export async function registrarRodadaImportacao(
  meta: MetaRodada,
  rodada: ResultadoRodada,
): Promise<string | null> {
  const linha = montarLinhaRodada(meta, rodada);
  const { error } = await supabaseAdmin.from("importacoes").insert({
    ...linha,
    consultado_em: new Date().toISOString(),
  });
  return error ? `historico: ${error.message}` : null;
}
