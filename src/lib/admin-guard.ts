import { redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { getAdminStatus } from "@/lib/admin.functions";

/** Guarda compartilhada para rotas admin. Roda só no client. */
export async function ensureAdminBeforeLoad() {
  if (typeof window === "undefined") return;
  let { data: sess } = await supabase.auth.getSession();
  if (!sess.session) {
    const r = await supabase.auth.refreshSession();
    sess = r.data.session ? { session: r.data.session } : sess;
  }
  if (!sess.session?.user?.id) throw redirect({ to: "/login" });
  try {
    const { isAdmin } = await getAdminStatus();
    if (!isAdmin) throw redirect({ to: "/" });
  } catch (e) {
    const msg = (e as Error).message ?? "";
    if (msg.toLowerCase().includes("unauthorized")) {
      await supabase.auth.refreshSession();
      const { isAdmin } = await getAdminStatus();
      if (!isAdmin) throw redirect({ to: "/" });
    } else {
      throw e;
    }
  }
}