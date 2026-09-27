import * as React from "react";
import { AlertTriangle, Check, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ROTULO_MOTIVO_REVISAO } from "@/lib/artigo-referencias/logic";
import type { ReferenciaArtigo, SugestaoReferencia } from "@/lib/data/artigo-referencias.functions";

export type FormManual = { tipo: "registro" | "consulta"; a: string; b: string };

export type NovaReferencia =
  | { tipo: "registro"; colecao: string; idOrigem: string }
  | { tipo: "consulta"; consultaUrl: string };

export type ReferenciasArtigoViewProps = {
  estado: "carregando" | "erro" | "pronto";
  mensagemErro: string | null;
  referencias: ReferenciaArtigo[];
  sugestoes: SugestaoReferencia[];
  /** Coleções aceitas no cadastro manual de registro. */
  colecoes: readonly string[];
  busy: boolean;
  /** Cadastro manual: coleção e id (registro) ou link de /buscar em `a` (consulta). */
  manual: FormManual;
  setManual: React.Dispatch<React.SetStateAction<FormManual>>;
  onConfirmar: (nova: NovaReferencia) => void;
  onRemover: (id: string) => void;
  onVerificar: (id: string) => void;
  onAtualizarSugestoes: () => void;
};

const ROTULO_SITUACAO: Record<SugestaoReferencia["situacao"], string> = {
  nova: "nova",
  ja_cadastrada: "já cadastrada",
  ambigua: "ambígua: escolha o registro",
  nao_encontrada: "não encontrada no acervo público (link quebrado ou tipo ainda não indexado)",
};

const fmtData = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "nunca";

/**
 * Referências do artigo a registros e consultas: sugestões a partir dos links
 * do texto, cadastro manual, verificação e o alerta de revisão.
 */
export function ReferenciasArtigoView(p: ReferenciasArtigoViewProps) {
  const { manual, setManual } = p;
  const novas = p.sugestoes.filter((s) => s.situacao !== "ja_cadastrada");

  return (
    <section aria-labelledby="refs-titulo" className="space-y-3 border-t pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <h4 id="refs-titulo" className="font-display text-sm">
          Referências a registros e consultas
        </h4>
        <span className="text-xs text-muted-foreground">
          Aparecem em &ldquo;Aprenda a investigar este registro&rdquo; nas fichas e avisam quando o
          artigo precisa de revisão.
        </span>
      </div>

      {p.estado === "carregando" && <p className="text-xs text-muted-foreground">Carregando…</p>}
      {p.estado === "erro" && (
        <p role="alert" className="text-xs text-destructive">
          {p.mensagemErro}
        </p>
      )}

      {p.estado === "pronto" && (
        <>
          <ul className="space-y-1.5 text-xs">
            {p.referencias.length === 0 && (
              <li className="text-muted-foreground">Nenhuma referência cadastrada.</li>
            )}
            {p.referencias.map((r) => (
              <li key={r.id} className="flex flex-wrap items-start gap-2 rounded border p-2">
                <div className="flex-1 min-w-0">
                  <div>
                    <span className="uppercase tracking-wider text-[10px] text-muted-foreground mr-1">
                      {r.tipo}
                    </span>
                    {r.href ? (
                      <a href={r.href} className="underline" target="_blank" rel="noreferrer">
                        {r.tipo === "consulta" ? r.consultaUrl : (r.tituloCitado ?? r.idOrigem)}
                      </a>
                    ) : (
                      <span>{r.tituloCitado ?? r.idOrigem}</span>
                    )}
                    {r.tipo === "registro" && (
                      <span className="ml-1 font-mono text-muted-foreground">
                        {r.colecao} · {r.idOrigem}
                      </span>
                    )}
                  </div>
                  <div className="text-muted-foreground">verificada: {fmtData(r.verificadoEm)}</div>
                  {r.motivos.map((m) => (
                    <div key={m} className="flex items-center gap-1 text-destructive">
                      <AlertTriangle className="size-3" aria-hidden /> Necessita revisão:{" "}
                      {ROTULO_MOTIVO_REVISAO[m]}
                    </div>
                  ))}
                </div>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => p.onVerificar(r.id)}
                    disabled={p.busy}
                  >
                    <Check className="size-3.5 mr-1" /> Verificado
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => p.onRemover(r.id)}
                    disabled={p.busy}
                    aria-label="Remover referência"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>

          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-medium">
              Sugestões a partir dos links do texto
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={p.onAtualizarSugestoes}
                disabled={p.busy}
              >
                <RefreshCw className="size-3.5 mr-1" /> Ler o texto salvo de novo
              </Button>
            </div>
            {novas.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Nenhuma sugestão nova: todo link interno do texto salvo já é referência.
              </p>
            ) : (
              <ul className="space-y-1.5 text-xs">
                {novas.map((s) => (
                  <li key={s.caminho} className="rounded border border-dashed p-2">
                    <div>
                      <span className="font-mono">{s.caminho}</span>
                      {s.texto && <span className="text-muted-foreground"> — “{s.texto}”</span>}
                    </div>
                    <div className="text-muted-foreground">{ROTULO_SITUACAO[s.situacao]}</div>
                    {s.situacao === "nova" && (
                      <Button
                        type="button"
                        size="sm"
                        className="mt-1"
                        disabled={p.busy}
                        onClick={() =>
                          p.onConfirmar(
                            s.tipo === "consulta"
                              ? { tipo: "consulta", consultaUrl: s.consultaUrl! }
                              : { tipo: "registro", colecao: s.colecao!, idOrigem: s.idOrigem! },
                          )
                        }
                      >
                        <Plus className="size-3.5 mr-1" />
                        {s.tipo === "consulta" ? "Adicionar consulta" : `Adicionar: ${s.titulo}`}
                      </Button>
                    )}
                    {s.situacao === "ambigua" &&
                      s.candidatos?.map((c) => (
                        <Button
                          key={c.colecao + c.idOrigem}
                          type="button"
                          size="sm"
                          variant="outline"
                          className="mt-1 mr-1"
                          disabled={p.busy}
                          onClick={() =>
                            p.onConfirmar({
                              tipo: "registro",
                              colecao: c.colecao,
                              idOrigem: c.idOrigem,
                            })
                          }
                        >
                          {c.titulo} <span className="ml-1 font-mono">({c.colecao})</span>
                        </Button>
                      ))}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-wrap items-end gap-2 text-xs">
            <label className="flex flex-col gap-0.5">
              Tipo
              <select
                value={manual.tipo}
                onChange={(e) =>
                  setManual({
                    tipo: e.target.value as "registro" | "consulta",
                    a: e.target.value === "registro" ? (p.colecoes[0] ?? "") : "",
                    b: "",
                  })
                }
                className="rounded border bg-background p-1"
              >
                <option value="registro">registro</option>
                <option value="consulta">consulta</option>
              </select>
            </label>
            {manual.tipo === "registro" ? (
              <>
                <label className="flex flex-col gap-0.5">
                  Coleção
                  <select
                    value={manual.a}
                    onChange={(e) => setManual((m) => ({ ...m, a: e.target.value }))}
                    className="rounded border bg-background p-1 font-mono"
                  >
                    {p.colecoes.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-0.5">
                  Id de origem
                  <input
                    value={manual.b}
                    onChange={(e) => setManual((m) => ({ ...m, b: e.target.value }))}
                    className="rounded border bg-background p-1 font-mono"
                  />
                </label>
              </>
            ) : (
              <label className="flex flex-col gap-0.5 flex-1 min-w-48">
                Link de /buscar
                <input
                  value={manual.a}
                  onChange={(e) => setManual((m) => ({ ...m, a: e.target.value }))}
                  placeholder="/buscar?q=merenda&tipo=contratos"
                  className="rounded border bg-background p-1 font-mono"
                />
              </label>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={p.busy || !(manual.tipo === "registro" ? manual.b.trim() : manual.a.trim())}
              onClick={() => {
                p.onConfirmar(
                  manual.tipo === "registro"
                    ? { tipo: "registro", colecao: manual.a, idOrigem: manual.b.trim() }
                    : { tipo: "consulta", consultaUrl: manual.a.trim() },
                );
                setManual((m) => ({ ...m, b: "", a: m.tipo === "consulta" ? "" : m.a }));
              }}
            >
              {p.busy ? (
                <Loader2 className="size-3.5 mr-1 animate-spin" />
              ) : (
                <Plus className="size-3.5 mr-1" />
              )}
              Adicionar à mão
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
