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
        run("PNCP", () =>
          pncp({
            data: {
              dataInicial: ini,
              dataFinal: fim,
              uf: uf || undefined,
              maxPaginas: 3,
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
        run("Transferegov", () =>
          transf({
            data: {
              dataInicial: ini,
              dataFinal: fim,
              codigoIbgeMunicipio: isMunicipio(ibge) ? ibge : undefined,
              maxPaginas: 3,
            },
          }),
        )
      }
    />
  );
}
