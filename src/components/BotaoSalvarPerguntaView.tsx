import { Link, useRouterState } from "@tanstack/react-router";
import { Bookmark, Check, Loader2, LogIn } from "lucide-react";
import type { BotaoSalvarPerguntaEstado } from "@/lib/botao-salvar-pergunta/logic";

export type BotaoSalvarPerguntaViewProps = {
  estado: BotaoSalvarPerguntaEstado;
  onSave: () => void;
  className?: string;
};

const BASE =
  "inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md transition";

export function BotaoSalvarPerguntaView({
  estado,
  onSave,
  className = "",
}: BotaoSalvarPerguntaViewProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (estado === "deslogado") {
    return (
      <Link
        to="/login"
        search={{ redirect: pathname }}
        className={`${BASE} border border-border hover:bg-muted ${className}`}
      >
        <LogIn className="size-3.5" /> Entrar para salvar
      </Link>
    );
  }
  if (estado === "salvo") {
    return (
      <span
        className={`${BASE} bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ${className}`}
      >
        <Check className="size-3.5" /> Salvo no caderno
      </span>
    );
  }
  const isPending = estado === "salvando";
  return (
    <button
      type="button"
      onClick={onSave}
      disabled={isPending}
      className={`${BASE} bg-foreground text-background hover:opacity-90 disabled:opacity-60 ${className}`}
    >
      {isPending ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <Bookmark className="size-3.5" />
      )}
      Salvar pergunta
    </button>
  );
}

BotaoSalvarPerguntaView.displayName = "BotaoSalvarPerguntaView";