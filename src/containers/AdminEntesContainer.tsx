import * as React from "react";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { importarContratosPNCP } from "@/lib/data/pncp/ingest.functions";
import {
  importarRelatorioSICONFI,
  importarConjuntoSICONFI,
} from "@/lib/data/siconfi/ingest.functions";
import { importarConveniosTransferegov } from "@/lib/data/transferegov/ingest.functions";
import { importarMunicipiosIBGE } from "@/lib/data/ibge/ingest.functions";
import { varrerSiconfi } from "@/lib/data/siconfi/ingest.functions";
import type { ConjuntoSiconfi } from "@/lib/data/siconfi/varredura";
import {
  monthRange,
  percentualVarredura,
  periodoFiscalDoMes,
  escopoDoEnte,
  rodadaEsteril,
  paradaPorOrigem,
} from "@/lib/admin-entes/logic";
import {
  AdminEntesView,
  type ProgressoVarredura,
  type ProgressoFonte,
} from "@/components/AdminEntesView";

export function AdminEntesContainer({
  ano,
  mes,
  setAno,
  setMes,
  anos,
  meses,
}: {
  ano: number;
  mes: number;
  setAno: (n: number) => void;
  setMes: (n: number) => void;
  anos: readonly number[];
  meses: readonly string[];
}) {
  const pncp = useServerFn(importarContratosPNCP);
  const siconfi = useServerFn(importarRelatorioSICONFI);
  const siconfiConjunto = useServerFn(importarConjuntoSICONFI);
  const transf = useServerFn(importarConveniosTransferegov);
  const ibgeMunicipios = useServerFn(importarMunicipiosIBGE);
  const varrer = useServerFn(varrerSiconfi);

  const [ibge, setIbge] = useState("");
  const [tipoRel, setTipoRel] = useState<"RREO" | "RGF" | "DCA">("RREO");
  const [exer, setExer] = useState(ano);
  // Uma fonte ocupada não pode bloquear as outras: o que trava enquanto algo
  // roda é só o CONTEXTO (ente e período), porque mudá-lo no meio faria a
  // rodada seguinte pedir outra coisa à origem.
  const [rodando, setRodando] = useState<readonly string[]>([]);
  const [progressoFontes, setProgressoFontes] = useState<Record<string, ProgressoFonte>>({});
  const [conjunto, setConjunto] = useState<ConjuntoSiconfi>("ufs");
  const [ufVarredura, setUfVarredura] = useState("");
  const [exIni, setExIni] = useState(2013);
  const [exFim, setExFim] = useState(ano);
  const [progresso, setProgresso] = useState<ProgressoVarredura>(null);
  const cancelados = React.useRef<Set<string>>(new Set());

  const iniciar = (label: string) => {
    cancelados.current.delete(label);
    setRodando((r) => (r.includes(label) ? r : [...r, label]));
  };
  const terminar = (label: string) => setRodando((r) => r.filter((x) => x !== label));

  const { ini, fim } = monthRange(ano, mes);
  // O RREO é bimestral e o RGF quadrimestral: o mês escolhido no topo já
  // determina os dois. Pedir o período de novo era redundante.
  const periodo = periodoFiscalDoMes(mes, tipoRel) ?? 1;
  const escopo = escopoDoEnte(ibge);

  async function run(label: string, fn: () => Promise<{ importados?: number; aviso?: string }>) {
    iniciar(label);
    try {
      const r = await fn();
      toast.success(`${label}: ${r.importados ?? 0} registros${r.aviso ? ` — ${r.aviso}` : ""}`);
    } catch (e) {
      toast.error(`${label}: ${(e as Error).message}`);
    } finally {
      terminar(label);
    }
  }

  /**
   * Varredura retomável: cada rodada é limitada por tempo e por subrequisições
   * no servidor, então repetimos até `haMais` ficar falso. Antes destas fontes
   * serem retomáveis, a UI limitava a 3 páginas por rodada — o que impedia
   * qualquer carga em massa.
   *
   * O laço também vigia rodadas **estéreis** (zero importados + erro). Erro
   * passageiro não avança o cursor de propósito, para a próxima rodada refazer
   * o item; sem essa vigilância, uma origem fora do ar fazia o laço repetir a
   * mesma falha até 200 vezes — o botão do PNCP girou por horas contra um 504.
   */
  async function runVarredura(
    label: string,
    fn: () => Promise<{
      importados: number;
      erros?: string[];
      varredura: { haMais: boolean; cursor: number; totalAcumulado: number };
    }>,
  ) {
    const MAX_RODADAS = 200;
    iniciar(label);
    setProgressoFontes((p) => ({ ...p, [label]: null }));
    try {
      let total = 0;
      let esterisSeguidas = 0;
      let completou = false;
      let travou: string | null = null;

      for (let r = 0; r < MAX_RODADAS; r++) {
        if (cancelados.current.has(label)) break;
        const res = await fn();
        total += res.importados;
        const ultimoErro = res.erros?.[res.erros.length - 1];

        esterisSeguidas = rodadaEsteril(res.importados, res.erros) ? esterisSeguidas + 1 : 0;

        setProgressoFontes((p) => ({
          ...p,
          [label]: {
            rodada: r + 1,
            importados: total,
            cursor: res.varredura.cursor,
            erro: ultimoErro ?? null,
          },
        }));

        travou = paradaPorOrigem(esterisSeguidas, ultimoErro);
        if (travou) break;
        if (!res.varredura.haMais) {
          completou = true;
          break;
        }
      }

      if (travou) {
        toast.error(`${label}: ${travou}`, { duration: 12000 });
      } else if (cancelados.current.has(label)) {
        toast.success(`${label}: parado — ${total} registros. Rode de novo para continuar.`);
      } else {
        toast.success(
          `${label}: ${total} registros${completou ? "" : " (parcial — rode de novo para continuar)"}`,
        );
      }
    } catch (e) {
      toast.error(`${label}: ${(e as Error).message}`);
    } finally {
      terminar(label);
    }
  }

  /**
   * Varredura em massa do SICONFI. Cada rodada do servidor é limitada por
   * tempo e por subrequisições; aqui repetimos até `haMais` ficar falso,
   * mostrando o progresso e permitindo parar entre rodadas.
   */
  async function onVarrerSiconfi() {
    const MAX_RODADAS = 5000;
    const label = "Varredura SICONFI";
    iniciar(label);
    setProgresso(null);
    let importados = 0;
    let semDados = 0;
    let completou = false;
    try {
      for (let r = 0; r < MAX_RODADAS; r++) {
        if (cancelados.current.has(label)) break;
        const res = await varrer({
          data: {
            conjunto,
            exercicioInicial: exIni,
            exercicioFinal: exFim,
            ...(conjunto === "municipios" ? { uf: ufVarredura } : {}),
            ...(conjunto === "ente" ? { codIbge: ibge } : {}),
          },
        });
        importados += res.importados;
        semDados += res.semDados;
        setProgresso({
          consultas: res.varredura.cursor,
          total: res.totalConsultas,
          percentual: percentualVarredura(res.varredura.cursor, res.totalConsultas),
          importados,
          semDados,
        });
        if (!res.varredura.haMais) {
          completou = true;
          break;
        }
      }
      const fim = cancelados.current.has(label)
        ? "parada — clique em Iniciar para retomar de onde parou"
        : completou
          ? "concluída"
          : "parcial — clique em Iniciar para continuar";
      toast.success(
        `Varredura SICONFI ${fim}: ${importados.toLocaleString("pt-BR")} linhas · ${semDados.toLocaleString("pt-BR")} consultas sem dados`,
      );
    } catch (e) {
      toast.error(`Varredura SICONFI: ${(e as Error).message}`);
    } finally {
      terminar(label);
    }
  }

  const busy = (k: string) => rodando.includes(k);
  const ocupado = rodando.length > 0;

  return (
    <AdminEntesView
      ano={ano}
      mes={mes}
      setAno={setAno}
      setMes={setMes}
      anos={anos}
      meses={meses}
      ini={ini}
      fim={fim}
      ibge={ibge}
      setIbge={setIbge}
      tipoRel={tipoRel}
      setTipoRel={setTipoRel}
      periodo={periodo}
      exer={exer}
      setExer={setExer}
      ocupado={ocupado}
      busy={busy}
      progressoFontes={progressoFontes}
      onCancelarFonte={(label) => {
        cancelados.current.add(label);
      }}
      onImportPncp={() =>
        runVarredura("PNCP", () =>
          pncp({
            data: {
              dataInicial: ini,
              dataFinal: fim,
              // Mesmo ente das demais fontes: UF pela sigla, município pelo IBGE.
              uf: escopo.tipo === "uf" ? escopo.sigla || undefined : undefined,
              municipioIbge: escopo.tipo === "municipio" ? escopo.codigoIbge : undefined,
            },
          }),
        )
      }
      onImportSiconfi={() =>
        run("SICONFI", () =>
          siconfi({
            data: {
              codIbge: ibge,
              exercicio: exer,
              periodo: tipoRel === "DCA" ? undefined : periodo,
              tipoRelatorio: tipoRel,
            },
          }),
        )
      }
      onImportSiconfiConjunto={() =>
        run("SICONFI conjunto", () =>
          siconfiConjunto({
            data: {
              codIbge: ibge,
              exercicio: exer,
            },
          }),
        )
      }
      conjunto={conjunto}
      setConjunto={setConjunto}
      ufVarredura={ufVarredura}
      setUfVarredura={setUfVarredura}
      exIni={exIni}
      setExIni={setExIni}
      exFim={exFim}
      setExFim={setExFim}
      progresso={progresso}
      onVarrerSiconfi={onVarrerSiconfi}
      onCancelarVarredura={() => {
        cancelados.current.add("Varredura SICONFI");
      }}
      onImportIbge={() => runVarredura("IBGE", () => ibgeMunicipios({ data: {} }))}
      onImportTransferegov={() =>
        runVarredura("Transferegov", () =>
          transf({
            data: {
              dataInicial: ini,
              dataFinal: fim,
              codigoIbgeMunicipio: escopo.tipo === "municipio" ? escopo.codigoIbge : undefined,
              // A API da CGU aceita o código IBGE da UF — a tela só nunca
              // passava, o que fazia um estado selecionado trazer o país todo.
              codigoUF: escopo.tipo === "uf" ? escopo.codigoIbge : undefined,
            },
          }),
        )
      }
    />
  );
}
