import * as React from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { AdminNav } from "@/components/AdminNav";

export type AdminHeaderProps = {
  titulo: React.ReactNode;
  /** Subtítulo/descrição opcional da página. */
  children?: React.ReactNode;
};

/**
 * Cabeçalho padrão de todas as páginas do admin: link "voltar ao painel",
 * título, subtítulo e a navegação horizontal — com espaçamento único para
 * garantir consistência entre as telas.
 */
export function AdminHeader({ titulo, children }: AdminHeaderProps) {
  return (
    <div className="space-y-6">
      <Link
        to="/admin"
        className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
      >
        <ArrowLeft className="size-3.5" /> voltar ao painel
      </Link>
      <header className="space-y-1">
        <h1 className="font-display text-4xl">{titulo}</h1>
        {children ? <p className="text-sm text-muted-foreground max-w-2xl">{children}</p> : null}
      </header>
      <AdminNav />
    </div>
  );
}

AdminHeader.displayName = "AdminHeader";
