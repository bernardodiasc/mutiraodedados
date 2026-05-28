import { Database, Loader2, History, Trash2, AlertTriangle, Zap, ShieldCheck, Info } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useData } from "@/lib/data-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ORGAOS_BASE } from "@/lib/data/catalog";
import { clearImportData, listHistoricoUnificado, type HistoricoEntrada } from "@/lib/data/real/portal.functions";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ressanitizarContratosCache } from "@/lib/sanitize-ingestao.functions";
import { importarDeputados, importarCEAPMes } from "@/lib/data/camara/ingest.functions";
import { importarProposicoes } from "@/lib/data/camara/proposicoes.functions";
import { importarVotacoes, listarVotacoesPeriodo, importarVotacaoUnica } from "@/lib/data/camara/votacoes.functions";
import { importarSenadores, importarCEAPSMes } from "@/lib/data/senado/ingest.functions";
import { importarMaterias } from "@/lib/data/senado/materias.functions";
import { importarVotacoesSenado } from "@/lib/data/senado/votacoes.functions";
import { importarContratosPNCP } from "@/lib/data/pncp/ingest.functions";
import { importarRelatorioSICONFI } from "@/lib/data/siconfi/ingest.functions";
import { importarConveniosTransferegov } from "@/lib/data/transferegov/ingest.functions";
import { toast } from "sonner";
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
import { EntesPanel } from "@/components/AdminEntesPanel";
import { CoberturaMatrix, type CoberturaJob } from "@/components/CoberturaMatrix";
import { SincronizarTudoPanel } from "@/components/SincronizarTudoPanel";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { FONTES_LIMPEZA } from "@/lib/data/limpeza";
import { dentroDaJanela } from "@/lib/data/janelas";

function defaultMonth(): { ini: string; fim: string; ano: number; mes: number } {
  const d = new Date();
  d.setMonth(d.getMonth() - 3);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const last = new Date(y, m, 0).getDate();
  return {
    ini: `${y}-${String(m).padStart(2, "0")}-01`,
    fim: `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}`,
    ano: y,
    mes: m,
  };
}

function monthRange(year: number, month: number) {
  const last = new Date(year, month, 0).getDate();
  const mm = String(month).padStart(2, "0");
  return { ini: `${year}-${mm}-01`, fim: `${year}-${mm}-${String(last).padStart(2, "0")}` };
}

type BatchProgress = {
  total: number;
  done: number;
  current: string;
  importados: number;
  erros: number;
};

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 2014 + 1 }, (_, i) => CURRENT_YEAR - i);
const MONTHS = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

function PeriodoInline({
  ano, mes, setAno, setMes, disabled, mostraMes = true, hint,
}: {
  ano: number; mes: number;
  setAno: (n: number) => void; setMes: (n: number) => void;
  disabled?: boolean; mostraMes?: boolean; hint?: string;
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
          {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function AdminImportPanel() {
  const { loadRealOrgao, refreshFromDB } = useData();
  const listHistFn = useServerFn(listHistoricoUnificado);
  const clearFn = useServerFn(clearImportData);
  const sanitizeFn = useServerFn(ressanitizarContratosCache);
  const def = useMemo(defaultMonth, []);
  const cobertos = useMemo(() => ORGAOS_BASE.filter((o) => o.disponivelPortal), []);

  const [orgao, setOrgao] = useState<string>(cobertos[0].cod);
  const [ano, setAno] = useState<number>(def.ano);
  const [mes, setMes] = useState<number>(def.mes);

  const HIST_PAGE = 50;
  const [history, setHistory] = useState<HistoricoEntrada[]>([]);
  const [histHasMore, setHistHasMore] = useState(false);
  const [histLoadingMore, setHistLoadingMore] = useState(false);
  const [loadingHist, setLoadingHist] = useState(false);
  const [batch, setBatch] = useState<BatchProgress | null>(null);
  const cancelRef = useRef(false);
  const [sanitizing, setSanitizing] = useState(false);
  // === Limpeza seletiva ===
  const [limpFontes, setLimpFontes] = useState<Set<string>>(new Set());
  const [limpUsarPeriodo, setLimpUsarPeriodo] = useState(false);
  const [limpAnoIni, setLimpAnoIni] = useState<number>(CURRENT_YEAR);
  const [limpAnoFim, setLimpAnoFim] = useState<number>(CURRENT_YEAR);
  const [limpConfirm, setLimpConfirm] = useState("");
  const [limpBusy, setLimpBusy] = useState(false);

  const toggleFonte = (id: string, v: boolean) => {
    setLimpFontes((prev) => {
      const n = new Set(prev);
      if (v) n.add(id);
      else n.delete(id);
      return n;
    });
  };

  const limparSelecionado = async () => {
    if (limpConfirm !== "APAGAR") {
      toast.error("Digite APAGAR para confirmar.");
      return;
    }
    if (limpFontes.size === 0) {
      toast.error("Selecione ao menos uma fonte.");
      return;
    }
    setLimpBusy(true);
    try {
      const payload: Record<string, unknown> = {
        confirm: "APAGAR",
        fontes: Array.from(limpFontes),
      };
      if (limpUsarPeriodo) {
        if (limpAnoIni > limpAnoFim) throw new Error("Ano inicial maior que o final.");
        payload.anoIni = limpAnoIni;
        payload.anoFim = limpAnoFim;
      }
      const res = await clearFn({ data: payload as never });
      toast.success(`Apagado: ${JSON.stringify(res.removed)}`);
      setLimpConfirm("");
      await refreshHistory();
      await refreshFromDB();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLimpBusy(false);
    }
  };

  const importarDepFn = useServerFn(importarDeputados);
  const importarCEAPFn = useServerFn(importarCEAPMes);
  const importarPropsFn = useServerFn(importarProposicoes);
  const importarVotsFn = useServerFn(importarVotacoes);
  const listarVotsCamFn = useServerFn(listarVotacoesPeriodo);
  const importarVotCamUnicaFn = useServerFn(importarVotacaoUnica);
  const importarSenFn = useServerFn(importarSenadores);
  const importarCEAPSFn = useServerFn(importarCEAPSMes);
  const importarMatSenFn = useServerFn(importarMaterias);
  const importarVotSenFn = useServerFn(importarVotacoesSenado);
  const [senadoBusy, setSenadoBusy] = useState<null | string>(null);
  const [camaraBusy, setCamaraBusy] = useState<null | string>(null);
  const [propTipo, setPropTipo] = useState<string>("PL");
  const [votIni, setVotIni] = useState<string>(() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [votFim, setVotFim] = useState<string>(() => new Date().toISOString().slice(0, 10));

  const refreshHistory = async () => {
    setLoadingHist(true);
    try {
      const res = await listHistFn({ data: { offset: 0, limit: HIST_PAGE } });
      setHistory(res.entradas);
      setHistHasMore(res.hasMore);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoadingHist(false);
    }
  };

  const loadMoreHistory = async () => {
    if (histLoadingMore || !histHasMore) return;
    setHistLoadingMore(true);
    try {
      const res = await listHistFn({ data: { offset: history.length, limit: HIST_PAGE } });
      setHistory((prev) => [...prev, ...res.entradas]);
      setHistHasMore(res.hasMore);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setHistLoadingMore(false);
    }
  };

  useMemoOnce(() => {
    void refreshHistory();
  });

  const runBatch = async (
    jobs: Array<{ cod: string; year: number; month: number; label: string }>,
    title: string,
  ) => {
    if (batch) {
      toast.error("Já existe um lote em execução.");
      return;
    }
    // Filtra períodos fora da janela conhecida da fonte CGU (Portal da
    // Transparência publica contratos a partir de 2013) e meses futuros.
    const totalBruto = jobs.length;
    jobs = jobs.filter((j) => dentroDaJanela("cgu", j.year, j.month));
    const puladosJanela = totalBruto - jobs.length;
    if (puladosJanela > 0) {
      toast.info(`${puladosJanela} mês(es) fora da janela do Portal CGU foram ignorados.`);
    }
    if (jobs.length === 0) {
      toast.success("Nada a importar no intervalo informado.");
      return;
    }
    cancelRef.current = false;
    // Renova a sessão antes de iniciar — evita 401 no meio do lote longo.
    try { await supabase.auth.refreshSession(); } catch { /* tolerante */ }
    setBatch({ total: jobs.length, done: 0, current: title, importados: 0, erros: 0 });
    let importados = 0;
    let erros = 0;
    const PER_JOB_TIMEOUT_MS = 4 * 60 * 1000;
    for (let i = 0; i < jobs.length; i++) {
      if (cancelRef.current) break;
      // A cada 10 jobs, refresca proativamente.
      if (i > 0 && i % 10 === 0) {
        try { await supabase.auth.refreshSession(); } catch { /* tolerante */ }
      }
      const job = jobs[i];
      const { ini, fim } = monthRange(job.year, job.month);
      setBatch({ total: jobs.length, done: i, current: job.label, importados, erros });
      try {
        const meta = await Promise.race<{ importados: number; erros: string[] }>([
          loadRealOrgao(job.cod, { dataInicial: ini, dataFinal: fim }),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error(`timeout após ${Math.round(PER_JOB_TIMEOUT_MS / 1000)}s`)),
              PER_JOB_TIMEOUT_MS,
            ),
          ),
        ]);
        importados += meta.importados;
        if (meta.erros.length > 0) erros += meta.erros.length;
      } catch (e) {
        erros += 1;
        toast.error(`${job.label}: ${(e as Error).message}`);
      }
    }
    setBatch({
      total: jobs.length,
      done: jobs.length,
      current: cancelRef.current ? "Cancelado" : "Concluído",
      importados,
      erros,
    });
    await refreshHistory();
    await refreshFromDB();
    toast.success(`${title}: ${importados} contratos importados · ${erros} erros`);
    setTimeout(() => setBatch(null), 4000);
  };

  const importarUnico = () => {
    const o = ORGAOS_BASE.find((x) => x.cod === orgao)!;
    return runBatch(
      [{ cod: orgao, year: ano, month: mes, label: `${o.sigla} · ${MONTHS[mes - 1]}/${ano}` }],
      `${o.sigla} ${MONTHS[mes - 1]}/${ano}`,
    );
  };

  const importarAnoOrgao = () => {
    const o = ORGAOS_BASE.find((x) => x.cod === orgao)!;
    const jobs = Array.from({ length: 12 }, (_, i) => ({
      cod: orgao,
      year: ano,
      month: i + 1,
      label: `${o.sigla} · ${MONTHS[i]}/${ano}`,
    }));
    return runBatch(jobs, `${o.sigla} — ano ${ano}`);
  };

  const importarMesTodos = () => {
    const jobs = cobertos.map((o) => ({
      cod: o.cod,
      year: ano,
      month: mes,
      label: `${o.sigla} · ${MONTHS[mes - 1]}/${ano}`,
    }));
    return runBatch(jobs, `Todos os órgãos — ${MONTHS[mes - 1]}/${ano}`);
  };

  const importarAnoTodos = () => {
    const jobs: Array<{ cod: string; year: number; month: number; label: string }> = [];
    for (const o of cobertos) {
      for (let m = 1; m <= 12; m++) {
        jobs.push({ cod: o.cod, year: ano, month: m, label: `${o.sigla} · ${MONTHS[m - 1]}/${ano}` });
      }
    }
    return runBatch(jobs, `Todos os órgãos — ano ${ano}`);
  };

  const importarHistoricoCompleto = () => {
    const jobs: Array<{ cod: string; year: number; month: number; label: string }> = [];
    for (let y = 2014; y <= CURRENT_YEAR; y++) {
      for (const o of cobertos) {
        for (let m = 1; m <= 12; m++) {
          jobs.push({ cod: o.cod, year: y, month: m, label: `${o.sigla} · ${MONTHS[m - 1]}/${y}` });
        }
      }
    }
    return runBatch(jobs, `Histórico completo 2014–${CURRENT_YEAR}`);
  };

  /** Runner genérico — cada job é uma função async que devolve um contador. */
  const runJobs = async (
    jobs: Array<{ label: string; run: () => Promise<number> }>,
    title: string,
    unidade = "registros",
  ) => {
    if (batch) {
      toast.error("Já existe um lote em execução.");
      return;
    }
    cancelRef.current = false;
    try { await supabase.auth.refreshSession(); } catch { /* tolerante */ }
    setBatch({ total: jobs.length, done: 0, current: title, importados: 0, erros: 0 });
    let importados = 0;
    let erros = 0;
    let errosTransitorios = 0;
    // Circuit breaker por fonte: 3 erros transitórios seguidos da mesma fonte
    // → pula o resto dessa fonte no lote (API está fora do ar).
    const consecutivosPorFonte = new Map<string, number>();
    const fontesEmCircuito = new Set<string>();
    const fonteDoLabel = (label: string) => label.split(" · ")[0].trim();
    // Timeout de segurança por job: se o servidor travar (ex. API de origem
    // muito lenta, limite de subrequests no worker), o lote continua em vez
    // de ficar pendurado pra sempre aguardando uma resposta que não vem.
    const PER_JOB_TIMEOUT_MS = 4 * 60 * 1000;
    for (let i = 0; i < jobs.length; i++) {
      if (cancelRef.current) break;
      if (i > 0 && i % 10 === 0) {
        try { await supabase.auth.refreshSession(); } catch { /* tolerante */ }
      }
      const job = jobs[i];
      const fonte = fonteDoLabel(job.label);
      if (fontesEmCircuito.has(fonte)) {
        // pula sem contar como erro — será retomado em outra execução
        continue;
      }
      setBatch({ total: jobs.length, done: i, current: job.label, importados, erros });
      try {
        importados += await Promise.race<number>([
          job.run(),
          new Promise<number>((_, reject) =>
            setTimeout(
              () => reject(new Error(`timeout após ${Math.round(PER_JOB_TIMEOUT_MS / 1000)}s`)),
              PER_JOB_TIMEOUT_MS,
            ),
          ),
        ]);
        consecutivosPorFonte.set(fonte, 0);
      } catch (e) {
        const msg = (e as Error).message;
        const transitorio = msg.startsWith("TRANSIENT:") || msg.includes("timeout após");
        if (transitorio) {
          errosTransitorios += 1;
          const n = (consecutivosPorFonte.get(fonte) ?? 0) + 1;
          consecutivosPorFonte.set(fonte, n);
          if (n >= 3) {
            fontesEmCircuito.add(fonte);
            toast.warning(`${fonte} fora do ar — pulando o restante desse lote (tente novamente mais tarde).`);
          }
        } else {
          erros += 1;
          toast.error(`${job.label}: ${msg}`);
          consecutivosPorFonte.set(fonte, 0);
        }
      }
    }
    setBatch({
      total: jobs.length,
      done: jobs.length,
      current: cancelRef.current ? "Cancelado" : "Concluído",
      importados,
      erros,
    });
    const partes = [`${importados} ${unidade}`];
    if (erros > 0) partes.push(`${erros} erros`);
    if (errosTransitorios > 0) partes.push(`${errosTransitorios} indisponíveis (retomáveis)`);
    toast.success(`${title}: ${partes.join(" · ")}`);
    setTimeout(() => setBatch(null), 4000);
  };

  // ---------- Câmara — lotes ----------
  const loteCEAPAnoCamara = () => {
    const jobs = Array.from({ length: 12 }, (_, i) => i + 1)
      .filter((m) => dentroDaJanela("camara_ceap", ano, m))
      .map((m) => ({
        label: `Câmara CEAP · ${MONTHS[m - 1]}/${ano}`,
        run: async () => {
          const r = await importarCEAPFn({ data: { ano, mes: m } });
          return r.importados;
        },
      }));
    return runJobs(jobs, `Câmara CEAP — ano ${ano}`, "notas");
  };

  const loteVotacoesAnoCamara = () => {
    const jobs = Array.from({ length: 12 }, (_, i) => i + 1)
      .filter((m) => dentroDaJanela("camara_vot", ano, m))
      .map((m) => ({
        label: `Câmara votações · ${MONTHS[m - 1]}/${ano}`,
        run: async () => {
          const { ini, fim } = monthRange(ano, m);
          // Lista IDs e processa votação por votação — cada serverFn
          // fica leve (<= ~11 subrequests) e o lote não estoura limites.
          const { ids } = await listarVotsCamFn({
            data: { dataInicio: ini, dataFim: fim, maxPaginas: 5 },
          });
          let total = 0;
          for (const id of ids) {
            try {
              const r = await importarVotCamUnicaFn({ data: { id } });
              total += r.votos;
            } catch (e) {
              console.error(`[camara_vot] votação ${id} falhou`, e);
            }
          }
          return total;
        },
      }));
    return runJobs(jobs, `Câmara votações — ano ${ano}`, "votos");
  };

  const loteProposicoesTodosTiposCamara = () => {
    const tipos = ["PL", "PEC", "PLP", "MPV", "PDL", "PRC"];
    const jobs = tipos.map((t) => ({
      label: `Câmara ${t}/${ano}`,
      run: async () => {
        const r = await importarPropsFn({ data: { ano, siglaTipo: t, maxPaginas: 5 } });
        return r.importados;
      },
    }));
    return runJobs(jobs, `Câmara proposições — ano ${ano} (todos os tipos)`, "proposições");
  };

  // ---------- Senado — lotes ----------
  const loteCEAPSAnoSenado = () => {
    const jobs = Array.from({ length: 12 }, (_, i) => i + 1)
      .filter((m) => dentroDaJanela("senado_ceaps", ano, m))
      .map((m) => ({
        label: `Senado CEAPS · ${MONTHS[m - 1]}/${ano}`,
        run: async () => {
          const r = await importarCEAPSFn({ data: { ano, mes: m } });
          return r.importados;
        },
      }));
    return runJobs(jobs, `Senado CEAPS — ano ${ano}`, "notas");
  };

  const loteVotacoesAnoSenado = () => {
    const jobs = Array.from({ length: 12 }, (_, i) => i + 1)
      .filter((m) => dentroDaJanela("senado_vot", ano, m))
      .map((m) => ({
        label: `Senado votações · ${MONTHS[m - 1]}/${ano}`,
        run: async () => {
          const r = monthRange(ano, m);
          const res = await importarVotSenFn({ data: { dataInicio: r.ini, dataFim: r.fim } });
          return res.votos;
        },
      }));
    return runJobs(jobs, `Senado votações — ano ${ano}`, "votos");
  };

  const loteMateriasTodosTiposSenado = () => {
    const tipos = ["PL", "PEC", "PLP", "MPV", "PDL", "PRS"];
    const jobs = tipos.map((t) => ({
      label: `Senado ${t}/${ano}`,
      run: async () => {
        const r = await importarMatSenFn({ data: { ano, sigla: t } });
        return r.importados;
      },
    }));
    return runJobs(jobs, `Senado matérias — ano ${ano} (todos os tipos)`, "matérias");
  };

  const isRunning = batch !== null && batch.done < batch.total;
  const progressPct = batch ? Math.round((batch.done / Math.max(1, batch.total)) * 100) : 0;
  const advancedHint =
    "Cuidado: executa muitas chamadas ao Portal. Use uma vez por período e evite repetir.";

  return (
    <div className="space-y-6">
      {/* === Progresso === */}
      {batch && (
        <div className="rounded-xl border border-border bg-muted/30 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm">
              <div className="font-medium">{batch.current}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {batch.done} / {batch.total} · {batch.importados} importados · {batch.erros} erros
              </div>
            </div>
            {isRunning && (
              <Button size="sm" variant="ghost" onClick={() => (cancelRef.current = true)}>
                Cancelar
              </Button>
            )}
          </div>
          <div className="h-1.5 bg-border rounded-full mt-3 overflow-hidden">
            <div className="h-full bg-accent transition-all" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      )}

      {/* Seletores de período aparecem inline em cada aba que precisa deles. */}
      <Tabs defaultValue="cobertura" className="w-full">
        <TabsList className="flex flex-wrap h-auto justify-start">
          <TabsTrigger value="cobertura">Cobertura</TabsTrigger>
          <TabsTrigger value="portal">Portal CGU</TabsTrigger>
          <TabsTrigger value="camara">Câmara</TabsTrigger>
          <TabsTrigger value="senado">Senado</TabsTrigger>
          <TabsTrigger value="entes">Estados/Municípios</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
          <TabsTrigger value="manutencao">Manutenção</TabsTrigger>
        </TabsList>

        {/* ========== COBERTURA ========== */}
        <TabsContent value="cobertura" className="space-y-4 mt-4">
          <CoberturaMatrix
            isRunning={isRunning}
            runJobs={async (jobs: CoberturaJob[], title: string) => {
              await runJobs(jobs, title);
              await refreshFromDB();
            }}
          />
        </TabsContent>

        {/* ========== PORTAL CGU ========== */}
        <TabsContent value="portal" className="space-y-4 mt-4">
          <div className="rounded-xl border border-border bg-card p-3">
            <PeriodoInline ano={ano} mes={mes} setAno={setAno} setMes={setMes} disabled={isRunning} hint="Usado pelos botões desta aba." />
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="font-display text-lg flex items-center gap-2">
              <Database className="size-4 text-accent" />
              Executivo — contratos por órgão
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Importa contratos do Portal da Transparência (CGU) para o órgão selecionado.
            </p>
            <div className="grid sm:grid-cols-2 gap-3 mt-4">
              <div>
                <Label className="text-xs">Órgão</Label>
                <select
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={orgao}
                  onChange={(e) => setOrgao(e.target.value)}
                  disabled={isRunning}
                >
                  {cobertos.map((o) => (
                    <option key={o.cod} value={o.cod}>{o.sigla} — {o.nome}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <Button onClick={importarUnico} disabled={isRunning}>
                  {isRunning ? <Loader2 className="size-4 mr-2 animate-spin" /> : null}
                  Importar {MONTHS[mes - 1]}/{ano}
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              O Portal costuma ter lag de 1–3 meses. Se vier 0 resultados, tente um período mais antigo.
            </p>
          </div>

          <details className="group rounded-xl border border-dashed border-border bg-background/40">
            <summary className="cursor-pointer list-none px-4 py-3 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <Zap className="size-4" />
              <span className="font-medium">Ações em lote</span>
              <span className="text-xs">— evite clicar por acidente</span>
              <span className="ml-auto text-xs group-open:hidden">expandir</span>
              <span className="ml-auto text-xs hidden group-open:inline">recolher</span>
            </summary>
            <div className="px-4 pb-4 pt-1 space-y-3">
              <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                <AlertTriangle className="size-3.5 mt-0.5 shrink-0" />
                {advancedHint}
              </p>
              <div className="grid sm:grid-cols-2 gap-2">
                <BatchBtn
                  onClick={importarAnoOrgao}
                  disabled={isRunning}
                  title={`Ano ${ano} do órgão selecionado`}
                  subtitle="12 chamadas"
                />
                <BatchBtn
                  onClick={importarMesTodos}
                  disabled={isRunning}
                  title={`${MONTHS[mes - 1]}/${ano} · todos os órgãos`}
                  subtitle={`${cobertos.length} chamadas`}
                />
                <BatchBtn
                  onClick={importarAnoTodos}
                  disabled={isRunning}
                  title={`Ano ${ano} · todos os órgãos`}
                  subtitle={`${cobertos.length * 12} chamadas`}
                />
                <BatchBtn
                  onClick={importarHistoricoCompleto}
                  disabled={isRunning}
                  title={`Histórico completo (2014–${CURRENT_YEAR})`}
                  subtitle={`${cobertos.length * 12 * (CURRENT_YEAR - 2014 + 1)} chamadas — pode levar horas`}
                  danger
                />
              </div>
            </div>
          </details>
        </TabsContent>

        {/* ========== CÂMARA ========== */}
        <TabsContent value="camara" className="space-y-4 mt-4">
          <div className="rounded-xl border border-border bg-card p-3">
            <PeriodoInline ano={ano} mes={mes} setAno={setAno} setMes={setMes} disabled={camaraBusy !== null || isRunning} hint="Mês usado em CEAP e votações; ano usado em proposições e lotes." />
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
              <Button
                variant="outline"
                size="sm"
                disabled={camaraBusy !== null}
                onClick={async () => {
                  setCamaraBusy("deputados");
                  try {
                    const r = await importarDepFn({ data: {} });
                    toast.success(`Cadastro importado: ${r.importados} deputados.`);
                  } catch (e) { toast.error((e as Error).message); }
                  finally { setCamaraBusy(null); }
                }}
              >
                {camaraBusy === "deputados" ? <Loader2 className="size-3.5 mr-2 animate-spin" /> : null}
                Importar cadastro de deputados
              </Button>
              <Button
                size="sm"
                disabled={camaraBusy !== null}
                onClick={async () => {
                  setCamaraBusy("ceap");
                  try {
                    const r = await importarCEAPFn({ data: { ano, mes } });
                    toast.success(`CEAP ${MONTHS[mes-1]}/${ano}: ${r.importados} notas de ${r.deputadosProcessados} deputados.`);
                  } catch (e) { toast.error((e as Error).message); }
                  finally { setCamaraBusy(null); }
                }}
              >
                {camaraBusy === "ceap" ? <Loader2 className="size-3.5 mr-2 animate-spin" /> : null}
                Importar CEAP de {MONTHS[mes-1]}/{ano}
              </Button>
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
                  value={propTipo}
                  onChange={(e) => setPropTipo(e.target.value)}
                  disabled={camaraBusy !== null}
                >
                  {["PL","PEC","PLP","MPV","PDL","PRC"].map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <Button
                size="sm"
                disabled={camaraBusy !== null}
                onClick={async () => {
                  setCamaraBusy("props");
                  try {
                    const r = await importarPropsFn({ data: { ano, siglaTipo: propTipo, maxPaginas: 5 } });
                    toast.success(`${propTipo}/${ano}: ${r.importados} proposições, ${r.autores} autores.`);
                  } catch (e) { toast.error((e as Error).message); }
                  finally { setCamaraBusy(null); }
                }}
              >
                {camaraBusy === "props" ? <Loader2 className="size-3.5 mr-2 animate-spin" /> : null}
                Importar {propTipo} de {ano}
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
                <Input
                  type="date"
                  value={votIni}
                  onChange={(e) => setVotIni(e.target.value)}
                  disabled={camaraBusy !== null}
                  className="mt-1 w-40"
                />
              </div>
              <div>
                <Label className="text-xs">Até</Label>
                <Input
                  type="date"
                  value={votFim}
                  onChange={(e) => setVotFim(e.target.value)}
                  disabled={camaraBusy !== null}
                  className="mt-1 w-40"
                />
              </div>
              <Button
                size="sm"
                disabled={camaraBusy !== null}
                onClick={async () => {
                  setCamaraBusy("vots");
                  try {
                    const r = await importarVotsFn({ data: { dataInicio: votIni, dataFim: votFim, maxPaginas: 3 } });
                    toast.success(`${r.votacoes} votações, ${r.votos} votos nominais.`);
                  } catch (e) { toast.error((e as Error).message); }
                  finally { setCamaraBusy(null); }
                }}
              >
                {camaraBusy === "vots" ? <Loader2 className="size-3.5 mr-2 animate-spin" /> : null}
                Importar votações
              </Button>
            </div>
          </div>

          <details className="group rounded-xl border border-dashed border-border bg-background/40">
            <summary className="cursor-pointer list-none px-4 py-3 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <Zap className="size-4" />
              <span className="font-medium">Ações em lote — Câmara</span>
              <span className="text-xs">— processa o ano inteiro</span>
              <span className="ml-auto text-xs group-open:hidden">expandir</span>
              <span className="ml-auto text-xs hidden group-open:inline">recolher</span>
            </summary>
            <div className="px-4 pb-4 pt-1 space-y-3">
              <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                <AlertTriangle className="size-3.5 mt-0.5 shrink-0" />
                Centenas de chamadas à API da Câmara. Use uma vez por ano e evite repetir.
              </p>
              <div className="grid sm:grid-cols-2 gap-2">
                <BatchBtn
                  onClick={loteCEAPAnoCamara}
                  disabled={batch !== null}
                  title={`CEAP — ano ${ano} (12 meses)`}
                  subtitle="~513 deputados × 12 chamadas"
                />
                <BatchBtn
                  onClick={loteProposicoesTodosTiposCamara}
                  disabled={batch !== null}
                  title={`Proposições — ano ${ano}`}
                  subtitle="PL · PEC · PLP · MPV · PDL · PRC"
                />
                <BatchBtn
                  onClick={loteVotacoesAnoCamara}
                  disabled={batch !== null}
                  title={`Votações nominais — ano ${ano}`}
                  subtitle="12 janelas mensais — pode levar 10–20 min"
                />
              </div>
            </div>
          </details>
        </TabsContent>

        {/* ========== SENADO ========== */}
        <TabsContent value="senado" className="space-y-4 mt-4">
          <div className="rounded-xl border border-border bg-card p-3">
            <PeriodoInline ano={ano} mes={mes} setAno={setAno} setMes={setMes} disabled={senadoBusy !== null || isRunning} hint="Mês usado em CEAPS e votações; ano usado em matérias e lotes." />
          </div>
          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <div>
              <h3 className="font-display text-lg">Senado Federal</h3>
              <p className="text-xs text-muted-foreground mt-1">
                API <code>legis.senado.leg.br</code>. Cadastro primeiro, depois CEAPS / matérias / votações.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={senadoBusy !== null}
                onClick={async () => {
                  setSenadoBusy("sen");
                  try {
                    const r = await importarSenFn({ data: {} });
                    toast.success(`Cadastro importado: ${r.importados} senadores.`);
                  } catch (e) { toast.error((e as Error).message); }
                  finally { setSenadoBusy(null); }
                }}
              >
                {senadoBusy === "sen" ? <Loader2 className="size-3.5 mr-2 animate-spin" /> : null}
                Importar cadastro de senadores
              </Button>
              <Button
                size="sm"
                disabled={senadoBusy !== null}
                onClick={async () => {
                  setSenadoBusy("ceaps");
                  try {
                    const r = await importarCEAPSFn({ data: { ano, mes } });
                    toast.success(`CEAPS ${MONTHS[mes-1]}/${ano}: ${r.importados} notas de ${r.senadoresProcessados} senadores.`);
                  } catch (e) { toast.error((e as Error).message); }
                  finally { setSenadoBusy(null); }
                }}
              >
                {senadoBusy === "ceaps" ? <Loader2 className="size-3.5 mr-2 animate-spin" /> : null}
                Importar CEAPS de {MONTHS[mes-1]}/{ano}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={senadoBusy !== null}
                onClick={async () => {
                  setSenadoBusy("mat");
                  try {
                    const r = await importarMatSenFn({ data: { ano, sigla: "PL" } });
                    toast.success(`Matérias PL/${ano}: ${r.importados} (${r.autores} autores).`);
                  } catch (e) { toast.error((e as Error).message); }
                  finally { setSenadoBusy(null); }
                }}
              >
                {senadoBusy === "mat" ? <Loader2 className="size-3.5 mr-2 animate-spin" /> : null}
                Importar matérias PL/{ano}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={senadoBusy !== null}
                onClick={async () => {
                  setSenadoBusy("vot");
                  try {
                    const r = monthRange(ano, mes);
                    const res = await importarVotSenFn({ data: { dataInicio: r.ini, dataFim: r.fim } });
                    toast.success(`Votações ${MONTHS[mes-1]}/${ano}: ${res.votacoes} sessões, ${res.votos} votos.`);
                  } catch (e) { toast.error((e as Error).message); }
                  finally { setSenadoBusy(null); }
                }}
              >
                {senadoBusy === "vot" ? <Loader2 className="size-3.5 mr-2 animate-spin" /> : null}
                Importar votações de {MONTHS[mes-1]}/{ano}
              </Button>
            </div>
          </div>

          <details className="group rounded-xl border border-dashed border-border bg-background/40">
            <summary className="cursor-pointer list-none px-4 py-3 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <Zap className="size-4" />
              <span className="font-medium">Ações em lote — Senado</span>
              <span className="text-xs">— processa o ano inteiro</span>
              <span className="ml-auto text-xs group-open:hidden">expandir</span>
              <span className="ml-auto text-xs hidden group-open:inline">recolher</span>
            </summary>
            <div className="px-4 pb-4 pt-1 space-y-3">
              <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                <AlertTriangle className="size-3.5 mt-0.5 shrink-0" />
                Muitas chamadas à API do Senado. Use uma vez por ano e evite repetir.
              </p>
              <div className="grid sm:grid-cols-2 gap-2">
                <BatchBtn
                  onClick={loteCEAPSAnoSenado}
                  disabled={batch !== null}
                  title={`CEAPS — ano ${ano} (12 meses)`}
                  subtitle="81 senadores × 12 chamadas"
                />
                <BatchBtn
                  onClick={loteMateriasTodosTiposSenado}
                  disabled={batch !== null}
                  title={`Matérias — ano ${ano}`}
                  subtitle="PL · PEC · PLP · MPV · PDL · PRS"
                />
                <BatchBtn
                  onClick={loteVotacoesAnoSenado}
                  disabled={batch !== null}
                  title={`Votações — ano ${ano}`}
                  subtitle="12 janelas mensais"
                />
              </div>
            </div>
          </details>
        </TabsContent>

        {/* ========== ESTADOS / MUNICÍPIOS ========== */}
        <TabsContent value="entes" className="space-y-4 mt-4">
          <EntesPanel ano={ano} mes={mes} />
        </TabsContent>

        {/* ========== HISTÓRICO ========== */}
        <TabsContent value="historico" className="space-y-4 mt-4">
          <div className="flex items-center gap-2 mb-3">
            <History className="size-4 text-muted-foreground" />
            <h3 className="font-display text-lg">Histórico de importações</h3>
            <Button size="sm" variant="ghost" onClick={refreshHistory} disabled={loadingHist}>
              {loadingHist ? "Atualizando…" : "Atualizar"}
            </Button>
            <span className="ml-auto text-xs text-muted-foreground">
              {history.length.toLocaleString("pt-BR")} registros carregados
            </span>
          </div>
          {history.length === 0 ? (
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
                  {history.map((h) => (
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
              <HistorySentinel
                hasMore={histHasMore}
                loading={histLoadingMore}
                onLoadMore={loadMoreHistory}
              />
            </div>
            </TooltipProvider>
          )}
        </TabsContent>

        {/* ========== MANUTENÇÃO ========== */}
        <TabsContent value="manutencao" className="space-y-4 mt-4">
          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <h3 className="font-display text-lg flex items-center gap-2">
              <ShieldCheck className="size-4 text-accent" /> Governança de dados (LGPD)
            </h3>
            <p className="text-xs text-muted-foreground">
              Reaplica máscaras de CPF, e-mail, telefone e CEP no campo <code>objeto</code> de
              contratos já persistidos antes da Fase 3. Idempotente.
            </p>
            <Button
              variant="outline"
              size="sm"
              disabled={sanitizing || isRunning}
              onClick={async () => {
                setSanitizing(true);
                try {
                  const res = await sanitizeFn();
                  toast.success(`Ressanitização: ${res.varridos} varridos, ${res.alterados} atualizados.`);
                  await refreshFromDB();
                } catch (e) {
                  toast.error((e as Error).message);
                } finally {
                  setSanitizing(false);
                }
              }}
            >
              {sanitizing ? <Loader2 className="size-3.5 mr-2 animate-spin" /> : <ShieldCheck className="size-3.5 mr-2" />}
              Ressanitizar contratos existentes
            </Button>
          </div>

          <SincronizarTudoPanel
            isRunning={isRunning}
            runJobs={async (jobs, title, unidade) => {
              await runJobs(jobs, title, unidade);
              await refreshFromDB();
            }}
          />

          <Collapsible className="rounded-xl border border-destructive/40 bg-destructive/5">
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="w-full px-5 py-4 flex flex-wrap items-center gap-2 text-left hover:bg-destructive/[0.08] rounded-xl"
              >
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
              <Button
                size="sm"
                variant="outline"
                onClick={() => setLimpFontes(new Set(FONTES_LIMPEZA.map((f) => f.id)))}
                disabled={limpBusy}
              >
                Selecionar todas
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setLimpFontes(new Set())}
                disabled={limpBusy}
              >
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
                      checked={limpFontes.has(f.id)}
                      onCheckedChange={(v) => toggleFonte(f.id, v === true)}
                      disabled={limpBusy}
                    />
                    <span>
                      <span className="font-medium text-foreground">{f.label}</span>
                      {!periodOk && limpUsarPeriodo && (
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
                  checked={limpUsarPeriodo}
                  onCheckedChange={(v) => setLimpUsarPeriodo(v === true)}
                  disabled={limpBusy}
                />
                <span className="text-xs">Restringir por período (ano)</span>
              </label>
              {limpUsarPeriodo && (
                <>
                  <div>
                    <Label className="text-xs">De</Label>
                    <select
                      className="mt-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                      value={limpAnoIni}
                      onChange={(e) => setLimpAnoIni(Number(e.target.value))}
                      disabled={limpBusy}
                    >
                      {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs">Até</Label>
                    <select
                      className="mt-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                      value={limpAnoFim}
                      onChange={(e) => setLimpAnoFim(Number(e.target.value))}
                      disabled={limpBusy}
                    >
                      {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
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
                  disabled={isRunning || limpBusy || limpFontes.size === 0}
                  className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  {limpBusy ? <Loader2 className="size-3.5 mr-2 animate-spin" /> : <Trash2 className="size-3.5 mr-2" />}
                  Apagar {limpFontes.size} fonte(s){limpUsarPeriodo ? ` · ${limpAnoIni}–${limpAnoFim}` : ""}…
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Apagar as fontes selecionadas?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Vai remover {limpFontes.size} fonte(s)
                    {limpUsarPeriodo ? ` no intervalo ${limpAnoIni}–${limpAnoFim}` : " por completo"}.
                    Digite <strong>APAGAR</strong> para confirmar.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <Input
                  value={limpConfirm}
                  onChange={(e) => setLimpConfirm(e.target.value)}
                  placeholder="APAGAR"
                  className="font-mono"
                />
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setLimpConfirm("")}>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={limparSelecionado}
                    disabled={limpConfirm !== "APAGAR" || limpBusy}
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

function HistorySentinel({
  hasMore,
  loading,
  onLoadMore,
}: {
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!hasMore) return;
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) onLoadMore();
      },
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
    <div
      ref={ref}
      className="p-3 text-center text-xs text-muted-foreground border-t border-border flex items-center justify-center gap-2"
    >
      {loading ? (
        <>
          <Loader2 className="size-3.5 animate-spin" /> Carregando mais…
        </>
      ) : (
        "Role para carregar mais"
      )}
    </div>
  );
}

function BatchBtn({
  onClick,
  disabled,
  title,
  subtitle,
  danger,
}: {
  onClick: () => void;
  disabled?: boolean;
  title: string;
  subtitle: string;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`text-left rounded-md border px-3 py-2 text-sm transition disabled:opacity-50 disabled:cursor-not-allowed ${
        danger
          ? "border-destructive/30 hover:bg-destructive/5 text-destructive/90"
          : "border-border hover:bg-muted/50"
      }`}
    >
      <div className="font-medium">{title}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{subtitle}</div>
    </button>
  );
}

function useMemoOnce(fn: () => void) {
  const ran = useRef(false);
  if (!ran.current) {
    ran.current = true;
    fn();
  }
}
