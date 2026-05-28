import * as React from "react";
import { useServerFn } from "@tanstack/react-start";
import type { DataSource } from "./data/types";
import {
  emptyDataset,
  makeDataSource,
  mergeDatasets,
  type Dataset,
} from "./data/source";
import { fetchPortalOrgao, loadStoredDataset } from "./data/real/portal.functions";

export type RealLoadMeta = {
  totalBruto: number;
  importados: number;
  erros: string[];
  fonte: string;
  consultadoEm: string;
};

type LoadOpts = { dataInicial: string; dataFinal: string };

type Ctx = {
  dataset: Dataset;
  hydrated: boolean;
  loadRealOrgao: (cod: string, opts: LoadOpts) => Promise<RealLoadMeta>;
  refreshFromDB: () => Promise<void>;
  clearData: () => void;
  realLoading: Record<string, boolean>;
  realError: string | null;
  lastRealLoad: RealLoadMeta | null;
};

const DataCtx = React.createContext<Ctx | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [dataset, setDataset] = React.useState<Dataset>(emptyDataset);
  const [hydrated, setHydrated] = React.useState(false);
  const [realLoading, setRealLoading] = React.useState<Record<string, boolean>>({});
  const [realError, setRealError] = React.useState<string | null>(null);
  const [lastRealLoad, setLastRealLoad] = React.useState<RealLoadMeta | null>(null);
  const fetchPortalOrgaoFn = useServerFn(fetchPortalOrgao);
  const loadStoredFn = useServerFn(loadStoredDataset);

  const refreshFromDB = React.useCallback(async () => {
    try {
      const stored = await loadStoredFn();
      setDataset(stored);
      setHydrated(true);
    } catch {
      setHydrated(true);
    }
  }, [loadStoredFn]);

  React.useEffect(() => {
    void refreshFromDB();
  }, [refreshFromDB]);

  const loadRealOrgao = React.useCallback<Ctx["loadRealOrgao"]>(
    async (cod, opts) => {
      setRealError(null);
      setRealLoading((s) => ({ ...s, [cod]: true }));
      try {
        const res = await fetchPortalOrgaoFn({
          data: { codigoOrgao: cod, dataInicial: opts.dataInicial, dataFinal: opts.dataFinal, maxPaginas: 10 },
        });
        setDataset((d) =>
          mergeDatasets(d, {
            orgaos: res.orgaos,
            fornecedores: res.fornecedores,
            contratos: res.contratos,
          }),
        );
        const meta: RealLoadMeta = {
          totalBruto: res.meta.totalBruto,
          importados: res.meta.importados,
          erros: res.meta.erros,
          fonte: res.meta.fonte,
          consultadoEm: res.meta.consultadoEm,
        };
        setLastRealLoad(meta);
        return meta;
      } catch (e) {
        const msg = (e as Error).message || "Falha ao consultar o Portal.";
        setRealError(msg);
        throw e;
      } finally {
        setRealLoading((s) => ({ ...s, [cod]: false }));
      }
    },
    [fetchPortalOrgaoFn],
  );

  const clearData = React.useCallback(() => {
    setDataset(emptyDataset());
    setRealError(null);
    setLastRealLoad(null);
  }, []);

  const value = React.useMemo<Ctx>(
    () => ({ dataset, hydrated, loadRealOrgao, refreshFromDB, clearData, realLoading, realError, lastRealLoad }),
    [dataset, hydrated, loadRealOrgao, refreshFromDB, clearData, realLoading, realError, lastRealLoad],
  );

  return <DataCtx.Provider value={value}>{children}</DataCtx.Provider>;
}

export function useData(): Ctx {
  const ctx = React.useContext(DataCtx);
  if (!ctx) throw new Error("useData precisa estar dentro de <DataProvider>");
  return ctx;
}

export function useDataSource(): DataSource {
  const { dataset } = useData();
  return React.useMemo(() => makeDataSource(dataset), [dataset]);
}
