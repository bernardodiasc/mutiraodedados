import * as React from "react";
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Loader2,
  Zap,
  AlertTriangle,
  Play,
  RotateCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { CoberturaResult, Fonte, Linha } from "@/lib/data/cobertura.functions";
import { ORGAOS_BASE } from "@/lib/data/catalog";
import { fmtBRL } from "@/lib/fmt";
import {
  colunasDeGranularidade,
  colHeader as colHeaderFn,
  colLabelLong as colLabelLongFn,
  intensidadeCelula,
  isStale,
  totalLinhaAno,
  colMaxQtd as colMaxQtdFn,
} from "@/lib/cobertura-matrix/logic";

export type CoberturaMatrixViewProps = {
  ano: number;
  onAnoChange: (n: number) => void;
  isRunning: boolean;
  loading: boolean;
  data: CoberturaResult | null;
  fonteIds: readonly string[];
  selecionadas: ReadonlySet<string>;
  onSelecionadasChange: (next: Set<string>) => void;
  onRefresh: () => void;
  cobertosLen: number;
  carregadosSize: number;
  contratosCount: number;
  totalContratado: number;
  onPreencherLacunasSelecionadas: () => void;
  onPreencherLacunas: (fonte: Fonte) => void;
  onCelulaClick: (fonte: Fonte, linhaId: string, mes: number) => void;
  onLinhaClick: (fonte: Fonte, linha: Linha) => void;
  onColunaClick: (fonte: Fonte, mes: number) => void;
};

export function CoberturaMatrixView({
  ano,
  onAnoChange,
  isRunning,
  loading,
  data,
  fonteIds,
  selecionadas,
  onSelecionadasChange,
  onRefresh,
  cobertosLen,
  carregadosSize,
  contratosCount,
  totalContratado,
  onPreencherLacunasSelecionadas,
  onPreencherLacunas,
  onCelulaClick,
  onLinhaClick,
  onColunaClick,
}: CoberturaMatrixViewProps) {
  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-3 gap-3">
        <Stat label="Órgãos com dados / catálogo" value={`${cobertosLen} / ${carregadosSize}`} />
        <Stat label="Contratos persistidos" value={contratosCount.toLocaleString("pt-BR")} />
        <Stat label="Total contratado" value={fmtBRL(totalContratado)} />
      </div>

      <div className="rounded-xl border border-border bg-card p-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onAnoChange(ano - 1)}
            disabled={isRunning}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <div className="font-display text-3xl tabular-nums w-20 text-center">{ano}</div>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onAnoChange(ano + 1)}
            disabled={isRunning || ano >= new Date().getFullYear()}
          >
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
                onSelecionadasChange(new Set(fonteIds.filter((f) => f !== "siconfi")));
              } else {
                onSelecionadasChange(new Set());
              }
            }}
            disabled={isRunning}
          />
          Selecionar todas
        </label>

        <Button
          size="sm"
          variant="default"
          onClick={onPreencherLacunasSelecionadas}
          disabled={isRunning || selecionadas.size === 0}
        >
          <Zap className="size-3.5 mr-2" />
          Preencher lacunas ({selecionadas.size}) — {ano}
        </Button>

        <p className="text-[11px] text-muted-foreground max-w-xs">
          Marque fontes individualmente (caixa no cabeçalho de cada bloco) e clique acima para
          baixar lacunas do ano em lote.
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          disabled={loading || isRunning}
          className="ml-auto"
        >
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
            const next = new Set(selecionadas);
            if (v) next.add(f.fonte);
            else next.delete(f.fonte);
            onSelecionadasChange(next);
          }}
          onPreencherLacunas={() => onPreencherLacunas(f)}
          onCelulaClick={(linhaId, m) => onCelulaClick(f, linhaId, m)}
          onLinhaClick={(linha) => onLinhaClick(f, linha)}
          onColunaClick={(m) => onColunaClick(f, m)}
        />
      ))}
    </div>
  );
}

CoberturaMatrixView.displayName = "CoberturaMatrixView";

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
  const linhas = React.useMemo<Linha[]>(() => {
    // Linhas = órgãos com dados na cobertura (não mais o catálogo estático).
    // Enriquecemos só o rótulo com a sigla do overlay quando conhecida; órgãos
    // fora do overlay aparecem com o rótulo que a cobertura fornecer (cód.).
    if (fonte.fonte === "cgu") {
      return fonte.linhas.map((l) => {
        const o = ORGAOS_BASE.find((x) => x.cod === l.id);
        return o ? { ...l, label: o.sigla, sublabel: o.nome } : l;
      });
    }
    return fonte.linhas.length > 0
      ? fonte.linhas
      : [{ id: fonte.fonte, label: fonte.linhas[0]?.label ?? "—", celulas: [] }];
  }, [fonte]);

  const granularidade = fonte.granularidade;
  const colunas = colunasDeGranularidade(granularidade);
  const colHeader = (m: number) => colHeaderFn(granularidade, m);
  const colLabelLong = (m: number) => colLabelLongFn(granularidade, m, ano);

  const totalAno = linhas.reduce((sum, l) => sum + totalLinhaAno(l, ano), 0);
  const colMaxQtd = colMaxQtdFn(linhas, ano);

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
              <th className="text-left p-2 font-medium sticky left-0 bg-muted/30 z-10 min-w-[140px]">
                Linha
              </th>
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
                const semData = celulasAno
                  .filter((c) => c.mes === 0)
                  .reduce((s, c) => s + c.qtd, 0);
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
                                {semData.toLocaleString("pt-BR")} registros existem no banco para{" "}
                                {ano} mas vieram sem data de assinatura — não podem ser alocados num
                                mês específico.
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                        {linha.sublabel && (
                          <div className="text-[10px] text-muted-foreground truncate max-w-[180px]">
                            {linha.sublabel}
                          </div>
                        )}
                      </div>
                    </th>
                    {colunas.map((m) => {
                      const cel = celulasAno.find((c) => c.mes === m);
                      const qtd = cel?.qtd ?? 0;
                      const tentado = !!cel?.tentado;
                      const stale = isStale(cel?.ultimo ?? null, Date.now());
                      const intensidade = intensidadeCelula(qtd, colMaxQtd);
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
                                style={
                                  qtd > 0
                                    ? {
                                        backgroundColor: `color-mix(in oklch, var(--accent) ${Math.round(intensidade * 100)}%, transparent)`,
                                      }
                                    : undefined
                                }
                                aria-label={`${linha.label} · ${colLabelLong(m)}: ${qtd === 0 ? (tentado ? "consultado, sem dados" : "nunca consultado") : `${qtd} registros`}`}
                              />
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs">
                              <div className="font-medium">
                                {linha.label} · {colLabelLong(m)}
                              </div>
                              <div className="text-muted-foreground mt-0.5">
                                {qtd === 0
                                  ? tentado
                                    ? "Consultado — fonte não retornou dados"
                                    : "Nunca consultado"
                                  : `${qtd.toLocaleString("pt-BR")} registros`}
                                {cel?.ultimo &&
                                  ` · atualizado ${new Date(cel.ultimo).toLocaleDateString("pt-BR")}`}
                                {!cel?.ultimo &&
                                  cel?.tentativaEm &&
                                  ` · tentado ${new Date(cel.tentativaEm).toLocaleDateString("pt-BR")}`}
                                {stale && (
                                  <span className="ml-1 text-amber-600">⚠ {">"}90 dias</span>
                                )}
                              </div>
                              <div className="text-muted-foreground mt-1">
                                Clique para (re)importar
                              </div>
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
                            {totalLinha > 0 ? (
                              <RotateCw className="size-3.5" />
                            ) : (
                              <Play className="size-3.5" />
                            )}
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
                    <span
                      className="inline-block size-3 rounded"
                      style={{
                        backgroundColor: "color-mix(in oklch, var(--accent) 60%, transparent)",
                      }}
                    />
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
