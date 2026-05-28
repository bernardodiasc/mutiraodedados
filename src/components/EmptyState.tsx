import { Database } from "lucide-react";

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="border border-dashed border-border rounded-xl p-10 text-center">
      <Database className="size-8 mx-auto text-muted-foreground" />
      <h3 className="font-display text-lg mt-3">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
        {hint ?? "Carregue dados oficiais usando os botões “Buscar contratos” — a consulta vai direto à API do Portal da Transparência (CGU)."}
      </p>
    </div>
  );
}
