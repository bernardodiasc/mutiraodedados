import * as React from "react";
import { Download, Info, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { GRUPOS_FONTES } from "@/lib/data/cobertura-jobs";
import type { CoberturaResult, Fonte } from "@/lib/data/cobertura.functions";
import { ANO_INICIO_POR_FONTE } from "@/lib/data/janelas";
import { fmtDuration } from "@/lib/sincronizar-tudo/logic";

// Fontes cujos meses de recesso (jan/jul) legitimamente não têm dados.
const FONTES_COM_RECESSO = new Set<Fonte["fonte"]>(["camara_vot", "senado_vot"]);

export type SincronizarTudoPreview = {
  total: number;
  puladas: number;
  porFonte: Map<string, number>;
};

export type SincronizarTudoViewProps = {
  isRunning: boolean;
  loading: boolean;
  data: CoberturaResult | null;
  anoAtual: number;
  syncIni: number;
  syncFim: number;
  syncDelayMs: number;
  onChangeIni: (y: number) => void;
  onChangeFim: (y: number) => void;
  onChangeDelay: (ms: number) => void;
  fontesDisponiveis: Fonte["fonte"][];
  selecionadas: Set<string>;
  onToggleFonte: (id: string, v: boolean) => void;
  onToggleGrupo: (fontes: Fonte["fonte"][], v: boolean) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
  onRefresh: () => void;
  previa: SincronizarTudoPreview;
  onSincronizar: () => void;
};

export function SincronizarTudoView(props: SincronizarTudoViewProps) {
  const {
    isRunning,
    loading,
    data,
    anoAtual,
    syncIni,
    syncFim,
    syncDelayMs,
    onChangeIni,
    onChangeFim,
    onChangeDelay,
    selecionadas,
    onToggleFonte,
    onToggleGrupo,
    onSelectAll,
    onSelectNone,
    onRefresh,
    previa,
    onSincronizar,
  } = props;

  // Piso do seletor de ano = menor início entre as fontes disponíveis (ex.: 1988
  // para proposições/matérias), para casar com as janelas mostradas por fonte.
  const minAno = React.useMemo(() => {
    const inicios = (data?.fontes ?? [])
      .map((f) => ANO_INICIO_POR_FONTE[f.fonte])
      .filter((n): n is number => typeof n === "number");
    return inicios.length ? Math.min(...inicios) : 2003;
  }, [data]);
  const anosOpcoes = Array.from({ length: anoAtual - minAno + 1 }, (_, i) => minAno + i);

  return (
    <Collapsible defaultOpen className="rounded-xl border border-accent/30 bg-accent/[0.03]">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="w-full px-4 py-3 flex flex-wrap items-center gap-2 text-sm hover:bg-accent/[0.06] text-left"
        >
          <Download className="size-4 text-accent" />
          <span className="font-medium">Sincronizar tudo (multi-ano, fontes selecionadas)</span>
          <span className="text-xs text-muted-foreground">— retoma de onde parou</span>
          <span className="ml-auto text-xs text-muted-foreground">expandir / recolher</span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-4 pt-1 space-y-4">
        <div className="text-xs text-muted-foreground flex items-start gap-1.5 leading-relaxed">
          <Info className="size-3.5 mt-0.5 shrink-0" />
          <span>
            Baixa, mês a mês e fonte por fonte,{" "}
            <strong>apenas o que ainda não foi consultado</strong> dentro do intervalo
            selecionado. Células com dados e células já marcadas como
            "consultado, vazio" são <strong>excluídas da contagem e da execução</strong>.
            Marque/desmarque grupos ou fontes individuais para ajustar o lote.
            SICONFI exige código IBGE e fica de fora. A etiqueta{" "}
            <strong>desde AAAA</strong> indica a janela de cada fonte (anos anteriores são
            ignorados); nas votações, os meses de <strong>recesso (jan/jul)</strong> ficam
            naturalmente vazios.
          </span>
        </div>

        <div className="rounded-md border border-border bg-background/60 p-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Fontes
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onSelectAll} disabled={isRunning}>
                Tudo
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onSelectNone} disabled={isRunning}>
                Nada
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={onRefresh}
                disabled={isRunning || loading}
              >
                <RefreshCw className={`size-3 mr-1 ${loading ? "animate-spin" : ""}`} />
                Recarregar
              </Button>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {GRUPOS_FONTES.map((g) => {
              const fontesGrupo = (data?.fontes ?? []).filter((f) => g.fontes.includes(f.fonte));
              if (fontesGrupo.length === 0) return null;
              const allOn = fontesGrupo.every((f) => selecionadas.has(f.fonte));
              const someOn = fontesGrupo.some((f) => selecionadas.has(f.fonte));
              return (
                <div key={g.id} className="rounded border border-border/70 p-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold">
                    <Checkbox
                      checked={allOn ? true : someOn ? "indeterminate" : false}
                      onCheckedChange={(v) => onToggleGrupo(g.fontes, v === true)}
                      disabled={isRunning}
                    />
                    {g.label}
                  </label>
                  <div className="mt-1.5 ml-5 space-y-1">
                    {fontesGrupo.map((f) => {
                      const inicio = ANO_INICIO_POR_FONTE[f.fonte];
                      const recesso = FONTES_COM_RECESSO.has(f.fonte);
                      return (
                        <label key={f.fonte} className="flex items-start gap-2 cursor-pointer text-xs">
                          <Checkbox
                            checked={selecionadas.has(f.fonte)}
                            onCheckedChange={(v) => onToggleFonte(f.fonte, v === true)}
                            disabled={isRunning}
                            className="mt-0.5"
                          />
                          <span>
                            <span className="font-medium text-foreground">{f.titulo}</span>
                            {inicio ? (
                              <span className="ml-1.5 rounded bg-muted px-1 py-0.5 text-[10px] tabular-nums text-muted-foreground align-middle">
                                desde {inicio}
                              </span>
                            ) : null}
                            {recesso ? (
                              <span className="ml-1 text-[10px] text-muted-foreground align-middle">
                                · jan/jul: recesso
                              </span>
                            ) : null}
                          </span>
                        </label>
                      );
                    })}
                    {(g.id === "camara" || g.id === "senado") ? (
                      <label className="flex items-start gap-2 cursor-pointer text-xs">
                        <Checkbox
                          checked={selecionadas.has(g.id === "camara" ? "camara_deputados" : "senado_senadores")}
                          onCheckedChange={(v) =>
                            onToggleFonte(g.id === "camara" ? "camara_deputados" : "senado_senadores", v === true)
                          }
                          disabled={isRunning}
                          className="mt-0.5"
                        />
                        <span>
                          <span className="font-medium text-foreground">
                            {g.id === "camara" ? "Câmara — cadastro de deputados" : "Senado — cadastro de senadores"}
                          </span>
                          <span className="ml-1.5 rounded bg-muted px-1 py-0.5 text-[10px] text-muted-foreground align-middle">
                            por legislatura
                          </span>
                        </span>
                      </label>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3 text-sm">
          <div>
            <Label className="text-xs">Ano inicial</Label>
            <select
              className="mt-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              value={syncIni}
              onChange={(e) => onChangeIni(Number(e.target.value))}
              disabled={isRunning}
            >
              {anosOpcoes.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-xs">Ano final</Label>
            <select
              className="mt-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              value={syncFim}
              onChange={(e) => onChangeFim(Number(e.target.value))}
              disabled={isRunning}
            >
              {anosOpcoes.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-xs">Intervalo entre chamadas (ms)</Label>
            <select
              className="mt-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              value={syncDelayMs}
              onChange={(e) => onChangeDelay(Number(e.target.value))}
              disabled={isRunning}
            >
              <option value={0}>sem pausa</option>
              <option value={300}>300 ms</option>
              <option value={500}>500 ms</option>
              <option value={800}>800 ms (recomendado)</option>
              <option value={1500}>1,5 s (conservador)</option>
              <option value={3000}>3 s</option>
            </select>
          </div>
        </div>

        <div className="rounded-md border border-border bg-background/60 p-3 text-xs">
          {loading && !data ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" /> Carregando cobertura…
            </div>
          ) : (
            <>
              <div className="font-medium mb-1">
                {previa.total === 0
                  ? "Nada pendente — tudo já consultado nesse intervalo."
                  : `${previa.total.toLocaleString("pt-BR")} chamadas pendentes`}
                {previa.puladas > 0 && (
                  <span className="text-muted-foreground font-normal">
                    {" "}· {previa.puladas.toLocaleString("pt-BR")} já cobertas serão puladas
                  </span>
                )}
                {previa.total > 0 && syncDelayMs > 0 && (
                  <span className="text-muted-foreground font-normal">
                    {" "}· tempo mínimo ≈ {fmtDuration(previa.total * syncDelayMs)}
                  </span>
                )}
              </div>
              {previa.porFonte.size > 0 && (
                <ul className="text-muted-foreground grid sm:grid-cols-2 gap-x-4">
                  {Array.from(previa.porFonte.entries()).map(([k, v]) => (
                    <li key={k}>
                      {k}: <span className="tabular-nums">{v.toLocaleString("pt-BR")}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>

        <Button
          onClick={onSincronizar}
          disabled={isRunning || previa.total === 0 || !data || selecionadas.size === 0}
          className="bg-accent text-accent-foreground hover:bg-accent/90"
        >
          <Download className="size-4 mr-2" />
          Sincronizar {syncIni}–{syncFim}
        </Button>
      </CollapsibleContent>
    </Collapsible>
  );
}