import type {
  Contrato,
  DataSource,
  Fornecedor,
  Orgao,
  SerieAnual,
} from "./types";
import { detectarAnomalias } from "../anomalias";

export type Dataset = {
  orgaos: Orgao[];
  fornecedores: Fornecedor[];
  contratos: Contrato[];
};

export function emptyDataset(): Dataset {
  return { orgaos: [], fornecedores: [], contratos: [] };
}

export function mergeDatasets(a: Dataset, b: Dataset): Dataset {
  const orgaos = [...a.orgaos];
  for (const o of b.orgaos) if (!orgaos.find((x) => x.cod === o.cod)) orgaos.push(o);
  const fornecedores = [...a.fornecedores];
  for (const f of b.fornecedores)
    if (!fornecedores.find((x) => x.cnpj === f.cnpj)) fornecedores.push(f);
  const contratos = [...a.contratos];
  const ids = new Set(contratos.map((c) => c.id));
  for (const c of b.contratos) if (!ids.has(c.id)) contratos.push(c);
  return { orgaos, fornecedores, contratos };
}

export function makeDataSource(ds: Dataset): DataSource {
  const serie = (filtro: (c: Contrato) => boolean): SerieAnual[] => {
    const map = new Map<number, number>();
    for (const c of ds.contratos)
      if (filtro(c)) map.set(c.ano, (map.get(c.ano) ?? 0) + c.valor);
    return [...map.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([ano, valor]) => ({ ano, valor }));
  };

  return {
    isReady: () => ds.contratos.length > 0,
    listOrgaos: () => ds.orgaos,
    getOrgao: (cod) => ds.orgaos.find((o) => o.cod === cod) ?? null,
    serieAnualOrgao: (cod) => serie((c) => c.orgaoCod === cod),
    contratosOrgao: (cod) => ds.contratos.filter((c) => c.orgaoCod === cod),
    getFornecedor: (cnpj) => ds.fornecedores.find((f) => f.cnpj === cnpj) ?? null,
    contratosFornecedor: (cnpj) => ds.contratos.filter((c) => c.fornecedorCnpj === cnpj),
    serieAnualFornecedor: (cnpj) => serie((c) => c.fornecedorCnpj === cnpj),
    getContrato: (id) => ds.contratos.find((c) => c.id === id) ?? null,
    listAnomalias: () => detectarAnomalias(ds),
  };
}