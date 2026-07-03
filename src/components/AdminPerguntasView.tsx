import * as React from "react";
import { AdminHeader } from "@/components/AdminHeader";

export type AdminPerguntasAba = "modelos" | "moderacao" | "publicas";

const ABAS: { chave: AdminPerguntasAba; label: string }[] = [
  { chave: "modelos", label: "Modelos" },
  { chave: "moderacao", label: "Moderação" },
  { chave: "publicas", label: "Publicadas" },
];

export type AdminPerguntasViewProps = {
  aba: AdminPerguntasAba;
  onAbaChange: (a: AdminPerguntasAba) => void;
  /** Conteúdo da aba ativa (sub-container). */
  children: React.ReactNode;
};

export function AdminPerguntasView({ aba, onAbaChange, children }: AdminPerguntasViewProps) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 space-y-8">
      <AdminHeader titulo="Perguntas">
        Curadoria de <strong>modelos</strong> (pontos de partida exibidos em /perguntas) e
        <strong> moderação</strong> de investigações que cidadãos solicitaram publicar.
      </AdminHeader>
      <div className="flex gap-1 border-b border-border">
        {ABAS.map((t) => (
          <button
            key={t.chave}
            type="button"
            onClick={() => onAbaChange(t.chave)}
            className={`px-3 py-2 text-sm font-semibold border-b-2 -mb-px ${
              aba === t.chave
                ? "border-accent text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div>{children}</div>
    </div>
  );
}

AdminPerguntasView.displayName = "AdminPerguntasView";
