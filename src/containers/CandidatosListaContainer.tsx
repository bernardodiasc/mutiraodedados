import { useMemo, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listarCandidatosTse } from "@/lib/data/tse/queries.functions";
import { TSE_ANOS_ELEICAO, TSE_UFS } from "@/lib/data/tse/client-ckan";
import { deriveEstado, paraItens } from "@/lib/candidatos-lista/logic";
import { CandidatosListaView } from "@/components/CandidatosListaView";

const PAGE = 40;
const ANOS = [...TSE_ANOS_ELEICAO].sort((a, b) => b - a);
const UFS = TSE_UFS.filter((u) => u !== "BR");

export type CandidatosListaSearch = {
  ano?: number;
  uf?: string;
  cargo?: number;
  q?: string;
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
  const q = search.q ?? "";
  // debounce simples do campo de busca (o estado imediato fica local)
  const [qLocal, setQLocal] = useState(q);

  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: ["tse", "candidatos", ano, uf, search.cargo ?? null, q],
      queryFn: ({ pageParam }) =>
        listarFn({
          data: {
            ano,
            uf: uf || undefined,
            cargoCod: search.cargo,
            q: q || undefined,
            limit: PAGE,
            offset: pageParam,
          },
        }),
      initialPageParam: 0,
      getNextPageParam: (last, pages) => {
        const carregados = pages.reduce((s, p) => s + p.rows.length, 0);
        return carregados < last.total ? carregados : undefined;
      },
    });

  const itens = useMemo(() => paraItens((data?.pages ?? []).flatMap((p) => p.rows)), [data]);
  const total = data?.pages[0]?.total ?? 0;
  const estado = deriveEstado({
    carregando: isLoading,
    temErro: !!error,
    temDados: itens.length > 0,
  });

  return (
    <CandidatosListaView
      estado={estado}
      itens={itens}
      total={total}
      filtros={{ ano, anos: ANOS, uf, ufs: [...UFS], q: qLocal }}
      onAlterarFiltro={(patch) => {
        if (patch.q !== undefined) {
          setQLocal(patch.q);
          // atualiza a URL só quando o usuário para de digitar (campo curto: no blur do debounce simples)
          if (patch.q.length === 0 || patch.q.length >= 3) {
            onSearchChange({ ...search, q: patch.q || undefined });
          }
          return;
        }
        onSearchChange({
          ...search,
          ano: patch.ano ?? search.ano,
          uf: patch.uf !== undefined ? patch.uf || undefined : search.uf,
        });
      }}
      onCarregarMais={() => void fetchNextPage()}
      temMais={!!hasNextPage}
      carregandoMais={isFetchingNextPage}
    />
  );
}
CandidatosListaContainer.displayName = "CandidatosListaContainer";
