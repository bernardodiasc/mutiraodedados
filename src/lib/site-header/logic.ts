import type { User } from "@supabase/supabase-js";
import type { NavGroup, NavLink } from "@/lib/nav-groups";
import { flattenGroupLinks } from "@/lib/nav-groups";

/**
 * Nome amigável a exibir a partir do `user` do Supabase.
 * Ordem: user_metadata.display_name → user_metadata.full_name → prefixo do email → "Conta".
 */
export function computeDisplayName(user: Pick<User, "user_metadata" | "email"> | null | undefined): string {
  const meta = (user?.user_metadata ?? {}) as { display_name?: string; full_name?: string };
  return (
    meta.display_name ??
    meta.full_name ??
    user?.email?.split("@")[0] ??
    "Conta"
  );
}

/** Primeira letra (maiúscula) do `displayName` para o avatar. */
export function computeInitial(displayName: string): string {
  return (displayName.charAt(0) || "?").toUpperCase();
}

/** Algum link do grupo bate com o `pathname` atual? */
export function isGroupActive(group: NavGroup, pathname: string): boolean {
  return flattenGroupLinks(group).some((l) => pathname.startsWith(l.to));
}

/** O link individual está ativo? */
export function isLinkActive(link: Pick<NavLink, "to">, pathname: string): boolean {
  return pathname.startsWith(link.to);
}