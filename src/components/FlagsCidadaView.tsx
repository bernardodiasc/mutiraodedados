import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ThumbsDown, ThumbsUp, Flag } from "lucide-react";
import { TIPOS, formatDataCurta } from "@/lib/flags-cidada/logic";

export type FlagRow = {
  id: string;
  user_id: string;
  entidade_tipo: string;
  entidade_id: string;
  tipo: string;
  comentario: string | null;
  created_at: string;
  displayName?: string | null;
};

export type FlagsCidadaViewProps = {
  hasUser: boolean;
  loading: boolean;
  flags: FlagRow[];
  votes: Record<string, number>;
  tipo: string;
  onTipoChange: (t: string) => void;
  comentario: string;
  onComentarioChange: (v: string) => void;
  onSubmit: () => void;
  onVote: (flagId: string, valor: 1 | -1) => void;
};

export function FlagsCidadaView({
  hasUser,
  loading,
  flags,
  votes,
  tipo,
  onTipoChange,
  comentario,
  onComentarioChange,
  onSubmit,
  onVote,
}: FlagsCidadaViewProps) {
  return (
    <div className="border border-border rounded-xl p-5 bg-card">
      {!hasUser ? (
        <div className="text-sm text-muted-foreground">
          <Link to="/login" className="text-accent font-semibold">Entre</Link> para marcar suspeitas, confirmar regularidade ou adicionar contexto a esta entidade.
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {TIPOS.map((t) => (
              <button
                key={t.v}
                onClick={() => onTipoChange(t.v)}
                className={`text-xs px-3 py-1.5 rounded-full border ${tipo === t.v ? "bg-accent text-accent-foreground border-accent" : "border-border hover:bg-muted"}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <Textarea
            value={comentario}
            onChange={(e) => onComentarioChange(e.target.value)}
            placeholder="Conte o que viu, por que importa, links se houver…"
            rows={3}
          />
          <Button onClick={onSubmit} size="sm">
            <Flag className="size-3.5 mr-1" /> Enviar marcação
          </Button>
        </div>
      )}

      <div className="mt-5 space-y-3">
        {loading ? (
          <div className="text-sm text-muted-foreground">Carregando…</div>
        ) : flags.length === 0 ? (
          <div className="text-sm text-muted-foreground">Nenhuma marcação ainda.</div>
        ) : (
          flags.map((f) => (
            <div key={f.id} className="border-t border-border pt-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-accent">{f.tipo}</div>
                <div className="text-xs text-muted-foreground">
                  {f.displayName ?? "anônimo"} · {formatDataCurta(f.created_at)}
                </div>
              </div>
              {f.comentario && <p className="text-sm mt-1">{f.comentario}</p>}
              <div className="flex items-center gap-1 mt-2">
                <button
                  disabled={!hasUser}
                  onClick={() => onVote(f.id, 1)}
                  className="text-xs px-2 py-1 rounded hover:bg-muted disabled:opacity-40 inline-flex items-center gap-1"
                >
                  <ThumbsUp className="size-3" />
                </button>
                <button
                  disabled={!hasUser}
                  onClick={() => onVote(f.id, -1)}
                  className="text-xs px-2 py-1 rounded hover:bg-muted disabled:opacity-40 inline-flex items-center gap-1"
                >
                  <ThumbsDown className="size-3" />
                </button>
                <span className="text-xs text-muted-foreground ml-1">{votes[f.id] ?? 0}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

FlagsCidadaView.displayName = "FlagsCidadaView";