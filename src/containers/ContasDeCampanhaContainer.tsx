import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { contasDaCandidatura } from "@/lib/data/tse/queries.functions";
import { deriveEstado } from "@/lib/contas-campanha/logic";
import { ContasDeCampanhaView } from "@/components/ContasDeCampanhaView";

/** Contas de campanha de uma candidatura (sq + ano) na ficha do candidato. */
export function ContasDeCampanhaContainer({ sq, ano }: { sq: string; ano: number }) {
  const fn = useServerFn(contasDaCandidatura);
  const { data, isLoading, error } = useQuery({
    queryKey: ["tse", "contas-campanha", sq, ano],
    staleTime: 5 * 60_000,
    queryFn: () => fn({ data: { sq, ano } }),
  });
  const temDados = (data?.topDoadores.length ?? 0) + (data?.topFornecedores.length ?? 0) > 0;
  return (
    <ContasDeCampanhaView
      estado={deriveEstado({ carregando: isLoading, temErro: !!error, temDados })}
      ano={ano}
      topDoadores={data?.topDoadores ?? []}
      topFornecedores={data?.topFornecedores ?? []}
      totalReceitas={data?.totalReceitas ?? 0}
      totalDespesas={data?.totalDespesas ?? 0}
    />
  );
}
ContasDeCampanhaContainer.displayName = "ContasDeCampanhaContainer";
