import { Link, useRouterState } from "@tanstack/react-router";
import { Bookmark, BookmarkCheck, Loader2, FolderPlus, Check, Plus } from "lucide-react";
import type { BotaoSalvarItemEstado } from "@/lib/botao-salvar-item/logic";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type PastaOpcao = {
  id: string;
  titulo: string;
  status: string;
  presente: boolean;
};

export type BotaoSalvarItemViewProps = {
  estado: BotaoSalvarItemEstado;
  titulo: string;
  onSave: () => void;
  className?: string;
  /** Pastas (perguntas) do usuário. Quando undefined, não exibe o picker. */
  pastas?: PastaOpcao[];
  pastasLoading?: boolean;
  togglePastaId?: string | null;
  onTogglePasta?: (perguntaId: string) => void;
};

const BASE =
  "inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md border transition-colors";

export function BotaoSalvarItemView({
  estado,
  titulo,
  onSave,
  className = "",
  pastas,
  pastasLoading,
  togglePastaId,
  onTogglePasta,
}: BotaoSalvarItemViewProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (estado === "deslogado") {
    return (
      <Link
        to="/login"
        search={{ redirect: pathname }}
        className={`${BASE} border-border hover:bg-muted ${className}`}
        aria-label={`Entrar para salvar: ${titulo}`}
      >
        <Bookmark className="size-3.5" /> Entrar para salvar
      </Link>
    );
  }
  const disabled = estado === "salvando" || estado === "verificando";
  const principal =
    estado === "salvo" ? (
      <span
        className={`${BASE} border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400`}
      >
        <BookmarkCheck className="size-3.5" /> No seu caderno
      </span>
    ) : (
      <button
        type="button"
        onClick={onSave}
        disabled={disabled}
        aria-label={`Salvar no caderno: ${titulo}`}
        className={`${BASE} border-border hover:bg-muted disabled:opacity-60 disabled:cursor-not-allowed`}
      >
        {disabled ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Bookmark className="size-3.5" />
        )}{" "}
        Salvar no caderno
      </button>
    );

  const ativas = (pastas ?? []).filter((p) => p.status !== "arquivada");
  const presentes = ativas.filter((p) => p.presente).length;
  const showPicker = pastas !== undefined;

  return (
    <div className={`inline-flex items-center gap-2 flex-wrap ${className}`}>
      {principal}
      {showPicker && (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={`${BASE} border-border hover:bg-muted`}
              aria-label="Adicionar a pastas de investigação"
            >
              <FolderPlus className="size-3.5" />
              {presentes > 0
                ? `Em ${presentes} pasta${presentes > 1 ? "s" : ""}`
                : "Adicionar a pasta"}
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 p-2">
            <div className="px-2 py-1.5 text-xs uppercase tracking-wider text-muted-foreground">
              Pastas de investigação
            </div>
            {pastasLoading && (
              <div className="flex items-center gap-2 px-2 py-3 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" /> Carregando…
              </div>
            )}
            {!pastasLoading && ativas.length === 0 && (
              <p className="px-2 py-2 text-xs text-muted-foreground">
                Você ainda não tem perguntas no caderno.
              </p>
            )}
            {!pastasLoading && ativas.length > 0 && (
              <ul className="max-h-64 overflow-auto">
                {ativas.map((p) => {
                  const isToggling = togglePastaId === p.id;
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => onTogglePasta?.(p.id)}
                        disabled={isToggling}
                        className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted text-sm disabled:opacity-60"
                      >
                        <span
                          className={`inline-flex items-center justify-center size-4 rounded border ${
                            p.presente
                              ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
                              : "border-border"
                          }`}
                          aria-hidden
                        >
                          {isToggling ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : p.presente ? (
                            <Check className="size-3" />
                          ) : null}
                        </span>
                        <span className="flex-1 truncate">{p.titulo}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="border-t border-border mt-1 pt-1">
              <Link
                to="/caderno/nova"
                className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted text-sm text-accent"
              >
                <Plus className="size-3.5" /> Nova pergunta
              </Link>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

BotaoSalvarItemView.displayName = "BotaoSalvarItemView";
