import * as React from "react";
import { Copy, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  type AnomaliaInput,
  ORIGEM_LABEL,
  SEVERIDADE_LABEL,
  STATUS_LABEL,
} from "@/lib/anomalia";
import { ReporteOficialModal } from "@/components/ReporteOficialModal";

export type AnomaliaActions = {
  onRevalidar?: () => Promise<void>;
  onConfirmar?: () => Promise<void>;
  onReportar?: (canal: string, protocolo: string) => Promise<void>;
  onMarcarFalsoPositivo?: () => Promise<void>;
  onMarcarCorrigido?: () => Promise<void>;
  onSalvarNota?: (nota: string) => Promise<void>;
};

function fmtBRL(n?: number | null) {
  if (n == null) return "—";
  return Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtData(s?: string | null) {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleString("pt-BR");
  } catch {
    return s;
  }
}

export function AnomaliaInvestigacao({
  anomalia,
  actions,
  notaInicial,
  modo = "admin",
  curls,
  flush = false,
}: {
  anomalia: AnomaliaInput;
  actions?: AnomaliaActions;
  notaInicial?: string | null;
  modo?: "admin" | "publico";
  curls?: Array<{ label: string; command: string; nota?: string }>;
  /** Quando true, remove a borda/fundo do card e usa padding menor — para
   * compor um card único com o registro acima. */
  flush?: boolean;
}) {
  const [modalAberto, setModalAberto] = React.useState(false);
  const [nota, setNota] = React.useState(notaInicial ?? "");
  const [busy, setBusy] = React.useState<string | null>(null);

  const sevColor =
    anomalia.severidade === "critico"
      ? "bg-destructive/15 text-destructive"
      : anomalia.severidade === "aviso"
        ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
        : "bg-muted text-muted-foreground";

  const runWith = async (key: string, fn?: () => Promise<void>) => {
    if (!fn) return;
    setBusy(key);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      className={
        flush
          ? "p-4 space-y-4"
          : "rounded-xl border border-border bg-card p-5 space-y-4"
      }
    >
      <header className="flex flex-wrap items-center gap-2">
        <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${sevColor}`}>
          {SEVERIDADE_LABEL[anomalia.severidade]}
        </span>
        <span
          className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
          title="Detectado automaticamente por heurística sobre o cache"
        >
          {ORIGEM_LABEL[anomalia.origem]}
        </span>
        <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-accent/15 text-accent">
          {STATUS_LABEL[anomalia.status]}
        </span>
        {anomalia.revalidado_em && (
          <span
            className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
            title={`Re-checado contra a fonte oficial em ${fmtData(anomalia.revalidado_em)}`}
          >
            Re-checado manualmente
          </span>
        )}
        <span className="text-xs text-muted-foreground">· {anomalia.fonte}</span>
        <span className="ml-auto text-xs text-muted-foreground">Detectado em {fmtData(anomalia.detectado_em)}</span>
      </header>

      <div className="text-sm">
        <div className="font-medium">
          {anomalia.entidade.rotulo ? (
            <span>{anomalia.entidade.rotulo}</span>
          ) : (
            <>
              {anomalia.entidade.tipo}{" "}
              <code className="text-xs">{anomalia.entidade.id}</code>
            </>
          )}
        </div>
        <div className="text-xs text-muted-foreground">Regra: {anomalia.regra}</div>
        <div className="mt-2 flex flex-wrap gap-3 text-xs">
          {anomalia.entidade.url_interno && (
            <a
              href={anomalia.entidade.url_interno}
              target="_blank"
              rel="noreferrer noopener"
              className="text-accent inline-flex items-center gap-1"
            >
              Registro interno <ExternalLink className="size-3" />
            </a>
          )}
          {anomalia.entidade.url_oficial && (
            <a
              href={anomalia.entidade.url_oficial}
              target="_blank"
              rel="noreferrer noopener"
              className="text-accent inline-flex items-center gap-1"
            >
              Fonte oficial <ExternalLink className="size-3" />
            </a>
          )}
        </div>
      </div>

      {anomalia.comparacao && (
        <div className="rounded-md border border-border bg-muted/30 p-3 text-sm grid sm:grid-cols-2 gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
              {anomalia.comparacao.armazenadoLabel ?? "Valor armazenado"}
            </div>
            <div className="font-mono">{fmtBRL(anomalia.comparacao.armazenado)}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
              {anomalia.comparacao.esperadoLabel ?? "Valor esperado (detalhe)"}
            </div>
            <div className="font-mono">{fmtBRL(anomalia.comparacao.esperado)}</div>
          </div>
          {anomalia.comparacao.observacao && (
            <p className="sm:col-span-2 text-xs text-muted-foreground">
              {anomalia.comparacao.observacao}
            </p>
          )}
        </div>
      )}

      <div>
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Trilha</div>
        <ul className="text-xs space-y-1">
          {anomalia.trilha.map((t, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-muted-foreground tabular-nums">{fmtData(t.em)}</span>
              <span>{t.descricao}</span>
            </li>
          ))}
        </ul>
      </div>

      {modo === "admin" && actions && (
        <div className="border-t border-border pt-3 space-y-3">
          <div className="flex flex-wrap gap-2">
            {actions.onRevalidar && (
              <Button size="sm" variant="outline" onClick={() => runWith("rev", actions.onRevalidar)} disabled={!!busy}>
                {busy === "rev" ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : null}
                Re-checar contra a fonte oficial
              </Button>
            )}
            {actions.onConfirmar && anomalia.status === "aberto" && (
              <Button size="sm" variant="outline" onClick={() => runWith("conf", actions.onConfirmar)} disabled={!!busy}>
                {busy === "conf" ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : null}
                Confirmar
              </Button>
            )}
            {actions.onReportar && (
              <Button size="sm" onClick={() => setModalAberto(true)} disabled={!!busy}>
                Preparar reporte oficial
              </Button>
            )}
            {actions.onMarcarCorrigido && (
              <Button size="sm" variant="outline" onClick={() => runWith("cor", actions.onMarcarCorrigido)} disabled={!!busy}>
                Marcar corrigido na origem
              </Button>
            )}
            {actions.onMarcarFalsoPositivo && (
              <Button size="sm" variant="ghost" onClick={() => runWith("fp", actions.onMarcarFalsoPositivo)} disabled={!!busy}>
                Falso positivo
              </Button>
            )}
          </div>

          {curls && curls.length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground select-none">
                Verificar manualmente (cURL)
              </summary>
              <div className="mt-2 space-y-3">
                {curls.map((c, i) => (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium text-foreground">{c.label}</div>
                      <Button
                        size="sm"
                        variant="outline"
                        type="button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(c.command);
                            toast.success(`${c.label}: copiado.`);
                          } catch {
                            toast.error("Não foi possível copiar.");
                          }
                        }}
                      >
                        <Copy className="size-3.5 mr-1.5" /> Copiar
                      </Button>
                    </div>
                    {c.nota && <p className="text-muted-foreground">{c.nota}</p>}
                    <pre className="rounded-md border border-border bg-muted/30 p-2 overflow-x-auto font-mono text-[11px] whitespace-pre-wrap break-all">
{c.command}
                    </pre>
                  </div>
                ))}
                <p className="text-muted-foreground">
                  Substitua <code>$PORTAL_TRANSPARENCIA_API_KEY</code> pela sua chave
                  do Portal da Transparência ao executar no terminal.
                </p>
              </div>
            </details>
          )}

          {actions.onSalvarNota && (
            <div className="space-y-1">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Notas internas</div>
              <Textarea value={nota} onChange={(e) => setNota(e.target.value)} rows={3} maxLength={4000} />
              <Button
                size="sm"
                variant="outline"
                onClick={() => runWith("nota", () => actions.onSalvarNota!(nota))}
                disabled={!!busy}
              >
                {busy === "nota" ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : null}
                Salvar nota
              </Button>
            </div>
          )}

          {actions.onReportar && (
            <ReporteOficialModal
              open={modalAberto}
              onOpenChange={setModalAberto}
              anomalia={anomalia}
              onConfirmar={actions.onReportar}
            />
          )}
        </div>
      )}
    </div>
  );
}