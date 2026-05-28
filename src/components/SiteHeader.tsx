import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Menu, Shield, LogOut, ChevronDown, User, Bookmark } from "lucide-react";
import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { NAV_GROUPS, flattenGroupLinks } from "@/lib/nav-groups";

export function SiteHeader() {
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const { isAdmin } = useIsAdmin();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }
  const displayName =
    (user?.user_metadata as { display_name?: string; full_name?: string } | undefined)?.display_name ??
    (user?.user_metadata as { full_name?: string } | undefined)?.full_name ??
    user?.email?.split("@")[0] ??
    "Conta";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <header className="border-b border-border bg-background sticky top-0 z-40">
      <div className="mx-auto max-w-7xl px-4 h-16 flex items-center gap-6">
        <Link to="/" className="flex items-baseline gap-2">
          <span className="font-display text-2xl tracking-tight">AUDITORIA</span>
          <span className="font-display text-2xl text-accent">CIDADÃ</span>
        </Link>
        <nav className="hidden lg:flex items-center gap-1 text-sm font-medium">
          {NAV_GROUPS.map((g) => {
            const allLinks = flattenGroupLinks(g);
            const active = allLinks.some((l) => loc.pathname.startsWith(l.to));
            const GroupIcon = g.icon;
            const isMega = !!g.subgroups;
            return (
              <DropdownMenu key={g.label}>
                <DropdownMenuTrigger
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-md hover:bg-muted transition-colors outline-none ${active ? "text-accent" : "text-foreground"}`}
                >
                  <GroupIcon className="size-4" />
                  {g.label}
                  <ChevronDown className="size-3.5 opacity-70" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className={isMega ? "min-w-[36rem] p-3" : "min-w-64"}>
                  {g.featured && (() => {
                    const FeaturedIcon = g.featured.icon;
                    const isActive = loc.pathname.startsWith(g.featured.to);
                    return (
                      <Link
                        to={g.featured.to}
                        className={`mb-3 flex items-start gap-3 rounded-md border border-border bg-muted/40 p-3 hover:bg-muted transition-colors ${isActive ? "text-accent" : ""}`}
                      >
                        <FeaturedIcon className="size-6 mt-0.5 text-accent shrink-0" />
                        <div className="min-w-0">
                          <div className="font-semibold">{g.featured.label}</div>
                          {g.featured.description && (
                            <div className="text-xs text-muted-foreground mt-0.5 leading-snug">
                              {g.featured.description}
                            </div>
                          )}
                        </div>
                      </Link>
                    );
                  })()}
                  {g.subgroups && (
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                      {g.subgroups.map((sg) => (
                        <div key={sg.label}>
                          <div className="px-2 pb-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                            {sg.label}
                          </div>
                          {sg.links.map((l) => {
                            const ItemIcon = l.icon;
                            const isActive = loc.pathname.startsWith(l.to);
                            return (
                              <DropdownMenuItem key={l.to} asChild>
                                <Link
                                  to={l.to}
                                  className={`flex items-center gap-2 ${isActive ? "text-accent" : ""}`}
                                >
                                  <ItemIcon className="size-4 opacity-80" />
                                  {l.label}
                                </Link>
                              </DropdownMenuItem>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  )}
                  {g.links && g.links.map((l) => {
                    const ItemIcon = l.icon;
                    const isActive = loc.pathname.startsWith(l.to);
                    return (
                      <DropdownMenuItem key={l.to} asChild>
                        <Link
                          to={l.to}
                          className={`flex items-center gap-2 ${isActive ? "text-accent" : ""}`}
                        >
                          <ItemIcon className="size-4 opacity-80" />
                          {l.label}
                        </Link>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {loading ? (
            <span className="hidden lg:inline-flex text-sm font-medium px-3 py-2 text-muted-foreground">
              Autenticando…
            </span>
          ) : user ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                className="hidden lg:inline-flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted outline-none"
                title={displayName}
              >
                <span className="inline-flex items-center justify-center size-8 rounded-full bg-muted text-sm font-semibold">
                  {initial}
                </span>
                <ChevronDown className="size-3.5 opacity-70" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-56">
                <DropdownMenuLabel className="truncate">{displayName}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/minhas-marcacoes" className="flex items-center gap-2">
                    <Bookmark className="size-4" /> Minhas marcações
                  </Link>
                </DropdownMenuItem>
                {isAdmin && (
                  <DropdownMenuItem asChild>
                    <Link to="/admin" className="flex items-center gap-2 text-accent">
                      <Shield className="size-4" /> Admin
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut} className="text-muted-foreground">
                  <LogOut className="size-4 mr-2" /> Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link to="/login" className="hidden lg:inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-md hover:bg-muted">
              <User className="size-4" /> Entrar
            </Link>
          )}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger className="lg:hidden p-2"><Menu className="size-5" /></SheetTrigger>
            <SheetContent side="right" className="w-80 overflow-y-auto">
              <div className="flex flex-col gap-6 mt-8">
                {NAV_GROUPS.map((g) => {
                  const GroupIcon = g.icon;
                  const renderLink = (l: { to: string; label: string; icon: typeof GroupIcon }) => {
                    const ItemIcon = l.icon;
                    return (
                      <Link
                        key={l.to}
                        to={l.to}
                        onClick={() => setOpen(false)}
                        className="px-3 py-2 rounded-md hover:bg-muted text-sm flex items-center gap-2"
                      >
                        <ItemIcon className="size-4 opacity-80" />
                        {l.label}
                      </Link>
                    );
                  };
                  return (
                    <div key={g.label}>
                      <div className="px-3 text-xs uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1.5">
                        <GroupIcon className="size-3.5" />
                        {g.label}
                      </div>
                      <div className="flex flex-col">
                        {g.featured && renderLink(g.featured)}
                        {g.subgroups?.map((sg) => (
                          <div key={sg.label} className="mt-2">
                            <div className="px-3 text-[11px] uppercase tracking-wider text-muted-foreground/70 mb-0.5">
                              {sg.label}
                            </div>
                            {sg.links.map(renderLink)}
                          </div>
                        ))}
                        {g.links?.map(renderLink)}
                      </div>
                    </div>
                  );
                })}
                <div className="border-t border-border pt-4">
                  {user ? (
                    <>
                      <div className="px-3 text-xs uppercase tracking-wider text-muted-foreground mb-1 truncate">{displayName}</div>
                      <Link to="/minhas-marcacoes" onClick={() => setOpen(false)} className="px-3 py-2 rounded-md hover:bg-muted text-sm flex items-center gap-2">
                        <Bookmark className="size-4" /> Minhas marcações
                      </Link>
                      {isAdmin && (
                        <Link to="/admin" onClick={() => setOpen(false)} className="px-3 py-2 rounded-md hover:bg-muted text-sm text-accent flex items-center gap-2">
                          <Shield className="size-4" /> Admin
                        </Link>
                      )}
                      <button
                        onClick={() => { setOpen(false); signOut(); }}
                        className="w-full text-left px-3 py-2 rounded-md hover:bg-muted text-sm text-muted-foreground flex items-center gap-2"
                      >
                        <LogOut className="size-4" /> Sair
                      </button>
                    </>
                  ) : (
                    <Link to="/login" onClick={() => setOpen(false)} className="px-3 py-2 rounded-md hover:bg-muted text-sm flex items-center gap-2">
                      <User className="size-4" /> Entrar
                    </Link>
                  )}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
