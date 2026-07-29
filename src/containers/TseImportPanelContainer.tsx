import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  listarProgressoTse,
  sincronizarTseBens,
  sincronizarTseCandidatos,
  sincronizarTseDespesas,
  sincronizarTseReceitas,
  sincronizarTseResultados,
} from "@/lib/data/tse/ingest.functions";
import { sincronizarPonteParlamentarFn } from "@/lib/data/tse/ponte.functions";
import { rodarLacunasTse, rodarSinaisInvestigativosTse } from "@/lib/data/tse/sinais.functions";
import type { TseTipoArquivo } from "@/lib/data/tse/client-ckan";
import {
  ANOS_TSE,
  montarJobsTse,
  resumirProgresso,
  rotuloTipo,
  type JobTse,
  type ProgressoLinha,
} from "@/lib/tse-import/logic";
import { TseImportPanelView } from "@/components/TseImportPanelView";

export function TseImportPanelContainer() {
  const fns = {
    candidatos: useServerFn(sincronizarTseCandidatos),
    bens: useServerFn(sincronizarTseBens),
    resultados: useServerFn(sincronizarTseResultados),
    receitas: useServerFn(sincronizarTseReceitas),
    despesas: useServerFn(sincronizarTseDespesas),
  } as const;
  const progressoFn = useServerFn(listarProgressoTse);
  const ponteFn = useServerFn(sincronizarPonteParlamentarFn);
  const [ponteBusy, setPonteBusy] = useState<"camara" | "senado" | null>(null);
  const lacunasFn = useServerFn(rodarLacunasTse);
  const investigativosFn = useServerFn(rodarSinaisInvestigativosTse);
  const [sinaisBusy, setSinaisBusy] = useState<"investigativos" | "lacunas" | null>(null);

  const [tipo, setTipo] = useState<TseTipoArquivo>("candidatos");
  const [ano, setAno] = useState<number>(ANOS_TSE[0]);
  const [uf, setUf] = useState<string>("TODAS");
  const [autoContinuar, setAutoContinuar] = useState(true);
  const [busy, setBusy] = useState(false);
  const [statusAtual, setStatusAtual] = useState<string | null>(null);
  const [progresso, setProgresso] = useState<ProgressoLinha[]>([]);
  const [carregandoProgresso, setCarregandoProgresso] = useState(false);
  const cancelRef = useRef(false);

  const atualizarProgresso = async () => {
    setCarregandoProgresso(true);
    try {
      setProgresso(await progressoFn());
    } catch {
      /* tolerante — painel de progresso é informativo */
    } finally {
      setCarregandoProgresso(false);
    }
  };

  const ranOnce = useRef(false);
  useEffect(() => {
    if (ranOnce.current) return;
    ranOnce.current = true;
    void atualizarProgresso();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rodarJobs = async (jobs: JobTse[]) => {
    if (busy || jobs.length === 0) return;
    cancelRef.current = false;
    setBusy(true);
    let importados = 0;
    let erros = 0;
    try {
      await supabase.auth.refreshSession();
    } catch {
      /* tolerante */
    }
    try {
      for (let i = 0; i < jobs.length; i++) {
        const job = jobs[i];
        let rodada = 0;
        // Auto-continuar: repete o MESMO job enquanto houver mais linhas
        // (arquivos grandes são retomáveis por contagem de linhas).
        do {
          if (cancelRef.current) break;
          rodada++;
          setStatusAtual(
            `${rotuloTipo(job.tipo)} ${job.ano}/${job.uf} (${i + 1}/${jobs.length}${rodada > 1 ? ` · rodada ${rodada}` : ""})`,
          );
          const res = await fns[job.tipo]({ data: { ano: job.ano, uf: job.uf } });
          importados += res.importados;
          if (res.erros.length > 0) {
            erros += res.erros.length;
            const graves = res.erros.filter((e: string) => !e.startsWith("info:"));
            if (graves.length > 0) toast.error(`${job.ano}/${job.uf}: ${graves[0]}`);
          }
          if (!res.haMais) break;
          if (!autoContinuar) {
            toast.warning(
              `${rotuloTipo(job.tipo)} ${job.ano}/${job.uf}: rodada parcial — ligue o auto-continuar ou clique em "Continuar pendentes".`,
            );
            break;
          }
        } while (!cancelRef.current);
        if (cancelRef.current) break;
        if (i % 5 === 4) {
          try {
            await supabase.auth.refreshSession();
          } catch {
            /* tolerante */
          }
        }
      }
      toast.success(
        `${rotuloTipo(jobs[0].tipo)}: ${importados} registros importados${erros > 0 ? ` · ${erros} avisos/erros` : ""}${cancelRef.current ? " (cancelado)" : ""}`,
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
      setStatusAtual(null);
      await atualizarProgresso();
    }
  };

  const sincronizarPonte = async (casa: "camara" | "senado") => {
    if (ponteBusy) return;
    setPonteBusy(casa);
    let processados = 0;
    let vinculados = 0;
    let baixaConfianca = 0;
    try {
      let offset = 0;
      // Loop de lotes até percorrer todos os parlamentares da casa.
      for (;;) {
        const r = await ponteFn({ data: { casa, offset } });
        processados += r.processados;
        vinculados += r.vinculados;
        baixaConfianca += r.baixaConfianca;
        if (r.proximoOffset == null) break;
        offset = r.proximoOffset;
      }
      toast.success(
        `Ponte ${casa === "camara" ? "Câmara" : "Senado"}: ${processados} parlamentares, ${vinculados} candidaturas vinculadas${baixaConfianca > 0 ? ` · ${baixaConfianca} p/ revisão` : ""}.`,
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPonteBusy(null);
    }
  };

  const rodarSinais = async (grupo: "investigativos" | "lacunas") => {
    if (sinaisBusy) return;
    setSinaisBusy(grupo);
    try {
      const { resultados } =
        grupo === "lacunas"
          ? await lacunasFn({ data: { ano } })
          : await investigativosFn({ data: { ano } });
      const total = resultados.reduce((s, r) => s + r.findingsGerados, 0);
      const avisos = resultados.flatMap((r) => r.avisos).filter((a) => !a.startsWith("info:"));
      toast.success(
        `Sinais (${grupo}): ${total} finding(s) novos — ${resultados
          .map((r) => `${r.regra}: ${r.findingsGerados}`)
          .join(" · ")}`,
      );
      for (const a of avisos.slice(0, 2)) toast.warning(a);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSinaisBusy(null);
    }
  };

  return (
    <TseImportPanelView
      tipo={tipo}
      ano={ano}
      uf={uf}
      autoContinuar={autoContinuar}
      busy={busy}
      statusAtual={statusAtual}
      progresso={resumirProgresso(progresso)}
      carregandoProgresso={carregandoProgresso}
      ponteBusy={ponteBusy}
      onSincronizarPonte={(casa) => void sincronizarPonte(casa)}
      sinaisBusy={sinaisBusy}
      onRodarSinais={(grupo) => void rodarSinais(grupo)}
      onAlterar={(patch) => {
        if (patch.tipo !== undefined) setTipo(patch.tipo);
        if (patch.ano !== undefined) setAno(patch.ano);
        if (patch.uf !== undefined) setUf(patch.uf);
        if (patch.autoContinuar !== undefined) setAutoContinuar(patch.autoContinuar);
      }}
      onImportar={() => void rodarJobs(montarJobsTse({ tipo, ano, uf }))}
      onCancelar={() => {
        cancelRef.current = true;
      }}
      onAtualizarProgresso={() => void atualizarProgresso()}
      onContinuarPendentes={(t, a, ufs) =>
        void rodarJobs(ufs.map((u) => ({ tipo: t, ano: a, uf: u })))
      }
    />
  );
}
TseImportPanelContainer.displayName = "TseImportPanelContainer";
