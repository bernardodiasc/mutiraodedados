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
import { monthRange, isMunicipio } from "@/lib/admin-entes/logic";
import { AdminEntesView } from "@/components/AdminEntesView";

export function AdminEntesContainer({ ano, mes }: { ano: number; mes: number }) {
  const pncp = useServerFn(importarContratosPNCP);
  const siconfi = useServerFn(importarRelatorioSICONFI);
  const siconfiConjunto = useServerFn(importarConjuntoSICONFI);
  const transf = useServerFn(importarConveniosTransferegov);

  const [uf, setUf] = useState("");
  const [ibge, setIbge] = useState("");
  const [tipoRel, setTipoRel] = useState<"RREO" | "RGF" | "DCA">("RREO");
  const [periodo, setPeriodo] = useState(1);
  const [exer, setExer] = useState(ano);
  const [loading, setLoading] = useState<string | null>(null);

  const { ini, fim } = monthRange(ano, mes);

  async function run(label: string, fn: () => Promise<{ importados?: number; aviso?: string }>) {
    setLoading(label);
    try {
      const r = await fn();
      toast.success(`${label}: ${r.importados ?? 0} registros${r.aviso ? ` — ${r.aviso}` : ""}`);
    } catch (e) {
      toast.error(`${label}: ${(e as Error).message}`);
    } finally {
      setLoading(null);
    }
  }

  /**
   * Varredura retomável: cada rodada é limitada por tempo e por subrequisições
   * no servidor, então repetimos até `haMais` ficar falso. Antes destas fontes
   * serem retomáveis, a UI limitava a 3 páginas por rodada — o que impedia
   * qualquer carga em massa.
   */
  async function runVarredura(
    label: string,
    fn: () => Promise<{ importados: number; varredura: { haMais: boolean } }>,
  ) {
    const MAX_RODADAS = 200;
    setLoading(label);
    try {
      let total = 0;
      let completou = false;
      for (let r = 0; r < MAX_RODADAS; r++) {
        const res = await fn();
        total += res.importados;
        if (!res.varredura.haMais) {
          completou = true;
          break;
        }
      }
      toast.success(
        `${label}: ${total} registros${completou ? "" : " (parcial — rode de novo para continuar)"}`,
      );
    } catch (e) {
      toast.error(`${label}: ${(e as Error).message}`);
    } finally {
      setLoading(null);
    }
  }

  const busy = (k: string) => loading === k;

  return (
    <AdminEntesView
      ano={ano}
      ini={ini}
      fim={fim}
      uf={uf}
      setUf={setUf}
      ibge={ibge}
      setIbge={setIbge}
      tipoRel={tipoRel}
      setTipoRel={setTipoRel}
      periodo={periodo}
      setPeriodo={setPeriodo}
      exer={exer}
      setExer={setExer}
      loading={loading}
      busy={busy}
      onImportPncp={() =>
        runVarredura("PNCP", () =>
          pncp({
            data: {
              dataInicial: ini,
              dataFinal: fim,
              uf: uf || undefined,
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
      onImportTransferegov={() =>
        runVarredura("Transferegov", () =>
          transf({
            data: {
              dataInicial: ini,
              dataFinal: fim,
              codigoIbgeMunicipio: isMunicipio(ibge) ? ibge : undefined,
            },
          }),
        )
      }
    />
  );
}
