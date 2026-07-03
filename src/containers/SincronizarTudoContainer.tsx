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
import { importarDeputados } from "@/lib/data/camara/ingest.functions";
import { importarSenadores, importarSenadoresLegislatura } from "@/lib/data/senado/ingest.functions";
import { SincronizarTudoView } from "@/components/SincronizarTudoView";

// Cadastros (roster) por legislatura — pseudo-fontes do "Sincronizar tudo".
// Não vivem na matriz de cobertura; são importados por legislatura, derivada do
// intervalo de anos (52 = 2003–2007, +1 a cada 4 anos).
const CADASTRO_CAMARA = "camara_deputados";
const CADASTRO_SENADO = "senado_senadores";
function legislaturaDoAno(ano: number): number {
  return 52 + Math.floor((ano - 2003) / 4);
}
function legislaturasNoIntervalo(yIni: number, yFim: number): number[] {
  const set = new Set<number>();
  for (let y = yIni; y <= yFim; y++) {
    const n = legislaturaDoAno(y);
    if (n >= 50) set.add(n); // as APIs de roster cobrem a partir da legislatura 50 (1995)
  }
  return [...set].sort((a, b) => a - b);
}

type Props = {
  isRunning: boolean;
  runJobs: (jobs: CoberturaJob[], title: string, unidade?: string) => Promise<void>;
};

export function SincronizarTudoContainer({ isRunning, runJobs }: Props) {
  const fetchCobertura = useServerFn(statusCobertura);
  const buildJob = useCoberturaJobBuilder();
  const importarDepFn = useServerFn(importarDeputados);
  const importarSenFn = useServerFn(importarSenadores);
  const importarSenLegFn = useServerFn(importarSenadoresLegislatura);

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
  // Inclui os cadastros (roster) como itens selecionáveis, além das fontes da matriz.
  const todasSelecionaveis = React.useMemo(
    () => [...fontesDisponiveis, CADASTRO_CAMARA, CADASTRO_SENADO],
    [fontesDisponiveis],
  );
  const [selecionadas, setSelecionadas] = React.useState<Set<string>>(new Set());
  React.useEffect(() => {
    setSelecionadas(new Set(todasSelecionaveis));
  }, [todasSelecionaveis.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps

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

      // Cadastros (roster) por legislatura derivada do intervalo de anos.
      const legs = legislaturasNoIntervalo(yIni, yFim);
      const legAtual = legislaturaDoAno(new Date().getFullYear());
      if (selecionadas.has(CADASTRO_CAMARA)) {
        for (const n of legs) {
          jobs.push(
            wrapDelay({
              label: `Câmara cadastro · leg ${n}`,
              run: async () => (await importarDepFn({ data: { idLegislatura: n } })).importados,
            }),
          );
        }
      }
      if (selecionadas.has(CADASTRO_SENADO)) {
        for (const n of legs) {
          jobs.push(
            wrapDelay({
              label: `Senado cadastro · leg ${n}`,
              // Legislatura atual: /lista/atual (roster completo); passadas: por legislatura.
              run: async () =>
                n === legAtual
                  ? (await importarSenFn({ data: {} })).importados
                  : (await importarSenLegFn({ data: { legislatura: n } })).importados,
            }),
          );
        }
      }
      return jobs;
    },
    [data, buildJob, selecionadas, importarDepFn, importarSenFn, importarSenLegFn],
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
      onSelectAll={() => setSelecionadas(new Set(todasSelecionaveis))}
      onSelectNone={() => setSelecionadas(new Set())}
      onRefresh={refresh}
      previa={previa}
      onSincronizar={sincronizar}
    />
  );
}