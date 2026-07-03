import { AlertTriangle, Camera, ExternalLink, Loader2, Lock, RefreshCw, Trash2 } from "lucide-react";
import type { ItemSalvo } from "@/lib/itens-salvos.functions";
import { tipoVerificavel } from "@/lib/itens-salvos/logic";
import { formatarDataPt } from "@/lib/caderno-itens/logic";

export type CadernoItensSalvosViewProps = {
  itens: ItemSalvo[];
  isLoading: boolean;
  errorMsg: string | null;
  removingId: string | null;
  onRemover: (id: string) => void;
  verificandoId: string | null;
  /** Re-busca o dado ao vivo e compara com o snapshot (não substitui). */
  onVerificar: (id: string) => void;
  /** Substitui o snapshot pelo dado ao vivo (ação explícita). */
  onAtualizarSnapshot: (id: string) => void;
};

export function CadernoItensSalvosView({
  itens,
  isLoading,
  errorMsg,
  removingId,
  onRemover,
  verificandoId,
  onVerificar,
  onAtualizarSnapshot,
}: CadernoItensSalvosViewProps) {
  if (isLoading) {
    return (
      <div className="border border-border rounded-xl p-6 bg-card flex items-center gap-3 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Carregando itens salvos…
      </div>
    );
  }
  if (errorMsg) {
    return (
      <div className="border border-destructive/30 bg-destructive/5 rounded-xl p-6 text-sm text-destructive">
        Não foi possível carregar seus itens. {errorMsg}
      </div>
    );
  }
  if (itens.length === 0) {
    return (
      <div className="border border-dashed border-border rounded-xl p-6 bg-card">
        <h2 className="font-display text-xl">Itens salvos</h2>
        <p className="text-sm text-muted-foreground mt-2">
          Quando você encontrar um órgão, contrato ou sinal relevante, toque em{" "}
          <strong>Salvar no caderno</strong> e ele aparece aqui — só você verá.
        </p>
      </div>
    );
  }
  return (
    <div>
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="font-display text-2xl">
          Itens salvos{" "}
          <span className="text-muted-foreground font-sans text-base font-normal">
            ({itens.length})
          </span>
        </h2>
      </div>
      <ul className="grid gap-3">
        {itens.map((item) => (
          <li key={item.id} className="border border-border rounded-xl p-5 bg-card">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-accent">
                  {item.entidade_tipo}
                </div>
                <h3 className="font-display text-lg leading-snug mt-1">
                  {item.url ? (
                    <a
                      href={item.url}
                      className="hover:underline inline-flex items-center gap-1"
                    >
                      {item.titulo}
                      <ExternalLink className="size-3.5 opacity-60" />
                    </a>
                  ) : (
                    item.titulo
                  )}
                </h3>
                {item.contexto ? (
                  <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                    {item.contexto}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => onRemover(item.id)}
                disabled={removingId === item.id}
                aria-label="Remover item"
                className="text-muted-foreground hover:text-destructive p-1.5 rounded-md hover:bg-muted disabled:opacity-50 shrink-0"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <span>Salvo em {formatarDataPt(item.created_at)}</span>
              <span className="inline-flex items-center gap-1">
                <Lock className="size-3" /> Privado
              </span>
              {item.snapshot_em && (
                <span className="inline-flex items-center gap-1" title="Cópia dos dados no momento em que você salvou — valor de prova.">
                  <Camera className="size-3" /> Snapshot de {formatarDataPt(item.snapshot_em)}
                </span>
              )}
              {item.snapshot_divergiu_em && (
                <span className="inline-flex items-center gap-1 text-amber-600 font-semibold">
                  <AlertTriangle className="size-3" /> Mudou desde o snapshot
                </span>
              )}
              {item.snapshot_em && tipoVerificavel(item.entidade_tipo) && (
                <>
                  <button
                    type="button"
                    onClick={() => onVerificar(item.id)}
                    disabled={verificandoId === item.id}
                    className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 hover:bg-muted disabled:opacity-50"
                  >
                    {verificandoId === item.id ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <RefreshCw className="size-3" />
                    )}
                    Verificar mudança
                  </button>
                  {item.snapshot_divergiu_em && (
                    <button
                      type="button"
                      onClick={() => onAtualizarSnapshot(item.id)}
                      disabled={verificandoId === item.id}
                      className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 hover:bg-muted disabled:opacity-50"
                    >
                      <Camera className="size-3" /> Atualizar snapshot
                    </button>
                  )}
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

CadernoItensSalvosView.displayName = "CadernoItensSalvosView";