import { Link } from "@tanstack/react-router";
import { ArrowLeft, Construction } from "lucide-react";
import { AdminNav } from "@/components/AdminNav";

export function AdminEmBreve({ titulo, descricao }: { titulo: string; descricao: string }) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 space-y-6">
      <Link to="/admin" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
        <ArrowLeft className="size-3.5" /> voltar ao painel
      </Link>
      <header>
        <h1 className="font-display text-4xl">{titulo}</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{descricao}</p>
      </header>
      <AdminNav />
      <div className="rounded-xl border border-dashed border-border bg-card/50 p-10 text-center">
        <Construction className="size-8 mx-auto text-muted-foreground" />
        <p className="mt-3 text-sm text-muted-foreground">Em breve.</p>
      </div>
    </div>
  );
}