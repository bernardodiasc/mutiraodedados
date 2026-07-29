import { Database, Loader2, History, Trash2, ShieldCheck, Info, AlertTriangle, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { EntesPanel } from "@/components/AdminEntesPanel";
import { TseImportPanelContainer as TseImportPanel } from "@/containers/TseImportPanelContainer";
import { CoberturaMatrix, type CoberturaJob } from "@/components/CoberturaMatrix";
import { SincronizarTudoPanel } from "@/components/SincronizarTudoPanel";
import { ORGAOS_BASE } from "@/lib/data/catalog";
import { FONTES_LIMPEZA } from "@/lib/data/limpeza";
import { MONTHS } from "@/lib/admin-import/logic";
import type { HistoricoEntrada } from "@/lib/data/real/portal.functions";

export type BatchProgress = {
  total: number;
  done: number;
  current: string;
  importados: number;
  erros: number;
};

export type AdminImportViewProps = {
  // periodo
  ano: number;
  mes: number;
  setAno: (n: number) => void;
  setMes: (n: number) => void;
  years: number[];
  cobertos: typeof ORGAOS_BASE;

  // progresso
  batch: BatchProgress | null;
  isRunning: boolean;
  progressPct: number;
  cancelBatch: () => void;

  // portal cgu
  orgao: string;
  setOrgao: (s: string) => void;
  importarUnico: () => void;
  // Catálogo de órgãos (SIAFI): sincroniza nomes + verifica atividade (extinto).
  onSincronizarCatalogo: () => void;
  sincronizandoCatalogo: boolean;
  onDiagnosticarPortal: (params: {
    codigoOrgao: string;
    pagina: number;
    filtrarId?: string;
  }) => Promise<DiagnosticoPortalResult>;
  varredurasIncompletas: Array<{ orgaoCod: string; ultimaPagina: number; dataInicial?: string; dataFinal?: string }>;
  continuarVarredura: (cod: string, dataInicial?: string, dataFinal?: string) => void;
  autoContinuar: boolean;
  setAutoContinuar: (v: boolean) => void;
  vigIni: string;
  setVigIni: (s: string) => void;
  vigFim: string;
  setVigFim: (s: string) => void;

  // camara
  camaraBusy: string | null;
  propTipo: string;
  setPropTipo: (s: string) => void;
  votIni: string;
  setVotIni: (s: string) => void;
  votFim: string;
  setVotFim: (s: string) => void;
  onImportarDeputados: () => void;
  onImportarCEAPCamara: () => void;
  onImportarPropsCamara: () => void;
  onImportarVotsCamara: () => void;

  // senado
  senadoBusy: string | null;
  onImportarSenadores: () => void;
  onImportarCEAPSSenado: () => void;
  onImportarMatSenado: () => void;
  onImportarVotSenado: () => void;

  // Histórico de legislaturas (faixa) — compartilhado entre Câmara e Senado.
  legHistIni: number;
  legHistFim: number;
  setLegHistIni: (n: number) => void;
  setLegHistFim: (n: number) => void;
  onImportarHistCamara: () => void;
  onImportarTrajetoriaCamara: () => void;
  onImportarHistSenado: () => void;

  // historico
  history: HistoricoEntrada[];
  loadingHist: boolean;
  histHasMore: boolean;
  histLoadingMore: boolean;
  refreshHistory: () => void;
  loadMoreHistory: () => void;

  // manutencao
  sanitizing: boolean;
  onSanitize: () => void;
  runJobsSinc: (
    jobs: Array<{ label: string; run: () => Promise<number> }>,
    title: string,
    unidade?: string,
  ) => Promise<void>;
  runJobsCobertura: (jobs: CoberturaJob[], title: string) => Promise<void>;

  // limpeza
  limpFontes: Set<string>;
  toggleFonte: (id: string, v: boolean) => void;
  selecionarTodasFontes: () => void;
  limparSelecaoFontes: () => void;
  limpUsarPeriodo: boolean;
  setLimpUsarPeriodo: (v: boolean) => void;
  limpAnoIni: number;
  setLimpAnoIni: (n: number) => void;
  limpAnoFim: number;
  setLimpAnoFim: (n: number) => void;
  limpConfirm: string;
  setLimpConfirm: (s: string) => void;
  limpBusy: boolean;
  limparSelecionado: () => void;
};

function PeriodoInline({
  ano, mes, setAno, setMes, disabled, mostraMes = true, hint, years,
}: {
  ano: number; mes: number;
  setAno: (n: number) => void; setMes: (n: number) => void;
  disabled?: boolean; mostraMes?: boolean; hint?: string; years: number[];
}) {
  return (
    <div className="flex flex-wrap items-end gap-3 text-sm">
      {mostraMes && (
        <div>
          <Label className="text-xs">Mês</Label>
          <select
            className="mt-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            value={mes} onChange={(e) => setMes(Number(e.target.value))} disabled={disabled}
          >
            {MONTHS.map((nm, i) => <option key={i} value={i + 1}>{nm}</option>)}
          </select>
        </div>
      )}
      <div>
        <Label className="text-xs">Ano</Label>
        <select
          className="mt-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          value={ano} onChange={(e) => setAno(Number(e.target.value))} disabled={disabled}
        >
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function HistorySentinel({
  hasMore, loading, onLoadMore,
}: {
  hasMore: boolean; loading: boolean; onLoadMore: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!hasMore) return;
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => { if (entries.some((e) => e.isIntersecting)) onLoadMore(); },
      { rootMargin: "200px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, onLoadMore]);
  if (!hasMore && !loading) {
    return (
      <div className="p-3 text-center text-xs text-muted-foreground border-t border-border">
        Fim do histórico.
      </div>
    );
  }
  return (
    <div ref={ref} className="p-3 text-center text-xs text-muted-foreground border-t border-border flex items-center justify-center gap-2">
      {loading ? (<><Loader2 className="size-3.5 animate-spin" /> Carregando mais…</>) : ("Role para carregar mais")}
    </div>
  );
}

export type DiagnosticoPortalResult = {
  urlConsultada: string;
  totalNaPagina: number;
  numerosComDecimaisNoJson: string[];
  contratos: Array<{
    id: string | number | null;
    dataAssinatura: string | null;
    valorFinalCompra_raw: string | number | null;
    valorInicialCompra_raw: string | number | null;
    valorFinal_parseado: number;
    valorInicial_parseado: number;
    objeto: string;
  }>;
};

function DiagnosticoPortalPanel({
  onDiagnosticar,
}: {
  onDiagnosticar: (params: {
    codigoOrgao: string;
    pagina: number;
    filtrarId?: string;
  }) => Promise<DiagnosticoPortalResult>;
}) {
  const [orgao, setOrgao] = useState("22000");
  const [pagina, setPagina] = useState("1");
  const [filtrarId, setFiltrarId] = useState("");
  const [busy, setBusy] = useState(false);
  const [resultado, setResultado] = useState<DiagnosticoPortalResult | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setResultado(null);
    setErro(null);
    try {
      const r = await onDiagnosticar({
        codigoOrgao: orgao.trim(),
        pagina: Number(pagina) || 1,
        filtrarId: filtrarId.trim() || undefined,
      });
      setResultado(r);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-xl border border-border bg-card/50 p-4 space-y-4">
      <div>
        <h2 className="font-display text-lg">Diagnóstico server-side do Portal</h2>
        <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
          Executa a mesma requisição do import <strong>a partir do servidor</strong> (mesmo IP, mesmos
          headers, mesma chave) e exibe os valores brutos recebidos. A CGU lista por vigência, então a
          consulta é por <strong>página</strong> (sem datas) — útil para conferir a página indicada num
          alerta de qualidade.
        </p>
      </div>
      <div className="flex flex-wrap gap-2 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Órgão (código)</label>
          <input
            className="rounded-md border border-input bg-background px-2 py-1 text-sm w-24"
            value={orgao}
            onChange={(e) => setOrgao(e.target.value)}
            placeholder="22000"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Página</label>
          <input
            className="rounded-md border border-input bg-background px-2 py-1 text-sm w-20"
            value={pagina}
            onChange={(e) => setPagina(e.target.value)}
            placeholder="1"
            type="number"
            min={1}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Filtrar por id (opcional)</label>
          <input
            className="rounded-md border border-input bg-background px-2 py-1 text-sm w-36"
            value={filtrarId}
            onChange={(e) => setFiltrarId(e.target.value)}
            placeholder="746157306"
          />
        </div>
        <Button size="sm" onClick={run} disabled={busy || !orgao}>
          {busy ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : null}
          Consultar servidor
        </Button>
      </div>

      {erro && <p className="text-xs text-destructive">{erro}</p>}

      {resultado && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            URL consultada pelo servidor:{" "}
            <code className="text-[11px] break-all">{resultado.urlConsultada}</code>
          </p>
          <p className="text-xs text-muted-foreground">
            Contratos nesta página: <strong>{resultado.totalNaPagina}</strong>
            {filtrarId && ` · exibindo apenas id=${filtrarId} (${resultado.contratos.length} encontrado(s))`}
          </p>
          {resultado.numerosComDecimaisNoJson.length > 0 ? (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              ⚠ Números com 4+ casas decimais no JSON bruto desta página:{" "}
              <code>{resultado.numerosComDecimaisNoJson.join(", ")}</code>
              {" — "}indicam possível representação interna do Portal diferente do valor real.
            </p>
          ) : (
            <p className="text-xs text-emerald-600 dark:text-emerald-400">
              ✓ Nenhum número com casas decimais suspeitas no JSON bruto desta página.
            </p>
          )}
          {resultado.contratos.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum contrato encontrado com esse filtro nesta página.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="text-xs w-full border-collapse">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="py-1 pr-3">id</th>
                    <th className="py-1 pr-3">dataAssinatura</th>
                    <th className="py-1 pr-3">valorFinalCompra (raw)</th>
                    <th className="py-1 pr-3">valorFinal (parseado)</th>
                    <th className="py-1 pr-3">valorInicialCompra (raw)</th>
                    <th className="py-1">objeto</th>
                  </tr>
                </thead>
                <tbody>
                  {resultado.contratos.map((c, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-1 pr-3 font-mono">{String(c.id)}</td>
                      <td className="py-1 pr-3">{c.dataAssinatura ?? "—"}</td>
                      <td className="py-1 pr-3 font-mono">{JSON.stringify(c.valorFinalCompra_raw)}</td>
                      <td className="py-1 pr-3 font-mono">{c.valorFinal_parseado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                      <td className="py-1 pr-3 font-mono">{JSON.stringify(c.valorInicialCompra_raw)}</td>
                      <td className="py-1 text-muted-foreground">{c.objeto}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export function AdminImportView(p: AdminImportViewProps) {
  return (
    <div className="space-y-6">
      {p.batch && (
        <div className="rounded-xl border border-border bg-muted/30 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm">
              <div className="font-medium">{p.batch.current}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {p.batch.done} / {p.batch.total} · {p.batch.importados} importados · {p.batch.erros} erros
              </div>
            </div>
            {p.isRunning && (
              <Button size="sm" variant="ghost" onClick={p.cancelBatch}>Cancelar</Button>
            )}
          </div>
          <div className="h-1.5 bg-border rounded-full mt-3 overflow-hidden">
            {p.isRunning && p.batch.total <= 1 ? (
              // Uma única unidade de trabalho de duração desconhecida (ex.: varredura
              // de 1 órgão que roda várias rodadas): barra indeterminada em vez de 0%.
              <div className="h-full bg-accent rounded-full barra-indeterminada" />
            ) : (
              <div className="h-full bg-accent transition-all" style={{ width: `${p.progressPct}%` }} />
            )}
          </div>
        </div>
      )}

      <Tabs defaultValue="cobertura" className="w-full">
        <TabsList className="flex flex-wrap h-auto justify-start">
          <TabsTrigger value="cobertura">Cobertura</TabsTrigger>
          <TabsTrigger value="portal">Portal CGU</TabsTrigger>
          <TabsTrigger value="camara">Câmara</TabsTrigger>
          <TabsTrigger value="senado">Senado</TabsTrigger>
          <TabsTrigger value="entes">Estados/Municípios</TabsTrigger>
          <TabsTrigger value="tse">TSE</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
          <TabsTrigger value="manutencao">Manutenção</TabsTrigger>
        </TabsList>

        <TabsContent value="cobertura" className="space-y-4 mt-4">
          <CoberturaMatrix isRunning={p.isRunning} runJobs={p.runJobsCobertura} />
        </TabsContent>

        <TabsContent value="portal" className="space-y-4 mt-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="font-display text-lg flex items-center gap-2">
              <RefreshCw className="size-4 text-accent" />
              Catálogo de órgãos (SIAFI)
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Sincroniza os <strong>nomes</strong> dos órgãos a partir do <code>/orgaos-siafi</code> e
              verifica a <strong>atividade</strong> de cada órgão com dados (execução recente em
              <code>/despesas/por-orgao</code>). Órgãos sem execução recente são marcados como
              <strong> extintos</strong>, mantendo o histórico. Alimenta a lista de <code>/orgaos</code> e
              o seletor de import abaixo.
            </p>
            <div className="mt-4">
              <Button variant="outline" onClick={p.onSincronizarCatalogo} disabled={p.sincronizandoCatalogo || p.isRunning}>
                {p.sincronizandoCatalogo ? <Loader2 className="size-4 mr-2 animate-spin" /> : <RefreshCw className="size-4 mr-2" />}
                Sincronizar catálogo de órgãos
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="font-display text-lg flex items-center gap-2">
              <Database className="size-4 text-accent" />
              Executivo — contratos por órgão
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Importa contratos do Portal da Transparência (CGU) para o órgão selecionado.
              Sem período, faz uma <strong>varredura completa</strong> do histórico do órgão;
              cada contrato é alocado pelo mês de <strong>início de vigência</strong> (mesma
              dimensão da cobertura). Informe um período de vigência abaixo para importar só
              parte.
            </p>
            <div className="grid sm:grid-cols-2 gap-3 mt-4">
              <div>
                <Label className="text-xs">Órgão</Label>
                <select
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={p.orgao}
                  onChange={(e) => p.setOrgao(e.target.value)}
                  disabled={p.isRunning}
                >
                  {p.cobertos.map((o) => (
                    <option key={o.cod} value={o.cod}>{o.sigla} — {o.nome}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <Button onClick={p.importarUnico} disabled={p.isRunning}>
                  {p.isRunning ? <Loader2 className="size-4 mr-2 animate-spin" /> : null}
                  Importar contratos do órgão
                </Button>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <div>
                <Label className="text-xs">Vigência de (opcional)</Label>
                <input
                  type="date"
                  className="mt-1 block rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                  value={p.vigIni}
                  onChange={(e) => p.setVigIni(e.target.value)}
                  disabled={p.isRunning}
                />
              </div>
              <div>
                <Label className="text-xs">Vigência até</Label>
                <input
                  type="date"
                  className="mt-1 block rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                  value={p.vigFim}
                  onChange={(e) => p.setVigFim(e.target.value)}
                  disabled={p.isRunning}
                />
              </div>
              {(p.vigIni || p.vigFim) && (
                <button
                  type="button"
                  className="text-xs text-accent underline pb-2"
                  onClick={() => {
                    p.setVigIni("");
                    p.setVigFim("");
                  }}
                  disabled={p.isRunning}
                >
                  limpar
                </button>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Com as duas datas preenchidas, importa só contratos cujo <strong>início de vigência</strong>
              {" "}cai no período (a CGU filtra por vigência). Vazio = varredura completa do órgão.
            </p>
            <label className="mt-3 flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                className="size-3.5 accent-accent"
                checked={p.autoContinuar}
                onChange={(e) => p.setAutoContinuar(e.target.checked)}
                disabled={p.isRunning}
              />
              Auto-continuar: disparar rodadas automaticamente até a varredura completar.
            </label>
            <p className="text-xs text-muted-foreground mt-2">
              A varredura confere o <strong>detalhe oficial</strong> de cada contrato (corrige o
              bug ÷10.000 da listagem) e roda em <strong>rodadas</strong> de ~3min. Órgãos grandes
              precisam de várias — use “Continuar” abaixo ou ligue o auto-continuar.
              O Portal costuma ter lag de 1–3 meses na publicação de contratos novos.
            </p>

            {p.varredurasIncompletas.length > 0 && (
              <div className="mt-4 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs space-y-2">
                <p className="font-medium text-amber-700 dark:text-amber-400 flex items-center gap-2">
                  <AlertTriangle className="size-4 shrink-0" />
                  Varreduras em andamento — há mais contratos a baixar
                </p>
                <ul className="space-y-1.5">
                  {p.varredurasIncompletas.map((v) => {
                    const o = ORGAOS_BASE.find((x) => x.cod === v.orgaoCod);
                    const janela = v.dataInicial && v.dataFinal ? ` · vigência ${v.dataInicial}→${v.dataFinal}` : "";
                    return (
                      <li key={`${v.orgaoCod}${janela}`} className="flex items-center justify-between gap-2">
                        <span className="text-muted-foreground">
                          {o?.sigla ?? v.orgaoCod} — varrido até a pág. {v.ultimaPagina}{janela}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-xs"
                          onClick={() => p.continuarVarredura(v.orgaoCod, v.dataInicial, v.dataFinal)}
                          disabled={p.isRunning}
                        >
                          {p.isRunning ? <Loader2 className="size-3 mr-1 animate-spin" /> : null}
                          Continuar
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>

          <DiagnosticoPortalPanel onDiagnosticar={p.onDiagnosticarPortal} />
        </TabsContent>

        <TabsContent value="camara" className="space-y-4 mt-4">
          <div className="rounded-xl border border-border bg-card p-3">
            <PeriodoInline ano={p.ano} mes={p.mes} setAno={p.setAno} setMes={p.setMes} disabled={p.camaraBusy !== null || p.isRunning} hint="Mês usado em CEAP e votações; ano usado em proposições." years={p.years} />
          </div>
          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <div>
              <h3 className="font-display text-lg">Câmara dos Deputados</h3>
              <p className="text-xs text-muted-foreground mt-1">
                API <code>dadosabertos.camara.leg.br</code>. Importe primeiro o cadastro,
                depois CEAP por mês (varre ~513 deputados).
              </p>
            </div>
            <div className="flex flex-wrap gap-2 items-end">
              <Button variant="outline" size="sm" disabled={p.camaraBusy !== null} onClick={p.onImportarDeputados}>
                {p.camaraBusy === "deputados" ? <Loader2 className="size-3.5 mr-2 animate-spin" /> : null}
                Importar cadastro de deputados
              </Button>
              <Button size="sm" disabled={p.camaraBusy !== null} onClick={p.onImportarCEAPCamara}>
                {p.camaraBusy === "ceap" ? <Loader2 className="size-3.5 mr-2 animate-spin" /> : null}
                Importar CEAP de {MONTHS[p.mes-1]}/{p.ano}
              </Button>
            </div>
            <div className="border-t border-border pt-3 space-y-2">
              <p className="text-xs text-muted-foreground">
                Histórico: importa o cadastro de legislaturas passadas (partido/UF por legislatura).
                Não sobrescreve o estado atual. Legislatura 52 = 2003 … 57 = 2023.
              </p>
              <div className="flex flex-wrap gap-2 items-end">
                <div>
                  <Label className="text-xs">Legislatura inicial</Label>
                  <Input type="number" value={p.legHistIni} onChange={(e) => p.setLegHistIni(Number(e.target.value))} disabled={p.camaraBusy !== null} className="mt-1 w-24" />
                </div>
                <div>
                  <Label className="text-xs">Legislatura final</Label>
                  <Input type="number" value={p.legHistFim} onChange={(e) => p.setLegHistFim(Number(e.target.value))} disabled={p.camaraBusy !== null} className="mt-1 w-24" />
                </div>
                <Button variant="outline" size="sm" disabled={p.camaraBusy !== null} onClick={p.onImportarHistCamara}>
                  {p.camaraBusy === "hist" ? <Loader2 className="size-3.5 mr-2 animate-spin" /> : null}
                  Importar histórico de deputados
                </Button>
                <Button variant="outline" size="sm" disabled={p.camaraBusy !== null} onClick={p.onImportarTrajetoriaCamara}>
                  {p.camaraBusy === "trajetoria" ? <Loader2 className="size-3.5 mr-2 animate-spin" /> : null}
                  Importar trajetória (linha do tempo)
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Trajetória: busca a linha do tempo de cada deputado (posse, licença, afastamento,
                vacância) da faixa acima — em lotes, com progresso. Popula a situação real, os
                afastamentos e as vacâncias. É demorado (~1 chamada por deputado); rode depois do cadastro.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <div>
              <h4 className="font-medium text-sm">Proposições legislativas</h4>
              <p className="text-xs text-muted-foreground mt-1">
                PLs, PECs, MPVs etc. com autores e tramitação. Até 500 por tipo/ano.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 items-end">
              <div>
                <Label className="text-xs">Tipo</Label>
                <select
                  className="mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={p.propTipo}
                  onChange={(e) => p.setPropTipo(e.target.value)}
                  disabled={p.camaraBusy !== null}
                >
                  {["PL","PEC","PLP","MPV","PDL","PRC"].map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <Button size="sm" disabled={p.camaraBusy !== null} onClick={p.onImportarPropsCamara}>
                {p.camaraBusy === "props" ? <Loader2 className="size-3.5 mr-2 animate-spin" /> : null}
                Importar {p.propTipo} de {p.ano}
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <div>
              <h4 className="font-medium text-sm">Votações nominais</h4>
              <p className="text-xs text-muted-foreground mt-1">
                Cada votação + votos individuais. Calcula disciplina partidária. Comece com 15–30 dias.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 items-end">
              <div>
                <Label className="text-xs">De</Label>
                <Input type="date" value={p.votIni} onChange={(e) => p.setVotIni(e.target.value)} disabled={p.camaraBusy !== null} className="mt-1 w-40" />
              </div>
              <div>
                <Label className="text-xs">Até</Label>
                <Input type="date" value={p.votFim} onChange={(e) => p.setVotFim(e.target.value)} disabled={p.camaraBusy !== null} className="mt-1 w-40" />
              </div>
              <Button size="sm" disabled={p.camaraBusy !== null} onClick={p.onImportarVotsCamara}>
                {p.camaraBusy === "vots" ? <Loader2 className="size-3.5 mr-2 animate-spin" /> : null}
                Importar votações
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="senado" className="space-y-4 mt-4">
          <div className="rounded-xl border border-border bg-card p-3">
            <PeriodoInline ano={p.ano} mes={p.mes} setAno={p.setAno} setMes={p.setMes} disabled={p.senadoBusy !== null || p.isRunning} hint="Mês usado em CEAPS e votações; ano usado em matérias." years={p.years} />
          </div>
          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <div>
              <h3 className="font-display text-lg">Senado Federal</h3>
              <p className="text-xs text-muted-foreground mt-1">
                API <code>legis.senado.leg.br</code>. Cadastro primeiro, depois CEAPS / matérias / votações.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" disabled={p.senadoBusy !== null} onClick={p.onImportarSenadores}>
                {p.senadoBusy === "sen" ? <Loader2 className="size-3.5 mr-2 animate-spin" /> : null}
                Importar cadastro de senadores
              </Button>
              <Button size="sm" disabled={p.senadoBusy !== null} onClick={p.onImportarCEAPSSenado}>
                {p.senadoBusy === "ceaps" ? <Loader2 className="size-3.5 mr-2 animate-spin" /> : null}
                Importar CEAPS de {MONTHS[p.mes-1]}/{p.ano}
              </Button>
              <Button variant="outline" size="sm" disabled={p.senadoBusy !== null} onClick={p.onImportarMatSenado}>
                {p.senadoBusy === "mat" ? <Loader2 className="size-3.5 mr-2 animate-spin" /> : null}
                Importar matérias PL/{p.ano}
              </Button>
              <Button variant="outline" size="sm" disabled={p.senadoBusy !== null} onClick={p.onImportarVotSenado}>
                {p.senadoBusy === "vot" ? <Loader2 className="size-3.5 mr-2 animate-spin" /> : null}
                Importar votações de {MONTHS[p.mes-1]}/{p.ano}
              </Button>
            </div>
            <div className="border-t border-border pt-3 space-y-2">
              <p className="text-xs text-muted-foreground">
                Histórico: importa o cadastro de legislaturas passadas (partido/UF por legislatura).
                Não sobrescreve o estado atual. Legislatura 52 = 2003 … 57 = 2023.
              </p>
              <div className="flex flex-wrap gap-2 items-end">
                <div>
                  <Label className="text-xs">Legislatura inicial</Label>
                  <Input type="number" value={p.legHistIni} onChange={(e) => p.setLegHistIni(Number(e.target.value))} disabled={p.senadoBusy !== null} className="mt-1 w-24" />
                </div>
                <div>
                  <Label className="text-xs">Legislatura final</Label>
                  <Input type="number" value={p.legHistFim} onChange={(e) => p.setLegHistFim(Number(e.target.value))} disabled={p.senadoBusy !== null} className="mt-1 w-24" />
                </div>
                <Button variant="outline" size="sm" disabled={p.senadoBusy !== null} onClick={p.onImportarHistSenado}>
                  {p.senadoBusy === "hist" ? <Loader2 className="size-3.5 mr-2 animate-spin" /> : null}
                  Importar histórico de senadores
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="entes" className="space-y-4 mt-4">
          <EntesPanel ano={p.ano} mes={p.mes} />
        </TabsContent>

        <TabsContent value="tse" className="space-y-4 mt-4">
          <TseImportPanel />
        </TabsContent>

        <TabsContent value="historico" className="space-y-4 mt-4">
          <div className="flex items-center gap-2 mb-3">
            <History className="size-4 text-muted-foreground" />
            <h3 className="font-display text-lg">Histórico de importações</h3>
            <Button size="sm" variant="ghost" onClick={p.refreshHistory} disabled={p.loadingHist}>
              {p.loadingHist ? "Atualizando…" : "Atualizar"}
            </Button>
            <span className="ml-auto text-xs text-muted-foreground">
              {p.history.length.toLocaleString("pt-BR")} registros carregados
            </span>
          </div>
          {p.history.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma importação registrada ainda.</p>
          ) : (
            <TooltipProvider delayDuration={150}>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left p-3">Quando</th>
                    <th className="text-left p-3">Fonte</th>
                    <th className="text-left p-3">Escopo</th>
                    <th className="text-left p-3">Período</th>
                    <th className="text-right p-3">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex items-center gap-1 uppercase tracking-wider cursor-help transition-colors hover:text-destructive">
                            Bruto <Info className="size-3 opacity-60" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs text-xs">
                          Total de registros devolvidos pela API de origem para o período
                          consultado (antes de filtros e deduplicação). Disponível apenas
                          para o Portal CGU.
                        </TooltipContent>
                      </Tooltip>
                    </th>
                    <th className="text-right p-3">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex items-center gap-1 uppercase tracking-wider cursor-help transition-colors hover:text-destructive">
                            Importados <Info className="size-3 opacity-60" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs text-xs">
                          Registros efetivamente persistidos no banco após filtros, sanitização
                          e deduplicação. Pode ser menor que o Bruto.
                        </TooltipContent>
                      </Tooltip>
                    </th>
                    <th className="text-left p-3">Erros / Avisos</th>
                    <th className="text-left p-3">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex items-center gap-1 uppercase tracking-wider cursor-help transition-colors hover:text-destructive">
                            Endpoint <Info className="size-3 opacity-60" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-md text-xs">
                          URL da API externa efetivamente consultada nesta tentativa
                          (método + endpoint + parâmetros). Útil para reproduzir a
                          chamada manualmente via cURL.
                        </TooltipContent>
                      </Tooltip>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {p.history.map((h) => (
                    <tr key={h.id} className="border-t border-border">
                      <td className="p-3 whitespace-nowrap">{new Date(h.quando).toLocaleString("pt-BR")}</td>
                      <td className="p-3 whitespace-nowrap">{h.fonte}</td>
                      <td className="p-3 whitespace-nowrap">{h.escopo}</td>
                      <td className="p-3 whitespace-nowrap font-mono text-xs">{h.periodo}</td>
                      <td className="p-3 text-right tabular-nums text-muted-foreground">
                        {h.bruto === null ? "—" : h.bruto.toLocaleString("pt-BR")}
                      </td>
                      <td className="p-3 text-right font-medium tabular-nums">
                        {h.bruto !== null && h.bruto > h.importados ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex items-center gap-1 cursor-help underline decoration-dotted underline-offset-2">
                                {h.importados.toLocaleString("pt-BR")}
                                <Info className="size-3 opacity-60" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs text-xs space-y-1">
                              <p>
                                <strong>{(h.bruto - h.importados).toLocaleString("pt-BR")}</strong>{" "}
                                registro(s) do bruto não foram persistidos.
                              </p>
                              <p className="text-muted-foreground">
                                Motivos típicos: deduplicação por chave única
                                (mesmo id já existente), filtros de escopo/órgão,
                                registros descartados por sanitização LGPD ou
                                campos obrigatórios ausentes, e linhas rejeitadas
                                por validação de schema.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          h.importados.toLocaleString("pt-BR")
                        )}
                      </td>
                      <td className="p-3 text-xs min-w-[18rem] max-w-md space-y-1">
                        {h.erros.length === 0 && h.avisos.length === 0 ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <>
                            {h.erros.length > 0 && (
                              <div className="overflow-x-auto whitespace-nowrap text-destructive scrollbar-thin">
                                {h.erros.join(" · ")}
                              </div>
                            )}
                            {h.avisos.length > 0 && (
                              <div className="overflow-x-auto whitespace-nowrap text-muted-foreground scrollbar-thin">
                                <span className="uppercase tracking-wider text-[10px] mr-1 text-accent">
                                  info
                                </span>
                                {h.avisos.join(" · ")}
                              </div>
                            )}
                          </>
                        )}
                      </td>
                      <td className="p-3 min-w-[24rem]">
                        <div className="overflow-x-auto whitespace-nowrap font-mono text-[11px] text-muted-foreground scrollbar-thin">
                          {h.endpoint ?? "—"}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <HistorySentinel hasMore={p.histHasMore} loading={p.histLoadingMore} onLoadMore={p.loadMoreHistory} />
            </div>
            </TooltipProvider>
          )}
        </TabsContent>

        <TabsContent value="manutencao" className="space-y-4 mt-4">
          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <h3 className="font-display text-lg flex items-center gap-2">
              <ShieldCheck className="size-4 text-accent" /> Governança de dados (LGPD)
            </h3>
            <p className="text-xs text-muted-foreground">
              Reaplica máscaras de CPF, e-mail, telefone e CEP no campo <code>objeto</code> de
              contratos já persistidos antes da Fase 3. Idempotente.
            </p>
            <Button variant="outline" size="sm" disabled={p.sanitizing || p.isRunning} onClick={p.onSanitize}>
              {p.sanitizing ? <Loader2 className="size-3.5 mr-2 animate-spin" /> : <ShieldCheck className="size-3.5 mr-2" />}
              Ressanitizar contratos existentes
            </Button>
          </div>

          <SincronizarTudoPanel isRunning={p.isRunning} runJobs={p.runJobsSinc} />

          <Collapsible className="rounded-xl border border-destructive/40 bg-destructive/5">
            <CollapsibleTrigger asChild>
              <button type="button" className="w-full px-5 py-4 flex flex-wrap items-center gap-2 text-left hover:bg-destructive/[0.08] rounded-xl">
                <Trash2 className="size-4 text-destructive" />
                <h3 className="font-display text-lg text-destructive">Zona destrutiva</h3>
                <span className="text-xs text-destructive/80">— irreversível, atenção</span>
                <span className="ml-auto text-xs text-muted-foreground">expandir / recolher</span>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="px-5 pb-5 space-y-3">
            <p className="text-xs text-muted-foreground">
              Selecione as fontes que quer limpar. Opcionalmente restrinja por
              intervalo de anos — fontes que não têm coluna de período são
              ignoradas pelo filtro e apagadas por completo se selecionadas
              (cadastros de deputados/senadores, fornecedores, órgãos).
              <strong> Irreversível.</strong>
            </p>

            <div className="flex flex-wrap gap-2 text-xs">
              <Button size="sm" variant="outline" onClick={p.selecionarTodasFontes} disabled={p.limpBusy}>
                Selecionar todas
              </Button>
              <Button size="sm" variant="ghost" onClick={p.limparSelecaoFontes} disabled={p.limpBusy}>
                Limpar seleção
              </Button>
            </div>

            <div className="grid sm:grid-cols-2 gap-x-4 gap-y-2 rounded-md border border-border bg-background/60 p-3">
              {FONTES_LIMPEZA.map((f) => {
                const periodOk = !!(f.yearCol || f.dateCol);
                return (
                  <label key={f.id} className="flex items-start gap-2 text-xs cursor-pointer">
                    <Checkbox
                      className="mt-0.5"
                      checked={p.limpFontes.has(f.id)}
                      onCheckedChange={(v) => p.toggleFonte(f.id, v === true)}
                      disabled={p.limpBusy}
                    />
                    <span>
                      <span className="font-medium text-foreground">{f.label}</span>
                      {!periodOk && p.limpUsarPeriodo && (
                        <span className="ml-1 text-amber-600">(sem período)</span>
                      )}
                      <span className="block text-muted-foreground">{f.descricao}</span>
                    </span>
                  </label>
                );
              })}
            </div>

            <div className="flex flex-wrap items-end gap-3 text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={p.limpUsarPeriodo}
                  onCheckedChange={(v) => p.setLimpUsarPeriodo(v === true)}
                  disabled={p.limpBusy}
                />
                <span className="text-xs">Restringir por período (ano)</span>
              </label>
              {p.limpUsarPeriodo && (
                <>
                  <div>
                    <Label className="text-xs">De</Label>
                    <select
                      className="mt-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                      value={p.limpAnoIni}
                      onChange={(e) => p.setLimpAnoIni(Number(e.target.value))}
                      disabled={p.limpBusy}
                    >
                      {p.years.map((y) => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs">Até</Label>
                    <select
                      className="mt-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                      value={p.limpAnoFim}
                      onChange={(e) => p.setLimpAnoFim(Number(e.target.value))}
                      disabled={p.limpBusy}
                    >
                      {p.years.map((y) => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                </>
              )}
            </div>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={p.isRunning || p.limpBusy || p.limpFontes.size === 0}
                  className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  {p.limpBusy ? <Loader2 className="size-3.5 mr-2 animate-spin" /> : <Trash2 className="size-3.5 mr-2" />}
                  Apagar {p.limpFontes.size} fonte(s){p.limpUsarPeriodo ? ` · ${p.limpAnoIni}–${p.limpAnoFim}` : ""}…
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Apagar as fontes selecionadas?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Vai remover {p.limpFontes.size} fonte(s)
                    {p.limpUsarPeriodo ? ` no intervalo ${p.limpAnoIni}–${p.limpAnoFim}` : " por completo"}.
                    Digite <strong>APAGAR</strong> para confirmar.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <Input
                  value={p.limpConfirm}
                  onChange={(e) => p.setLimpConfirm(e.target.value)}
                  placeholder="APAGAR"
                  className="font-mono"
                />
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => p.setLimpConfirm("")}>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={p.limparSelecionado}
                    disabled={p.limpConfirm !== "APAGAR" || p.limpBusy}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Apagar definitivamente
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            </CollapsibleContent>
          </Collapsible>
        </TabsContent>
      </Tabs>
    </div>
  );
}