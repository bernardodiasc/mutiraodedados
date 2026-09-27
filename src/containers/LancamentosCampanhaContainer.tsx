import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { lancamentosDaCandidatura } from "@/lib/data/tse/queries.functions";
import type { TipoLancamento } from "@/lib/contas-campanha/logic";
import { useRolarAteAncora } from "@/hooks/use-rolar-ate-ancora";
import { LancamentosCampanhaView } from "@/components/LancamentosCampanhaView";

/**
 * Receitas ou despesas de uma candidatura, uma linha por lançamento, na ficha.
 * `foco` é o id que veio no link da busca: a primeira página pedida é a que
 * contém esse lançamento, e a lista rola até a linha.
 */
export function LancamentosCampanhaContainer({
  sq,
  ano,
  tipo,
  foco,
}: {
  sq: string;
  ano: number;
  tipo: TipoLancamento;
  foco?: string;
}) {
  const fn = useServerFn(lancamentosDaCandidatura);
  // null = ainda não mexeu: o servidor escolhe a página (a do foco, ou a 1ª).
  const [pagina, setPagina] = useState<number | null>(null);
  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["tse", "lancamentos", sq, ano, tipo, pagina, foco],
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    queryFn: () => fn({ data: { sq, ano, tipo, pagina: pagina ?? undefined, foco } }),
  });
  useRolarAteAncora(!!foco && !!data);

  return (
    <LancamentosCampanhaView
      tipo={tipo}
      ano={ano}
      carregando={isLoading}
      atualizando={isFetching && !isLoading}
      erro={!!error}
      pagina={data?.pagina ?? 1}
      porPagina={data?.porPagina ?? 20}
      total={data?.total ?? 0}
      linhas={data?.linhas ?? []}
      foco={foco}
      onPagina={setPagina}
    />
  );
}
LancamentosCampanhaContainer.displayName = "LancamentosCampanhaContainer";
