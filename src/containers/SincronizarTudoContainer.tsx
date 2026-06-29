import * as React from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { statusCobertura, type CoberturaResult, type Fonte } from "@/lib/data/cobertura.functions";
import {
  useCoberturaJobBuilder,
  GRUPOS_FONTES,
  type CoberturaJob,
} from "@/lib/data/cobertura-jobs";
import {
  buildTriedSet,
  resolveLinhasIds,
  isFutureSlot,
  countByLabelPrefix,
} from "@/lib/sincronizar-tudo/logic";
import { SincronizarTudoView } from "@/components/SincronizarTudoView";

type Props = {
  isRunning: boolean;
  runJobs: (jobs: CoberturaJob[], title: string, unidade?: string) => Promise<void>;
};

export function SincronizarTudoContainer({ isRunning, runJobs }: Props) {
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

  const construirJobs = React.useCallback(
    (yIni: number, yFim: number, delayMs: number) => {
      if (!data) return [] as CoberturaJob[];
      const jobs: CoberturaJob[] = [];
      const tried = buildTriedSet(data);
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
          if (f.fonte === "cgu") continue; // CGU é por órgão, não por mês/ano
          if (!selecionadas.has(f.fonte)) continue;
          const linhasIds = resolveLinhasIds(f);
          for (const lid of linhasIds) {
            for (let m = 1; m <= 12; m++) {
              if (tried.has(`${f.fonte}|${lid}|${y}|${m}`)) continue;
              const j = buildJob(f.fonte, lid, y, m);
              if (j) jobs.push(wrapDelay(j));
            }
          }
        }
      }
      // CGU: a API filtra por VIGÊNCIA. O intervalo de anos selecionado vira a
      // janela de vigência [yIni-01-01, yFim-12-31] — a varredura traz só os
      // contratos com início de vigência no período (mesma dimensão da
      // cobertura) e roda rodadas até completar cada órgão (auto-continuar).
      const cguFonte = data.fontes.find((f) => f.fonte === "cgu");
      if (cguFonte && selecionadas.has("cgu")) {
        const janela = { dataInicial: `${yIni}-01-01`, dataFinal: `${yFim}-12-31` };
        for (const lid of resolveLinhasIds(cguFonte)) {
          const j = buildJob("cgu", lid, yFim, 1, janela);
          if (j) jobs.push(wrapDelay(j));
        }
      }
      return jobs;
    },
    [data, buildJob, selecionadas],
  );

  const previa = React.useMemo(() => {
    const jobs = construirJobs(syncIni, syncFim, 0);
    const porFonte = countByLabelPrefix(jobs.map((j) => j.label));
    let totalPossivel = 0;
    if (data) {
      const now = new Date();
      for (let y = syncIni; y <= syncFim; y++) {
        for (const f of data.fontes) {
          if (f.fonte === "siconfi") continue;
          if (f.fonte === "cgu") continue; // contado à parte (1 por órgão)
          if (!selecionadas.has(f.fonte)) continue;
          const linhasIds = resolveLinhasIds(f);
          for (let _i = 0; _i < linhasIds.length; _i++) {
            for (let m = 1; m <= 12; m++) {
              const j = buildJob(f.fonte, linhasIds[_i], y, m);
              if (!j) continue;
              if (isFutureSlot({ fonte: f.fonte, linhaId: linhasIds[_i], ano: y, mes: m }, now)) continue;
              totalPossivel += 1;
            }
          }
        }
      }
      const cguFonte = data.fontes.find((f) => f.fonte === "cgu");
      if (cguFonte && selecionadas.has("cgu")) {
        totalPossivel += resolveLinhasIds(cguFonte).length; // 1 varredura por órgão
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
    <SincronizarTudoView
      isRunning={isRunning}
      loading={loading}
      data={data}
      anoAtual={ANO_ATUAL}
      syncIni={syncIni}
      syncFim={syncFim}
      syncDelayMs={syncDelayMs}
      onChangeIni={setSyncIni}
      onChangeFim={setSyncFim}
      onChangeDelay={setSyncDelayMs}
      fontesDisponiveis={fontesDisponiveis}
      selecionadas={selecionadas}
      onToggleFonte={toggleFonte}
      onToggleGrupo={toggleGrupo}
      onSelectAll={() => setSelecionadas(new Set(fontesDisponiveis))}
      onSelectNone={() => setSelecionadas(new Set())}
      onRefresh={refresh}
      previa={previa}
      onSincronizar={sincronizar}
    />
  );
}