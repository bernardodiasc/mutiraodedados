import * as React from "react";
import { ChevronDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export type FormColapsavelProps = {
  /** Rótulo do cabeçalho, ex.: "Novo artigo". */
  titulo: string;
  /** Começa aberto? Padrão: fechado. */
  aberto?: boolean;
  onAbertoChange?: (aberto: boolean) => void;
  children: React.ReactNode;
};

/**
 * Card com cabeçalho clicável que expande o formulário de criação. Mantém a
 * listagem em foco: o form só ocupa espaço quando o usuário quer criar algo.
 *
 * Estado de abrir/fechar é transiente de UI — aceitável no componente (padrão
 * do projeto para collapse local). Pode ser controlado via `aberto`/`onAbertoChange`.
 */
export function FormColapsavel({ titulo, aberto, onAbertoChange, children }: FormColapsavelProps) {
  const [internoAberto, setInternoAberto] = React.useState(false);
  const isControlado = aberto !== undefined;
  const estaAberto = isControlado ? aberto : internoAberto;

  const alternar = () => {
    const proximo = !estaAberto;
    if (!isControlado) setInternoAberto(proximo);
    onAbertoChange?.(proximo);
  };

  return (
    <div className="rounded-xl border border-border bg-card">
      <button
        type="button"
        data-flat
        onClick={alternar}
        aria-expanded={estaAberto}
        className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left"
      >
        <span className="inline-flex items-center gap-2 font-display text-lg">
          <Plus className="size-4 text-accent" /> {titulo}
        </span>
        <ChevronDown
          className={cn(
            "size-4 text-muted-foreground transition-transform",
            estaAberto && "rotate-180",
          )}
        />
      </button>
      {estaAberto && <div className="border-t border-border px-5 py-4">{children}</div>}
    </div>
  );
}

FormColapsavel.displayName = "FormColapsavel";
