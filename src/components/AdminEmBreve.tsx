import { Construction } from "lucide-react";
import { AdminHeader } from "@/components/AdminHeader";

export function AdminEmBreve({ titulo, descricao }: { titulo: string; descricao: string }) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 space-y-8">
      <AdminHeader titulo={titulo}>{descricao}</AdminHeader>
      <div className="rounded-xl border border-dashed border-border bg-card/50 p-10 text-center">
        <Construction className="size-8 mx-auto text-muted-foreground" />
        <p className="mt-3 text-sm text-muted-foreground">Em breve.</p>
      </div>
    </div>
  );
}
