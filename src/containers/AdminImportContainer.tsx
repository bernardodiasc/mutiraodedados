import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useData } from "@/lib/data-store";
import { ORGAOS_BASE } from "@/lib/data/catalog";
import { clearImportData, listHistoricoUnificado, diagnosticarPortalPagina, listarVarredurasIncompletas, type HistoricoEntrada } from "@/lib/data/real/portal.functions";
import { ressanitizarContratosCache } from "@/lib/sanitize-ingestao.functions";
import { importarDeputados, importarCEAPMes } from "@/lib/data/camara/ingest.functions";
import { importarProposicoes } from "@/lib/data/camara/proposicoes.functions";
import { importarVotacoes } from "@/lib/data/camara/votacoes.functions";
import { importarSenadores, importarCEAPSMes } from "@/lib/data/senado/ingest.functions";
import { importarMaterias } from "@/lib/data/senado/materias.functions";
import { importarVotacoesSenado } from "@/lib/data/senado/votacoes.functions";
import { supabase } from "@/integrations/supabase/client";
import { FONTES_LIMPEZA } from "@/lib/data/limpeza";
import { resetCguSweepCache, abortCguSweep } from "@/lib/data/cobertura-jobs";
import {
  MONTHS,
  yearList,
  defaultMonth,
  monthRange,
  buildLimpezaPayload,
} from "@/lib/admin-import/logic";
import { AdminImportView, type BatchProgress } from "@/components/AdminImportView";
import type { CoberturaJob } from "@/components/CoberturaMatrix";

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = yearList(CURRENT_YEAR);

export function AdminImportContainer() {
  const { loadRealOrgao, refreshFromDB } = useData();
  const listHistFn = useServerFn(listHistoricoUnificado);
  const clearFn = useServerFn(clearImportData);
  const sanitizeFn = useServerFn(ressanitizarContratosCache);
  const diagFn = useServerFn(diagnosticarPortalPagina);
  const varredurasFn = useServerFn(listarVarredurasIncompletas);
  const [varredurasIncompletas, setVarredurasIncompletas] = useState<
    Array<{ orgaoCod: string; ultimaPagina: number; dataInicial?: string; dataFinal?: string }>
  >([]);
  const refreshVarreduras = async () => {
    try {
      setVarredurasIncompletas(await varredurasFn());
    } catch {
      /* tolerante — banner some se a consulta falhar */
    }
  };
  const def = useMemo(defaultMonth, []);
  const cobertos = useMemo(() => ORGAOS_BASE.filter((o) => o.disponivelPortal), []);

  const [orgao, setOrgao] = useState<string>(cobertos[0].cod);
  const [ano, setAno] = useState<number>(def.ano);
  const [mes, setMes] = useState<number>(def.mes);
  // Auto-continuar a varredura por detalhe: ao terminar uma rodada, dispara a
  // próxima automaticamente até a varredura do órgão completar (ou cancelar).
  const [autoContinuar, setAutoContinuar] = useState(false);
  // Janela de vigência opcional para o import do Portal CGU (ISO YYYY-MM-DD).
  // Vazio = varredura completa do órgão.
  const [vigIni, setVigIni] = useState<string>("");
  const [vigFim, setVigFim] = useState<string>("");

  const HIST_PAGE = 50;
  const [history, setHistory] = useState<HistoricoEntrada[]>([]);
  const [histHasMore, setHistHasMore] = useState(false);
  const [histLoadingMore, setHistLoadingMore] = useState(false);
  const [loadingHist, setLoadingHist] = useState(false);
  const [batch, setBatch] = useState<BatchProgress | null>(null);
  const cancelRef = useRef(false);
  const [sanitizing, setSanitizing] = useState(false);
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

  const importarDepFn = useServerFn(importarDeputados);
  const importarCEAPFn = useServerFn(importarCEAPMes);
  const importarPropsFn = useServerFn(importarProposicoes);
  const importarVotsFn = useServerFn(importarVotacoes);
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

  const ranOnce = useRef(false);
  useEffect(() => {
    if (ranOnce.current) return;
    ranOnce.current = true;
    void refreshHistory();
    void refreshVarreduras();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const limparSelecionado = async () => {
    setLimpBusy(true);
    try {
      const payload = buildLimpezaPayload({
        confirm: limpConfirm,
        fontes: limpFontes,
        usarPeriodo: limpUsarPeriodo,
        anoIni: limpAnoIni,
        anoFim: limpAnoFim,
      });
      const res = await clearFn({ data: payload as never });
      toast.success(`Apagado: ${JSON.stringify(res.removed)}`);
      setLimpConfirm("");
      await refreshHistory();
      await refreshFromDB();
      await refreshVarreduras();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLimpBusy(false);
    }
  };

  const runBatch = async (
    jobs: Array<{ cod: string; year: number; month: number; label: string; dataInicial?: string; dataFinal?: string }>,
    title: string,
    opts?: { auto?: boolean },
  ) => {
    if (batch) {
      toast.error("Já existe um lote em execução.");
      return;
    }
    // A CGU filtra contratos por VIGÊNCIA. A ingestão varre o histórico do
    // órgão (ou uma janela de vigência) e aloca cada contrato pelo mês de
    // início de vigência. Colapsamos os jobs para UMA varredura por órgão.
    const orgaosUnicos = [...new Map(jobs.map((j) => [j.cod, j])).values()];
    if (orgaosUnicos.length === 0) {
      toast.success("Nada a importar.");
      return;
    }
    // Janela de vigência (opcional) por órgão — passada à varredura (que filtra
    // por início de vigência) e reusada em cada rodada de auto-continuar.
    const janelaPorCod = new Map<string, { dataInicial?: string; dataFinal?: string }>(
      orgaosUnicos.map((j) => [j.cod, { dataInicial: j.dataInicial, dataFinal: j.dataFinal }]),
    );
    cancelRef.current = false;
    try { await supabase.auth.refreshSession(); } catch { /* tolerante */ }
    const PER_JOB_TIMEOUT_MS = 4 * 60 * 1000;
    let importados = 0;
    let erros = 0;
    let corrigidos = 0;
    let rodada = 0;
    // cods que ainda têm contratos a baixar (varredura parcial). A varredura por
    // detalhe é retomável: cada rodada continua de onde a anterior parou (estado
    // em cgu_varredura no servidor). Com auto-continuar, repetimos até completar.
    let restantes = orgaosUnicos.map((j) => j.cod);
    const ultimaPaginaPorCod = new Map<string, number>();

    do {
      rodada++;
      const codsRodada = restantes;
      restantes = [];
      for (let i = 0; i < codsRodada.length; i++) {
        if (cancelRef.current) break;
        if (i > 0 && i % 10 === 0) {
          try { await supabase.auth.refreshSession(); } catch { /* tolerante */ }
        }
        const cod = codsRodada[i];
        const o = ORGAOS_BASE.find((x) => x.cod === cod);
        const sigla = o ? o.sigla : cod;
        const janela = janelaPorCod.get(cod) ?? {};
        const temJanela = !!(janela.dataInicial && janela.dataFinal);
        const rotulo = `${sigla} (${cod}) — ${temJanela ? "vigência" : "varredura"}${opts?.auto ? ` · rodada ${rodada}` : ""}`;
        setBatch({ total: codsRodada.length, done: i, current: rotulo, importados, erros });
        try {
          const meta = await Promise.race([
            loadRealOrgao(cod, janela),
            new Promise<never>((_, reject) =>
              setTimeout(
                () => reject(new Error(`timeout após ${Math.round(PER_JOB_TIMEOUT_MS / 1000)}s`)),
                PER_JOB_TIMEOUT_MS,
              ),
            ),
          ]);
          importados += meta.importados;
          if (meta.erros.length > 0) erros += meta.erros.length;
          corrigidos += meta.varredura?.corrigidos ?? 0;
          if (meta.varredura?.haMais) {
            restantes.push(cod);
            ultimaPaginaPorCod.set(cod, meta.varredura.ultimaPagina);
          }
        } catch (e) {
          erros += 1;
          toast.error(`${rotulo}: ${(e as Error).message}`);
          // Erro num órgão não re-tenta automaticamente nesta sessão de auto.
        }
      }
      await refreshVarreduras();
    } while (opts?.auto && restantes.length > 0 && !cancelRef.current);

    if (restantes.length > 0 && !cancelRef.current && !opts?.auto) {
      const labels = restantes.map((cod) => {
        const o = ORGAOS_BASE.find((x) => x.cod === cod);
        return `${o?.sigla ?? cod} (até pág. ${ultimaPaginaPorCod.get(cod) ?? "?"})`;
      });
      toast.warning(
        `Varredura parcial — há mais contratos a baixar em: ${labels.join(", ")}. ` +
          `Clique em “Continuar” (ou ligue o auto-continuar) para baixar o restante.`,
        { duration: 10000 },
      );
    }
    setBatch({
      total: 1,
      done: 1,
      current: cancelRef.current ? "Cancelado" : "Concluído",
      importados,
      erros,
    });
    await refreshHistory();
    await refreshFromDB();
    await refreshVarreduras();
    const completa = restantes.length === 0 && !cancelRef.current;
    const partes = [`${importados} contratos`, `${erros} erros`];
    if (corrigidos > 0) partes.push(`${corrigidos} valores corrigidos`);
    if (completa) partes.push("varredura completa");
    toast.success(`${title}: ${partes.join(" · ")}`);
    setTimeout(() => setBatch(null), 4000);
  };

  const importarUnico = () => {
    const o = ORGAOS_BASE.find((x) => x.cod === orgao)!;
    // Janela de vigência opcional: quando ambas as datas estão preenchidas, a
    // varredura filtra por início de vigência; senão varre o histórico completo.
    const temJanela = !!(vigIni && vigFim);
    const janela = temJanela ? { dataInicial: vigIni, dataFinal: vigFim } : {};
    const sufixo = temJanela ? ` (vigência ${vigIni}→${vigFim})` : "";
    return runBatch(
      [{ cod: orgao, year: ano, month: mes, label: `${o.sigla} — varredura`, ...janela }],
      `${o.sigla} — ${temJanela ? "vigência" : "varredura"}${sufixo}`,
      { auto: autoContinuar },
    );
  };

  // Continua a varredura de UM órgão específico (botão do indicador de
  // progresso). Reusa a janela de vigência quando a varredura é por período.
  const continuarVarredura = (cod: string, dataInicial?: string, dataFinal?: string) => {
    const o = ORGAOS_BASE.find((x) => x.cod === cod);
    const temJanela = !!(dataInicial && dataFinal);
    return runBatch(
      [{ cod, year: ano, month: mes, label: `${o?.sigla ?? cod} — varredura`, dataInicial, dataFinal }],
      `${o?.sigla ?? cod} — continuar${temJanela ? ` vigência ${dataInicial}→${dataFinal}` : " varredura"}`,
      { auto: autoContinuar },
    );
  };

  const runJobs = async (
    jobs: Array<{ label: string; run: () => Promise<number>; noTimeout?: boolean }>,
    title: string,
    unidade = "registros",
  ) => {
    if (batch) {
      toast.error("Já existe um lote em execução.");
      return;
    }
    cancelRef.current = false;
    // Zera o cache/abort da varredura CGU para este lote (a CGU roda rodadas
    // até completar cada órgão — ver useCoberturaJobBuilder).
    resetCguSweepCache();
    try { await supabase.auth.refreshSession(); } catch { /* tolerante */ }
    setBatch({ total: jobs.length, done: 0, current: title, importados: 0, erros: 0 });
    let importados = 0;
    let erros = 0;
    let errosTransitorios = 0;
    const consecutivosPorFonte = new Map<string, number>();
    const fontesEmCircuito = new Set<string>();
    const fonteDoLabel = (label: string) => label.split(" · ")[0].trim();
    const PER_JOB_TIMEOUT_MS = 4 * 60 * 1000;
    for (let i = 0; i < jobs.length; i++) {
      if (cancelRef.current) break;
      if (i > 0 && i % 10 === 0) {
        try { await supabase.auth.refreshSession(); } catch { /* tolerante */ }
      }
      const job = jobs[i];
      const fonte = fonteDoLabel(job.label);
      if (fontesEmCircuito.has(fonte)) continue;
      setBatch({ total: jobs.length, done: i, current: job.label, importados, erros });
      try {
        // Jobs com noTimeout (CGU: roda várias rodadas até completar) gerenciam
        // o próprio timeout por rodada — não aplicar o timeout único aqui.
        importados += job.noTimeout
          ? await job.run()
          : await Promise.race<number>([
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

  // handlers diretos
  const onImportarDeputados = async () => {
    setCamaraBusy("deputados");
    try {
      const r = await importarDepFn({ data: {} });
      toast.success(`Cadastro importado: ${r.importados} deputados.`);
    } catch (e) { toast.error((e as Error).message); }
    finally { setCamaraBusy(null); }
  };
  const onImportarCEAPCamara = async () => {
    setCamaraBusy("ceap");
    try {
      const r = await importarCEAPFn({ data: { ano, mes } });
      toast.success(`CEAP ${MONTHS[mes-1]}/${ano}: ${r.importados} notas de ${r.deputadosProcessados} deputados.`);
    } catch (e) { toast.error((e as Error).message); }
    finally { setCamaraBusy(null); }
  };
  const onImportarPropsCamara = async () => {
    setCamaraBusy("props");
    try {
      const r = await importarPropsFn({ data: { ano, siglaTipo: propTipo, maxPaginas: 5 } });
      toast.success(`${propTipo}/${ano}: ${r.importados} proposições, ${r.autores} autores.`);
    } catch (e) { toast.error((e as Error).message); }
    finally { setCamaraBusy(null); }
  };
  const onImportarVotsCamara = async () => {
    setCamaraBusy("vots");
    try {
      const r = await importarVotsFn({ data: { dataInicio: votIni, dataFim: votFim, maxPaginas: 3 } });
      toast.success(`${r.votacoes} votações, ${r.votos} votos nominais.`);
    } catch (e) { toast.error((e as Error).message); }
    finally { setCamaraBusy(null); }
  };
  const onImportarSenadores = async () => {
    setSenadoBusy("sen");
    try {
      const r = await importarSenFn({ data: {} });
      toast.success(`Cadastro importado: ${r.importados} senadores.`);
    } catch (e) { toast.error((e as Error).message); }
    finally { setSenadoBusy(null); }
  };
  const onImportarCEAPSSenado = async () => {
    setSenadoBusy("ceaps");
    try {
      const r = await importarCEAPSFn({ data: { ano, mes } });
      toast.success(`CEAPS ${MONTHS[mes-1]}/${ano}: ${r.importados} notas de ${r.senadoresProcessados} senadores.`);
    } catch (e) { toast.error((e as Error).message); }
    finally { setSenadoBusy(null); }
  };
  const onImportarMatSenado = async () => {
    setSenadoBusy("mat");
    try {
      const r = await importarMatSenFn({ data: { ano, sigla: "PL" } });
      toast.success(`Matérias PL/${ano}: ${r.importados} (${r.autores} autores).`);
    } catch (e) { toast.error((e as Error).message); }
    finally { setSenadoBusy(null); }
  };
  const onImportarVotSenado = async () => {
    setSenadoBusy("vot");
    try {
      const r = monthRange(ano, mes);
      const res = await importarVotSenFn({ data: { dataInicio: r.ini, dataFim: r.fim } });
      toast.success(`Votações ${MONTHS[mes-1]}/${ano}: ${res.votacoes} sessões, ${res.votos} votos.`);
    } catch (e) { toast.error((e as Error).message); }
    finally { setSenadoBusy(null); }
  };

  const onSanitize = async () => {
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
  };

  const runJobsSinc = async (
    jobs: Array<{ label: string; run: () => Promise<number> }>,
    title: string,
    unidade?: string,
  ) => {
    await runJobs(jobs, title, unidade);
    await refreshFromDB();
  };

  const runJobsCobertura = async (jobs: CoberturaJob[], title: string) => {
    await runJobs(jobs, title);
    await refreshFromDB();
  };

  const isRunning = batch !== null && batch.done < batch.total;
  const progressPct = batch ? Math.round((batch.done / Math.max(1, batch.total)) * 100) : 0;

  return (
    <AdminImportView
      ano={ano}
      mes={mes}
      setAno={setAno}
      setMes={setMes}
      years={YEARS}
      cobertos={cobertos}
      batch={batch}
      isRunning={isRunning}
      progressPct={progressPct}
      cancelBatch={() => {
        cancelRef.current = true;
        abortCguSweep();
      }}
      orgao={orgao}
      setOrgao={setOrgao}
      importarUnico={importarUnico}
      onDiagnosticarPortal={(params) => diagFn({ data: params })}
      varredurasIncompletas={varredurasIncompletas}
      continuarVarredura={continuarVarredura}
      autoContinuar={autoContinuar}
      setAutoContinuar={setAutoContinuar}
      vigIni={vigIni}
      setVigIni={setVigIni}
      vigFim={vigFim}
      setVigFim={setVigFim}
      camaraBusy={camaraBusy}
      propTipo={propTipo}
      setPropTipo={setPropTipo}
      votIni={votIni}
      setVotIni={setVotIni}
      votFim={votFim}
      setVotFim={setVotFim}
      onImportarDeputados={onImportarDeputados}
      onImportarCEAPCamara={onImportarCEAPCamara}
      onImportarPropsCamara={onImportarPropsCamara}
      onImportarVotsCamara={onImportarVotsCamara}
      senadoBusy={senadoBusy}
      onImportarSenadores={onImportarSenadores}
      onImportarCEAPSSenado={onImportarCEAPSSenado}
      onImportarMatSenado={onImportarMatSenado}
      onImportarVotSenado={onImportarVotSenado}
      history={history}
      loadingHist={loadingHist}
      histHasMore={histHasMore}
      histLoadingMore={histLoadingMore}
      refreshHistory={refreshHistory}
      loadMoreHistory={loadMoreHistory}
      sanitizing={sanitizing}
      onSanitize={onSanitize}
      runJobsSinc={runJobsSinc}
      runJobsCobertura={runJobsCobertura}
      limpFontes={limpFontes}
      toggleFonte={toggleFonte}
      selecionarTodasFontes={() => setLimpFontes(new Set(FONTES_LIMPEZA.map((f) => f.id)))}
      limparSelecaoFontes={() => setLimpFontes(new Set())}
      limpUsarPeriodo={limpUsarPeriodo}
      setLimpUsarPeriodo={setLimpUsarPeriodo}
      limpAnoIni={limpAnoIni}
      setLimpAnoIni={setLimpAnoIni}
      limpAnoFim={limpAnoFim}
      setLimpAnoFim={setLimpAnoFim}
      limpConfirm={limpConfirm}
      setLimpConfirm={setLimpConfirm}
      limpBusy={limpBusy}
      limparSelecionado={limparSelecionado}
    />
  );
}