import { useLocation, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { computeDisplayName, computeInitial } from "@/lib/site-header/logic";
import { SiteHeaderView } from "@/components/SiteHeaderView";

export function SiteHeaderContainer() {
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const { isAdmin } = useIsAdmin();
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  const displayName = computeDisplayName(user);
  const initial = computeInitial(displayName);

  return (
    <SiteHeaderView
      pathname={loc.pathname}
      open={open}
      onOpenChange={setOpen}
      isAdmin={isAdmin}
      loading={loading}
      isAuthenticated={!!user}
      displayName={displayName}
      initial={initial}
      onSignOut={signOut}
    />
  );
}