import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AprendaAInvestigarView } from "@/components/AprendaAInvestigarView";
import { artigosQueCitam } from "@/lib/data/artigos-que-citam.functions";

/** Registro da ficha na identidade do índice: tabela de origem e chave. */
export function AprendaAInvestigar({ colecao, idOrigem }: { colecao: string; idOrigem: string }) {
  const fn = useServerFn(artigosQueCitam);
  const { data = [] } = useQuery({
    queryKey: ["artigos-que-citam", colecao, idOrigem],
    queryFn: () => fn({ data: { colecao, idOrigem } }),
    staleTime: 10 * 60 * 1000,
  });
  return <AprendaAInvestigarView artigos={data} />;
}
