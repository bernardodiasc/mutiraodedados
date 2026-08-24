import { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listarCandidatosTse } from "@/lib/data/tse/queries.functions";
import { TSE_ANOS_ELEICAO, TSE_UFS } from "@/lib/data/tse/client-ckan";
import { deriveEstado, paraItens } from "@/lib/candidatos-lista/logic";
import { CandidatosListaView } from "@/components/CandidatosListaView";
import { ITENS_PADRAO, offsetDaPagina, type OpcaoOrdem } from "@/lib/listagem/logic";

const ANOS = [...TSE_ANOS_ELEICAO].sort((a, b) => b - a);
const UFS = TSE_UFS.filter((u) => u !== "BR");

export const CANDIDATOS_ORDENS: OpcaoOrdem[] = [
  { valor: "nome-asc", label: "Nome (A→Z)" },
  { valor: "nome-desc", label: "Nome (Z→A)" },
  { valor: "bens-desc", label: "Maior patrimônio declarado" },
  { valor: "bens-asc", label: "Menor patrimônio declarado" },
];
export const CANDIDATOS_ORDEM_PADRAO = "nome-asc";

export type CandidatosListaSearch = {
  ano?: number;
  uf?: string;
  cargo?: number;
  partido?: string;
  q?: string;
  pagina?: number;
  itens?: number;
  ordem?: string;
};

export function CandidatosListaContainer({
  search,
  onSearchChange,
}: {
  search: CandidatosListaSearch;
  onSearchChange: (next: CandidatosListaSearch) => void;
}) {
  const listarFn = useServerFn(listarCandidatosTse);
  const ano = search.ano ?? ANOS[0];
  const uf = search.uf ?? "";
  const partido = search.partido ?? "";
  const q = search.q ?? "";
  const pagina = search.pagina ?? 1;
  const itens = search.itens ?? ITENS_PADRAO;
  const ordem = search.ordem ?? CANDIDATOS_ORDEM_PADRAO;
  // debounce simples do campo de busca (o estado imediato fica local)
  const [qLocal, setQLocal] = useState(q);

  const { data, isLoading, error } = useQuery({
    queryKey: [
      "tse",
      "candidatos",
      ano,
      uf,
      search.cargo ?? null,
      partido,
      q,
      ordem,
      pagina,
      itens,
    ],
    placeholderData: keepPreviousData,
    queryFn: () =>
      listarFn({
        data: {
          ano,
          uf: uf || undefined,
          cargoCod: search.cargo,
          partido: partido || undefined,
          q: q || undefined,
          ordem: ordem as "nome-asc",
          limit: itens,
          offset: offsetDaPagina(pagina, itens),
        },
      }),
  });

  const itensLista = useMemo(() => paraItens(data?.rows ?? []), [data]);
  const total = data?.total ?? 0;
  const estado = deriveEstado({
    carregando: isLoading,
    temErro: !!error,
    temDados: itensLista.length > 0,
  });

  // Mudar filtro/ordenação/itens volta para a página 1.
  const aplicar = (patch: Partial<CandidatosListaSearch>) =>
    onSearchChange({ ...search, ...patch, pagina: undefined });

  const montarSearch = (p: number): Record<string, unknown> => ({
    ...search,
    pagina: p > 1 ? p : undefined,
  });

  return (
    <CandidatosListaView
      estado={estado}
      itens={itensLista}
      total={total}
      filtros={{ ano, anos: ANOS, uf, ufs: [...UFS], partido, q: qLocal }}
      ordem={ordem}
      ordens={CANDIDATOS_ORDENS}
      pagina={pagina}
      itensPorPagina={itens}
      montarSearch={montarSearch}
      onAlterarFiltro={(patch) => {
        if (patch.q !== undefined) {
          setQLocal(patch.q);
          // atualiza a URL só quando o usuário para de digitar (campo curto: no blur do debounce simples)
          if (patch.q.length === 0 || patch.q.length >= 3) {
            aplicar({ q: patch.q || undefined });
          }
          return;
        }
        if (patch.ordem !== undefined) {
          aplicar({ ordem: patch.ordem !== CANDIDATOS_ORDEM_PADRAO ? patch.ordem : undefined });
          return;
        }
        if (patch.itensPorPagina !== undefined) {
          aplicar({
            itens: patch.itensPorPagina !== ITENS_PADRAO ? patch.itensPorPagina : undefined,
          });
          return;
        }
        aplicar({
          ano: patch.ano ?? search.ano,
          uf: patch.uf !== undefined ? patch.uf || undefined : search.uf,
          partido:
            patch.partido !== undefined ? patch.partido.toUpperCase() || undefined : search.partido,
        });
      }}
    />
  );
}
CandidatosListaContainer.displayName = "CandidatosListaContainer";
