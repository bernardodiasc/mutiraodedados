import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Bookmark,
  CircleDashed,
  HelpCircle,
  Loader2,
  Lock,
  Trash2,
} from "lucide-react";
import type { Pergunta } from "@/lib/perguntas.functions";
import { formatarDataPt, formatarStatusPergunta } from "@/lib/caderno-perguntas/logic";

export type CadernoPerguntasSalvasViewProps = {
  perguntas: Pergunta[];
  isLoading: boolean;
  errorMsg: string | null;
  removingId: string | null;
  onRemover: (id: string) => void;
};

export function CadernoPerguntasSalvasView({
  perguntas,
  isLoading,
  errorMsg,
  removingId,
  onRemover,
}: CadernoPerguntasSalvasViewProps) {
  if (isLoading) {
    return (
      <div className="border border-border rounded-xl p-8 bg-card flex items-center gap-3 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Carregando perguntas salvas…
      </div>
    );
  }
  if (errorMsg) {
    return (
      <div className="border border-destructive/30 bg-destructive/5 rounded-xl p-6 text-sm text-destructive">
        Não foi possível carregar seu caderno. {errorMsg}
      </div>
    );
  }
  if (perguntas.length === 0) {
    return (
      <div className="border border-dashed border-border rounded-xl p-8 bg-card text-center">
        <Bookmark className="size-8 text-muted-foreground mx-auto" />
        <h2 className="font-display text-xl mt-3">Seu caderno ainda está vazio.</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
          Comece criando uma pergunta — em branco ou a partir de um modelo. Toda pergunta nasce
          privada no seu caderno.
        </p>
        <div className="mt-5 flex flex-wrap gap-2 justify-center">
          <Link
            to="/perguntas"
            className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-md bg-foreground text-background hover:opacity-90"
          >
            <HelpCircle className="size-3.5" /> Ver modelos de pergunta
          </Link>
          <Link
            to="/lacunas"
            className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-md border border-border hover:bg-muted"
          >
            <CircleDashed className="size-3.5" /> Ver lacunas
          </Link>
          <Link
            to="/anomalias"
            className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-md border border-border hover:bg-muted"
          >
            Ver sinais <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </div>
    );
  }
  return (
    <div>
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="font-display text-2xl">
          Perguntas salvas{" "}
          <span className="text-muted-foreground font-sans text-base font-normal">
            ({perguntas.length})
          </span>
        </h2>
        <Link
          to="/perguntas"
          className="text-xs font-semibold hover:text-accent inline-flex items-center gap-1"
        >
          Ver modelos <ArrowRight className="size-3" />
        </Link>
      </div>
      <ul className="grid gap-3">
        {perguntas.map((p) => (
          <li key={p.id} className="border border-border rounded-xl p-5 bg-card">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <Link
                  to="/caderno/$id"
                  params={{ id: p.id }}
                  className="font-display text-lg leading-snug hover:text-accent"
                >
                  {p.titulo}
                </Link>
                {p.contexto ? (
                  <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                    {p.contexto}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => onRemover(p.id)}
                disabled={removingId === p.id}
                aria-label="Remover pergunta"
                className="text-muted-foreground hover:text-destructive p-1.5 rounded-md hover:bg-muted disabled:opacity-50"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted">
                {formatarStatusPergunta(p.status)}
              </span>
              <span>Salva em {formatarDataPt(p.created_at)}</span>
              {!p.visibilidade_publica && (
                <span className="inline-flex items-center gap-1">
                  <Lock className="size-3" /> Privada
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

CadernoPerguntasSalvasView.displayName = "CadernoPerguntasSalvasView";