import * as React from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { statusCobertura, type CoberturaResult, type Fonte, type Linha } from "@/lib/data/cobertura.functions";
import { useData } from "@/lib/data-store";
import { useCoberturaJobBuilder, type CoberturaJob } from "@/lib/data/cobertura-jobs";
import {
  MESES_CURTO,
  lacunasMesesDaLinha,
  intersectarSelecionadas,
} from "@/lib/cobertura-matrix/logic";
import { CoberturaMatrixView } from "@/components/CoberturaMatrixView";

export type { CoberturaJob };

type Props = {
  isRunning: boolean;
  runJobs: (jobs: CoberturaJob[], title: string, unidade?: string) => Promise<void>;
};

function faltantesParaFonte(fonte: Fonte): Linha[] {
  return [{ id: fonte.fonte, label: fonte.titulo, celulas: [] }];
}

export function CoberturaMatrixContainer({ isRunning, runJobs }: Props) {
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

  const fonteIds = React.useMemo(() => (data?.fontes ?? []).map((f) => f.fonte), [data]);
  React.useEffect(() => {
    setSelecionadas((prev) => intersectarSelecionadas(prev, fonteIds));
  }, [fonteIds.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps

  const construirJobsLacunas = React.useCallback((fonte: Fonte): CoberturaJob[] => {
    if (fonte.fonte === "siconfi") return [];
    const jobs: CoberturaJob[] = [];
    for (const linha of fonte.linhas.length > 0 ? fonte.linhas : faltantesParaFonte(fonte)) {
      for (const m of lacunasMesesDaLinha(linha, ano)) {
        const j = buildJob(fonte.fonte, linha.id, ano, m);
        if (j) jobs.push(j);
      }
    }
    return jobs;
  }, [ano, buildJob]);

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
    const linhas = fonte.linhas;
    const jobs: CoberturaJob[] = [];
    for (const linha of linhas) {
      const j = buildJob(fonte.fonte, linha.id, ano, m);
      if (j) jobs.push(j);
    }
    if (jobs.length === 0) return;
    await runJobs(jobs, `${fonte.titulo}: ${MESES_CURTO[m - 1]}/${ano} — ${linhas.length} linhas`);
    await refresh();
  };

  // "Órgãos com dados" = os que já têm contratos em cache (a lista dinâmica que
  // substitui o antigo ORGAOS_BASE.filter). `carregados` = tamanho do catálogo
  // (orgaos_cache, populado pelo sync SIAFI).
  const comDados = React.useMemo(
    () => new Set(dataset.contratos.map((c) => c.orgaoCod)),
    [dataset.contratos],
  );
  const carregados = React.useMemo(
    () => new Set(dataset.orgaos.map((o) => o.cod)),
    [dataset.orgaos],
  );
  const totalContratado = React.useMemo(
    () => dataset.contratos.reduce((s, c) => s + c.valor, 0),
    [dataset.contratos],
  );

  return (
    <CoberturaMatrixView
      ano={ano}
      onAnoChange={setAno}
      isRunning={isRunning}
      loading={loading}
      data={data}
      fonteIds={fonteIds}
      selecionadas={selecionadas}
      onSelecionadasChange={setSelecionadas}
      onRefresh={refresh}
      cobertosLen={comDados.size}
      carregadosSize={carregados.size}
      contratosCount={dataset.contratos.length}
      totalContratado={totalContratado}
      onPreencherLacunasSelecionadas={preencherLacunasSelecionadas}
      onPreencherLacunas={preencherLacunas}
      onCelulaClick={reimportarCelula}
      onLinhaClick={reimportarLinha}
      onColunaClick={reimportarColuna}
    />
  );
}

CoberturaMatrixContainer.displayName = "CoberturaMatrixContainer";