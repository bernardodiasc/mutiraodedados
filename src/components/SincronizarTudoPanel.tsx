import * as React from "react";
import { useServerFn } from "@tanstack/react-start";
import { Download, Info, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { statusCobertura, type CoberturaResult, type Fonte } from "@/lib/data/cobertura.functions";
import { ORGAOS_BASE } from "@/lib/data/catalog";
import {
  useCoberturaJobBuilder,
  GRUPOS_FONTES,
  type CoberturaJob,
} from "@/lib/data/cobertura-jobs";

function fmtDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h}h${rem}min` : `${h}h`;
}

type Props = {
  isRunning: boolean;
  runJobs: (jobs: CoberturaJob[], title: string, unidade?: string) => Promise<void>;
};

export function SincronizarTudoPanel({ isRunning, runJobs }: Props) {
  const fetchCobertura = useServerFn(statusCobertura);
  const buildJob = useCoberturaJobBuilder();

  const [data, setData] = React.useState<CoberturaResult | null>(null);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchCobertura();
      setData(res);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [fetchCobertura]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const ANO_ATUAL = new Date().getFullYear();
  const [syncIni, setSyncIni] = React.useState<number>(2015);
  const [syncFim, setSyncFim] = React.useState<number>(ANO_ATUAL);
  const [syncDelayMs, setSyncDelayMs] = React.useState<number>(800);

  // Fontes selecionadas (por id de fonte). Default: tudo selecionado.
  const fontesDisponiveis = React.useMemo<Fonte["fonte"][]>(
    () =>
      GRUPOS_FONTES.flatMap((g) => g.fontes).filter((f) =>
        (data?.fontes ?? []).some((x) => x.fonte === f),
      ),
    [data],
  );
  const [selecionadas, setSelecionadas] = React.useState<Set<string>>(new Set());
  React.useEffect(() => {
    setSelecionadas(new Set(fontesDisponiveis));
  }, [fontesDisponiveis.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleFonte = (id: string, v: boolean) => {
    setSelecionadas((prev) => {
      const n = new Set(prev);
      if (v) n.add(id);
      else n.delete(id);
      return n;
    });
  };
  const toggleGrupo = (fontes: Fonte["fonte"][], v: boolean) => {
    setSelecionadas((prev) => {
      const n = new Set(prev);
      for (const f of fontes) {
        if (v) n.add(f);
        else n.delete(f);
      }
      return n;
    });
  };

  // Constrói jobs (pulando o que já tem dado ou foi tentado-vazio).
  const construirJobs = React.useCallback(
    (yIni: number, yFim: number, delayMs: number) => {
      if (!data) return [] as CoberturaJob[];
      const jobs: CoberturaJob[] = [];
      const tried = new Set<string>();
      for (const f of data.fontes) {
        for (const l of f.linhas) {
          for (const c of l.celulas) {
            if (c.qtd > 0 || c.tentado) tried.add(`${f.fonte}|${l.id}|${c.ano}|${c.mes}`);
          }
        }
      }
      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
      const wrapDelay = (job: CoberturaJob): CoberturaJob => ({
        label: job.label,
        run: async () => {
          const n = await job.run();
          if (delayMs > 0) await sleep(delayMs);
          return n;
        },
      });
      for (let y = yIni; y <= yFim; y++) {
        for (const f of data.fontes) {
          if (f.fonte === "siconfi") continue;
          if (!selecionadas.has(f.fonte)) continue;
          const linhasIds =
            f.fonte === "cgu"
              ? ORGAOS_BASE.filter((o) => o.disponivelPortal).map((o) => o.cod)
              : f.linhas.length > 0
                ? f.linhas.map((l) => l.id)
                : [f.fonte];
          for (const lid of linhasIds) {
            for (let m = 1; m <= 12; m++) {
              if (tried.has(`${f.fonte}|${lid}|${y}|${m}`)) continue;
              const j = buildJob(f.fonte, lid, y, m);
              if (j) jobs.push(wrapDelay(j));
            }
          }
        }
      }
      return jobs;
    },
    [data, buildJob, selecionadas],
  );

  const previa = React.useMemo(() => {
    const jobs = construirJobs(syncIni, syncFim, 0);
    const porFonte = new Map<string, number>();
    for (const j of jobs) {
      const k = j.label.split(" · ")[0];
      porFonte.set(k, (porFonte.get(k) ?? 0) + 1);
    }
    // Conta tambem o que SERIA pendente sem filtrar por "já tentado" (para
    // mostrar quantas vão ser puladas).
    let totalPossivel = 0;
    if (data) {
      const ANO = new Date().getFullYear();
      const MES = new Date().getMonth() + 1;
      for (let y = syncIni; y <= syncFim; y++) {
        for (const f of data.fontes) {
          if (f.fonte === "siconfi") continue;
          if (!selecionadas.has(f.fonte)) continue;
          const linhasIds =
            f.fonte === "cgu"
              ? ORGAOS_BASE.filter((o) => o.disponivelPortal).map((o) => o.cod)
              : f.linhas.length > 0
                ? f.linhas.map((l) => l.id)
                : [f.fonte];
          for (let _i = 0; _i < linhasIds.length; _i++) {
            for (let m = 1; m <= 12; m++) {
              // só conta dentro da janela e não-futuro
              const j = buildJob(f.fonte, linhasIds[_i], y, m);
              if (!j) continue;
              if (y === ANO && m > MES) continue;
              totalPossivel += 1;
            }
          }
        }
      }
    }
    return {
      total: jobs.length,
      porFonte,
      puladas: Math.max(0, totalPossivel - jobs.length),
    };
  }, [construirJobs, syncIni, syncFim, data, selecionadas, buildJob]);

  const sincronizar = async () => {
    if (syncIni > syncFim) {
      toast.error("Ano inicial maior que o final.");
      return;
    }
    if (selecionadas.size === 0) {
      toast.error("Selecione ao menos uma fonte.");
      return;
    }
    const jobs = construirJobs(syncIni, syncFim, syncDelayMs);
    if (jobs.length === 0) {
      toast.success("Nada a sincronizar — tudo já foi consultado nesse intervalo.");
      return;
    }
    await runJobs(jobs, `Sincronizar ${syncIni}–${syncFim} (${jobs.length} chamadas)`);
    await refresh();
  };

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
            SICONFI exige código IBGE e fica de fora.
          </span>
        </div>

        {/* === Seleção agrupada === */}
        <div className="rounded-md border border-border bg-background/60 p-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Fontes
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => setSelecionadas(new Set(fontesDisponiveis))}
                disabled={isRunning}
              >
                Tudo
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => setSelecionadas(new Set())}
                disabled={isRunning}
              >
                Nada
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={refresh}
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
                      onCheckedChange={(v) => toggleGrupo(g.fontes, v === true)}
                      disabled={isRunning}
                    />
                    {g.label}
                  </label>
                  <div className="mt-1.5 ml-5 space-y-1">
                    {fontesGrupo.map((f) => (
                      <label key={f.fonte} className="flex items-start gap-2 cursor-pointer text-xs">
                        <Checkbox
                          checked={selecionadas.has(f.fonte)}
                          onCheckedChange={(v) => toggleFonte(f.fonte, v === true)}
                          disabled={isRunning}
                          className="mt-0.5"
                        />
                        <span>
                          <span className="font-medium text-foreground">{f.titulo}</span>
                        </span>
                      </label>
                    ))}
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
              onChange={(e) => setSyncIni(Number(e.target.value))}
              disabled={isRunning}
            >
              {Array.from({ length: ANO_ATUAL - 2003 + 1 }, (_, i) => 2003 + i).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-xs">Ano final</Label>
            <select
              className="mt-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              value={syncFim}
              onChange={(e) => setSyncFim(Number(e.target.value))}
              disabled={isRunning}
            >
              {Array.from({ length: ANO_ATUAL - 2003 + 1 }, (_, i) => 2003 + i).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-xs">Intervalo entre chamadas (ms)</Label>
            <select
              className="mt-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              value={syncDelayMs}
              onChange={(e) => setSyncDelayMs(Number(e.target.value))}
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
          onClick={sincronizar}
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