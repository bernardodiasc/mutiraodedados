import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sanitizarTextoPublico, contemPII } from "@/lib/sanitize";

/**
 * Reprocessa o campo `objeto` de `contratos_cache`, aplicando a sanitização
 * de PII em registros já persistidos antes da Fase 3.
 *
 * Operação idempotente: rodar duas vezes não altera nada além da primeira.
 * Restrita a administradores.
 */
export const ressanitizarContratosCache = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { data: role } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (role?.role !== "admin") {
      throw new Error("Acesso restrito: somente administradores.");
    }

    let from = 0;
    const PAGE = 500;
    let varridos = 0;
    let alterados = 0;

    // varredura paginada estável por id ASC
    while (true) {
      const { data, error } = await supabaseAdmin
        .from("contratos_cache")
        .select("id, objeto")
        .order("id", { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) throw new Error(`leitura: ${error.message}`);
      if (!data || data.length === 0) break;

      const updates: { id: string; objeto: string }[] = [];
      for (const row of data) {
        varridos++;
        if (!row.objeto) continue;
        if (!contemPII(row.objeto)) continue;
        const limpo = sanitizarTextoPublico(row.objeto);
        if (limpo !== row.objeto) {
          updates.push({ id: row.id, objeto: limpo });
        }
      }

      for (const u of updates) {
        const { error: upErr } = await supabaseAdmin
          .from("contratos_cache")
          .update({ objeto: u.objeto, updated_at: new Date().toISOString() })
          .eq("id", u.id);
        if (upErr) throw new Error(`update ${u.id}: ${upErr.message}`);
        alterados++;
      }

      if (data.length < PAGE) break;
      from += PAGE;
    }

    return { ok: true, varridos, alterados };
  });
