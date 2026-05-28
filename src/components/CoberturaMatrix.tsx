import * as React from "react";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, ChevronRight, RefreshCw, Loader2, Zap, AlertTriangle, Play, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { statusCobertura, type CoberturaResult, type Fonte, type Linha } from "@/lib/data/cobertura.functions";
import { ORGAOS_BASE } from "@/lib/data/catalog";
import { useData } from "@/lib/data-store";
import { useCoberturaJobBuilder, type CoberturaJob } from "@/lib/data/cobertura-jobs";
import { fmtBRL } from "@/lib/fmt";

export type { CoberturaJob };

const MESES_CURTO = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

type Props = {
  isRunning: boolean;
  runJobs: (jobs: CoberturaJob[], title: string, unidade?: string) => Promise<void>;
};

export function CoberturaMatrix({ isRunning, runJobs }: Props) {
  const fetchCobertura = useServerFn(statusCobertura);
  const buildJob = useCoberturaJobBuilder();
  const { dataset } = useData();

  const [data, setData] = React.useState<CoberturaResult | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [ano, setAno] = React.useState<number>(new Date().getFullYear());
  const [selecionadas, setSelecionadas] = React.useState<Set<string>>(new Set());

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

  React.useEffect(() => { void refresh(); }, [refresh]);

  // Sempre que a lista de fontes mudar, começa com nada selecionado.
  const fonteIds = React.useMemo(() => (data?.fontes ?? []).map((f) => f.fonte), [data]);
  React.useEffect(() => {
    setSelecionadas((prev) => {
      const next = new Set<string>();
      for (const id of fonteIds) if (prev.has(id)) next.add(id);
      return next;
    });
  }, [fonteIds.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ações contextuais por fonte
  const construirJobsLacunas = (fonte: Fonte): CoberturaJob[] => {
    if (fonte.fonte === "siconfi") {
      return [];
    }
    const jobs: CoberturaJob[] = [];
    for (const linha of fonte.linhas.length > 0 ? fonte.linhas : faltantesParaFonte(fonte, ano)) {
      // "Lacuna" = nunca tentado. Cell tried-but-empty já foi consultado;
      // re-tentar precisa ser explícito.
      const tentados = new Set(linha.celulas.filter((c) => c.ano === ano && (c.qtd > 0 || c.tentado)).map((c) => c.mes));
      for (let m = 1; m <= 12; m++) {
        if (!tentados.has(m)) {
          const j = buildJob(fonte.fonte, linha.id, ano, m);
          if (j) jobs.push(j);
        }
      }
    }
    // Para CGU, também processar órgãos não-listados no resultado (sem dados ainda no ano)
    if (fonte.fonte === "cgu") {
      const listados = new Set(fonte.linhas.map((l) => l.id));
      for (const o of ORGAOS_BASE) {
        if (!o.disponivelPortal || listados.has(o.cod)) continue;
        for (let m = 1; m <= 12; m++) {
          const j = buildJob("cgu", o.cod, ano, m);
          if (j) jobs.push(j);
        }
      }
    }
    return jobs;
  };

  const preencherLacunas = async (fonte: Fonte) => {
    if (fonte.fonte === "siconfi") {
      toast.error("SICONFI precisa de código IBGE — use a aba Estados/Municípios.");
      return;
    }
    const jobs = construirJobsLacunas(fonte);
    if (jobs.length === 0) {
      toast.success("Sem lacunas no ano selecionado.");
      return;
    }
    await runJobs(jobs, `${fonte.titulo}: preencher ${jobs.length} lacunas de ${ano}`);
    await refresh();
  };

  const preencherLacunasSelecionadas = async () => {
    if (!data) return;
    const fontes = data.fontes.filter((f) => selecionadas.has(f.fonte) && f.fonte !== "siconfi");
    if (fontes.length === 0) {
      toast.error("Selecione ao menos uma fonte (SICONFI não suportado em lote).");
      return;
    }
    const jobs: CoberturaJob[] = [];
    for (const f of fontes) jobs.push(...construirJobsLacunas(f));
    if (jobs.length === 0) {
      toast.success("Sem lacunas nas fontes selecionadas.");
      return;
    }
    await runJobs(jobs, `Preencher ${jobs.length} lacunas em ${fontes.length} fonte(s) — ${ano}`);
    await refresh();
  };

  const reimportarCelula = async (fonte: Fonte, linhaId: string, m: number) => {
    const j = buildJob(fonte.fonte, linhaId, ano, m);
    if (!j) return;
    await runJobs([j], j.label);
    await refresh();
  };

  const reimportarLinha = async (fonte: Fonte, linha: Linha) => {
    const jobs: CoberturaJob[] = [];
    for (let m = 1; m <= 12; m++) {
      const j = buildJob(fonte.fonte, linha.id, ano, m);
      if (j) jobs.push(j);
    }
    if (jobs.length === 0) return;
    await runJobs(jobs, `${fonte.titulo}: ${linha.label} — ano ${ano}`);
    await refresh();
  };

  const reimportarColuna = async (fonte: Fonte, m: number) => {
    if (fonte.fonte === "siconfi") return;
    const linhas = fonte.fonte === "cgu" ? ORGAOS_BASE.filter((o) => o.disponivelPortal).map((o) => ({ id: o.cod })) : fonte.linhas;
    const jobs: CoberturaJob[] = [];
    for (const linha of linhas) {
      const j = buildJob(fonte.fonte, linha.id, ano, m);
      if (j) jobs.push(j);
    }
    if (jobs.length === 0) return;
    await runJobs(jobs, `${fonte.titulo}: ${MESES_CURTO[m - 1]}/${ano} — ${linhas.length} linhas`);
    await refresh();
  };

  // ============ Sincronizar tudo: multi-ano, todas as fontes ============
  // Painel "Sincronizar tudo" foi movido para a aba Manutenção
  // (componente SincronizarTudoPanel).

  // === Resumo "Dados armazenados" ===
  const cobertos = React.useMemo(() => ORGAOS_BASE.filter((o) => o.disponivelPortal), []);
  const carregados = React.useMemo(
    () => new Set(dataset.orgaos.map((o) => o.cod)),
    [dataset.orgaos],
  );
  const totalContratado = React.useMemo(
    () => dataset.contratos.reduce((s, c) => s + c.valor, 0),
    [dataset.contratos],
  );

  return (
    <div className="space-y-6">
      {/* === Dados armazenados (visão geral) === */}
      <div className="grid sm:grid-cols-3 gap-3">
        <Stat label="Órgãos no banco" value={`${carregados.size} / ${cobertos.length}`} />
        <Stat label="Contratos persistidos" value={dataset.contratos.length.toLocaleString("pt-BR")} />
        <Stat label="Total contratado" value={fmtBRL(totalContratado)} />
      </div>

      <div className="rounded-xl border border-border bg-card p-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Button size="icon" variant="ghost" onClick={() => setAno(ano - 1)} disabled={isRunning}>
            <ChevronLeft className="size-4" />
          </Button>
          <div className="font-display text-3xl tabular-nums w-20 text-center">{ano}</div>
          <Button size="icon" variant="ghost" onClick={() => setAno(ano + 1)} disabled={isRunning || ano >= new Date().getFullYear()}>
            <ChevronRight className="size-4" />
          </Button>
        </div>

        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <Checkbox
            checked={
              fonteIds.length > 0 &&
              fonteIds.filter((f) => f !== "siconfi").every((f) => selecionadas.has(f))
            }
            onCheckedChange={(v) => {
              if (v) {
                setSelecionadas(new Set(fonteIds.filter((f) => f !== "siconfi")));
              } else {
                setSelecionadas(new Set());
              }
            }}
            disabled={isRunning}
          />
          Selecionar todas
        </label>

        <Button
          size="sm"
          variant="default"
          onClick={preencherLacunasSelecionadas}
          disabled={isRunning || selecionadas.size === 0}
        >
          <Zap className="size-3.5 mr-2" />
          Preencher lacunas ({selecionadas.size}) — {ano}
        </Button>

        <p className="text-[11px] text-muted-foreground max-w-xs">
          Marque fontes individualmente (caixa no cabeçalho de cada bloco) e clique acima para baixar lacunas do ano em lote.
        </p>
        <Button variant="ghost" size="sm" onClick={refresh} disabled={loading || isRunning} className="ml-auto">
          <RefreshCw className={`size-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Atualizar visão
        </Button>
      </div>

      {loading && !data && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Carregando cobertura…
        </div>
      )}

      {data?.fontes.map((f) => (
        <FonteSecao
          key={f.fonte}
          fonte={f}
          ano={ano}
          isRunning={isRunning}
          selecionada={selecionadas.has(f.fonte)}
          onToggleSelecionada={(v) => {
            setSelecionadas((prev) => {
              const next = new Set(prev);
              if (v) next.add(f.fonte);
              else next.delete(f.fonte);
              return next;
            });
          }}
          onPreencherLacunas={() => preencherLacunas(f)}
          onCelulaClick={(linhaId, m) => reimportarCelula(f, linhaId, m)}
          onLinhaClick={(linha) => reimportarLinha(f, linha)}
          onColunaClick={(m) => reimportarColuna(f, m)}
        />
      ))}
    </div>
  );
}

function faltantesParaFonte(fonte: Fonte, _ano: number): Linha[] {
  // Placeholder: para fontes sem linha alguma, criamos uma linha virtual única.
  return [{ id: fonte.fonte, label: fonte.titulo, celulas: [] }];
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border rounded-xl p-4 bg-card">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-display text-xl mt-1">{value}</div>
    </div>
  );
}

function FonteSecao({
  fonte,
  ano,
  isRunning,
  selecionada,
  onToggleSelecionada,
  onPreencherLacunas,
  onCelulaClick,
  onLinhaClick,
  onColunaClick,
}: {
  fonte: Fonte;
  ano: number;
  isRunning: boolean;
  selecionada: boolean;
  onToggleSelecionada: (v: boolean) => void;
  onPreencherLacunas: () => void;
  onCelulaClick: (linhaId: string, mes: number) => void;
  onLinhaClick: (linha: Linha) => void;
  onColunaClick: (mes: number) => void;
}) {
  // Para CGU, listar TODOS os órgãos cobertos (mesmo os sem dados) — esse é o ponto.
  const linhas = React.useMemo<Linha[]>(() => {
    if (fonte.fonte === "cgu") {
      const byId = new Map(fonte.linhas.map((l) => [l.id, l]));
      return ORGAOS_BASE.filter((o) => o.disponivelPortal).map((o) => {
        const l = byId.get(o.cod);
        return {
          id: o.cod,
          label: o.sigla,
          sublabel: o.nome,
          celulas: l?.celulas ?? [],
        };
      });
    }
    return fonte.linhas.length > 0
      ? fonte.linhas
      : [{ id: fonte.fonte, label: fonte.linhas[0]?.label ?? "—", celulas: [] }];
  }, [fonte]);

  const granularidade = fonte.granularidade;
  const colunas =
    granularidade === "periodo"
      ? [1, 2, 3, 4, 5, 6]
      : granularidade === "ano"
        ? [1]
        : Array.from({ length: 12 }, (_, i) => i + 1);
  const colHeader = (m: number) =>
    granularidade === "periodo" ? `P${m}` : granularidade === "ano" ? "Ano" : MESES_CURTO[m - 1];
  const colLabelLong = (m: number) =>
    granularidade === "periodo"
      ? `P${m}`
      : granularidade === "ano"
        ? `Ano ${ano}`
        : `${MESES_CURTO[m - 1]}/${ano}`;

  // Resumo do ano
  const totalAno = linhas.reduce((sum, l) => sum + l.celulas.filter((c) => c.ano === ano).reduce((s, c) => s + c.qtd, 0), 0);
  const colMaxQtd = Math.max(1, ...linhas.flatMap((l) => l.celulas.filter((c) => c.ano === ano).map((c) => c.qtd)));

  return (
    <section className="rounded-xl border border-border bg-card overflow-hidden">
      <header className="p-4 border-b border-border flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {fonte.fonte !== "siconfi" && (
            <Checkbox
              className="mt-1"
              checked={selecionada}
              onCheckedChange={(v) => onToggleSelecionada(v === true)}
              disabled={isRunning}
              aria-label={`Incluir ${fonte.titulo} no lote de "preencher lacunas"`}
            />
          )}
          <div>
            <h3 className="font-display text-lg">{fonte.titulo}</h3>
            <p className="text-xs text-muted-foreground mt-0.5 max-w-xl">{fonte.descricao}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {fonte.fonte !== "siconfi" && (
            <Button size="sm" variant="outline" onClick={onPreencherLacunas} disabled={isRunning}>
              <Zap className="size-3.5 mr-2" />
              Preencher lacunas de {ano}
            </Button>
          )}
        </div>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/30">
              <th className="text-left p-2 font-medium sticky left-0 bg-muted/30 z-10 min-w-[140px]">Linha</th>
              {colunas.map((m) => (
                <th key={m} className="p-1 font-medium">
                  <button
                    data-flat
                    className="hover:text-accent w-full px-1 py-0.5 rounded disabled:opacity-50"
                    disabled={isRunning || fonte.fonte === "siconfi"}
                    onClick={() => onColunaClick(m)}
                    title={`Re-importar ${colLabelLong(m)} para todas as linhas`}
                  >
                    {colHeader(m)}
                  </button>
                </th>
              ))}
              <th className="p-2 font-medium text-right">Total {ano}</th>
              <th className="p-2 font-medium text-right w-24">Ações</th>
            </tr>
          </thead>
          <tbody>
            <TooltipProvider delayDuration={200}>
              {linhas.map((linha) => {
                const celulasAno = linha.celulas.filter((c) => c.ano === ano);
                const totalLinha = celulasAno.reduce((s, c) => s + c.qtd, 0);
                const semData = celulasAno.filter((c) => c.mes === 0).reduce((s, c) => s + c.qtd, 0);
                return (
                  <tr key={linha.id} className="border-t border-border hover:bg-muted/20">
                    <th className="text-left p-2 font-normal sticky left-0 bg-card z-10">
                      <div className="text-left w-full">
                        <div className="font-medium flex items-center gap-1.5">
                          {linha.label}
                          {semData > 0 && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400 font-normal cursor-help">
                                  {semData} sem data
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="right" className="text-xs max-w-xs">
                                {semData.toLocaleString("pt-BR")} registros existem no banco para {ano} mas vieram sem data de assinatura — não podem ser alocados num mês específico.
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                        {linha.sublabel && <div className="text-[10px] text-muted-foreground truncate max-w-[180px]">{linha.sublabel}</div>}
                      </div>
                    </th>
                    {colunas.map((m) => {
                      const cel = celulasAno.find((c) => c.mes === m);
                      const qtd = cel?.qtd ?? 0;
                      const tentado = !!cel?.tentado;
                      const stale = cel?.ultimo ? (Date.now() - new Date(cel.ultimo).getTime()) > 90 * 86400 * 1000 : false;
                      const intensidade = qtd === 0 ? 0 : Math.max(0.18, Math.min(1, qtd / colMaxQtd));
                      return (
                        <td key={m} className="p-0.5">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                data-flat
                                disabled={isRunning}
                                onClick={() => onCelulaClick(linha.id, m)}
                                className={`block w-full h-7 rounded transition border ${
                                  qtd === 0
                                    ? tentado
                                      ? "border-solid border-border/60 bg-muted/40 hover:border-accent/60"
                                      : "border-dashed border-border/50 bg-transparent hover:border-accent/60"
                                    : "border-transparent hover:ring-1 hover:ring-accent"
                                } ${stale ? "ring-1 ring-amber-500/40" : ""} disabled:opacity-50 disabled:cursor-not-allowed`}
                                style={qtd > 0 ? { backgroundColor: `color-mix(in oklch, var(--accent) ${Math.round(intensidade * 100)}%, transparent)` } : undefined}
                                aria-label={`${linha.label} · ${colLabelLong(m)}: ${qtd === 0 ? (tentado ? "consultado, sem dados" : "nunca consultado") : `${qtd} registros`}`}
                              />
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs">
                              <div className="font-medium">{linha.label} · {colLabelLong(m)}</div>
                              <div className="text-muted-foreground mt-0.5">
                                {qtd === 0
                                  ? tentado
                                    ? "Consultado — fonte não retornou dados"
                                    : "Nunca consultado"
                                  : `${qtd.toLocaleString("pt-BR")} registros`}
                                {cel?.ultimo && ` · atualizado ${new Date(cel.ultimo).toLocaleDateString("pt-BR")}`}
                                {!cel?.ultimo && cel?.tentativaEm && ` · tentado ${new Date(cel.tentativaEm).toLocaleDateString("pt-BR")}`}
                                {stale && <span className="ml-1 text-amber-600">⚠ {">"}90 dias</span>}
                              </div>
                              <div className="text-muted-foreground mt-1">Clique para (re)importar</div>
                            </TooltipContent>
                          </Tooltip>
                        </td>
                      );
                    })}
                    <td className="p-2 text-right tabular-nums font-medium">
                      {totalLinha > 0 ? totalLinha.toLocaleString("pt-BR") : "—"}
                    </td>
                    <td className="p-2 text-right">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-7"
                            disabled={isRunning}
                            onClick={() => onLinhaClick(linha)}
                            aria-label={`Importar ano ${ano} completo para ${linha.label}`}
                          >
                            {totalLinha > 0 ? <RotateCw className="size-3.5" /> : <Play className="size-3.5" />}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="text-xs">
                          {totalLinha > 0
                            ? `Re-importar ${ano} inteiro para ${linha.label}`
                            : `Importar ${ano} inteiro para ${linha.label}`}
                        </TooltipContent>
                      </Tooltip>
                    </td>
                  </tr>
                );
              })}
            </TooltipProvider>
          </tbody>
          <tfoot className="bg-muted/20 border-t border-border">
            <tr>
              <td className="p-2 text-xs text-muted-foreground" colSpan={colunas.length + 1}>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block size-3 rounded border border-dashed border-border/60 bg-transparent" />
                    nunca consultado
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block size-3 rounded border border-border/60 bg-muted/40" />
                    consultado, vazio
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block size-3 rounded" style={{ backgroundColor: "color-mix(in oklch, var(--accent) 60%, transparent)" }} />
                    com dados
                  </span>
                  <span className="flex items-center gap-1.5">
                    <AlertTriangle className="size-3 text-amber-500/70" />
                    {">"}90 dias
                  </span>
                </div>
              </td>
              <td className="p-2 text-right text-xs font-medium tabular-nums">
                {totalAno > 0 ? totalAno.toLocaleString("pt-BR") : "—"}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}