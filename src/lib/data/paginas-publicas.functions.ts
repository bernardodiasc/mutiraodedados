import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ensureAdmin } from "@/lib/data/real/sweep";
import { linhasPaginasPublicas, type LinhaPaginaPublica } from "@/lib/paginas-publicas/lista";
import {
  planoSincronizacao,
  resumoSincronizacao,
  type PlanoSincronizacao,
  type ResumoSincronizacao,
} from "@/lib/paginas-publicas/sincronizar";

/**
 * Páginas estáticas na busca (aba "Busca" do /admin/dados): confere a tabela
 * `paginas_publicas` com a lista do código e sincroniza. Os gatilhos da
 * coleção levam cada linha gravada ou apagada ao índice.
 */

async function plano(): Promise<PlanoSincronizacao> {
  const { data, error } = await supabaseAdmin
    .from("paginas_publicas")
    .select("id, rota, ancora, pagina, titulo, resumo, palavras, texto");
  if (error) throw new Error(`Não foi possível ler as páginas públicas: ${error.message}`);
  return planoSincronizacao(linhasPaginasPublicas(), (data ?? []) as LinhaPaginaPublica[]);
}

export const conferirPaginasPublicas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ResumoSincronizacao> => {
    await ensureAdmin(context.userId);
    return resumoSincronizacao(await plano());
  });

export const sincronizarPaginasPublicas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ResumoSincronizacao> => {
    await ensureAdmin(context.userId);
    const p = await plano();
    const gravar = [...p.novas, ...p.alteradas].map((l) => ({
      ...l,
      atualizado_em: new Date().toISOString(),
    }));
    if (gravar.length) {
      const { error } = await supabaseAdmin.from("paginas_publicas").upsert(gravar);
      if (error) throw new Error(`Não foi possível gravar as páginas: ${error.message}`);
    }
    if (p.removidas.length) {
      const { error } = await supabaseAdmin.from("paginas_publicas").delete().in("id", p.removidas);
      if (error) throw new Error(`Não foi possível apagar as páginas: ${error.message}`);
    }
    return resumoSincronizacao(p);
  });
