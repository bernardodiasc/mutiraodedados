/**
 * {@link Checkpoint} do runner genérico sobre a tabela `importacao_varredura`.
 *
 * Server-only: importa `client.server`. Fontes que já têm tabela própria
 * (`cgu_varredura`, `tse_varredura`) seguem com o adaptador delas; toda fonte
 * nova deve usar este, para não criar uma tabela de varredura por fonte.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Checkpoint } from "@/lib/data/runner";

/**
 * Erro do PostgREST quando a tabela ainda não existe (migração não aplicada).
 * Tratado como benigno: a rodada segue, só perde a retomada.
 */
function tabelaAusente(err: { message?: string; code?: string } | null | undefined): boolean {
  if (!err) return false;
  const m = err.message ?? "";
  return err.code === "PGRST205" || /could not find the table|schema cache|does not exist/i.test(m);
}

export const checkpointImportacao: Checkpoint = {
  ler: async (chave) => {
    const { data } = await supabaseAdmin
      .from("importacao_varredura")
      .select("cursor, total, completa")
      .eq("chave", chave)
      .maybeSingle();
    if (!data) return null;
    return {
      cursor: data.cursor ?? 0,
      total: data.total ?? 0,
      completa: Boolean(data.completa),
    };
  },
  salvar: async (chave, estado) => {
    const { error } = await supabaseAdmin.from("importacao_varredura").upsert({
      chave,
      cursor: estado.cursor,
      total: estado.total,
      completa: estado.completa,
      atualizado_em: new Date().toISOString(),
    });
    if (error) {
      if (tabelaAusente(error)) return { persistido: false, erro: null };
      return { persistido: true, erro: `importacao_varredura: ${error.message}` };
    }
    return { persistido: true, erro: null };
  },
};
