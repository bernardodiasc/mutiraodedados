import { redirect } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getAdminStatus } from "@/lib/admin.functions";

function negarAcesso(): never {
  toast.error("Acesso restrito a administradores.");
  throw redirect({ to: "/" });
}

/** Guarda compartilhada para rotas admin. Roda só no client. */
export async function ensureAdminBeforeLoad({ location }: { location: { href: string } }) {
  if (typeof window === "undefined") return;
  let { data: sess } = await supabase.auth.getSession();
  if (!sess.session) {
    const r = await supabase.auth.refreshSession();
    sess = r.data.session ? { session: r.data.session } : sess;
  }
  if (!sess.session?.user?.id)
    throw redirect({ to: "/login", search: { redirect: location.href } });
  let isAdmin: boolean;
  try {
    ({ isAdmin } = await getAdminStatus());
  } catch (e) {
    const msg = (e as Error).message ?? "";
    if (!msg.toLowerCase().includes("unauthorized")) throw e;
    await supabase.auth.refreshSession();
    ({ isAdmin } = await getAdminStatus());
  }
  if (!isAdmin) negarAcesso();
}
