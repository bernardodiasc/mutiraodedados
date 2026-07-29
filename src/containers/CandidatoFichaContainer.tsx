import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { obterCandidatoTse } from "@/lib/data/tse/queries.functions";
import { deriveEstado } from "@/lib/candidato-ficha/logic";
import { linkDivulgaCandidato } from "@/lib/links-oficiais";
import { CandidatoFichaView } from "@/components/CandidatoFichaView";

export function CandidatoFichaContainer({ sq, ano }: { sq: string; ano: number }) {
  const obterFn = useServerFn(obterCandidatoTse);
  const { data, isLoading, error } = useQuery({
    queryKey: ["tse", "candidato", sq, ano],
    queryFn: () => obterFn({ data: { sq, ano } }),
  });
  const estado = deriveEstado({
    carregando: isLoading,
    temErro: !!error,
    encontrado: !!data,
  });
  const ue = data?.candidato.municipio_cod ?? data?.candidato.uf ?? null;
  return (
    <CandidatoFichaView
      estado={estado}
      detalhe={data ?? null}
      urlOficial={linkDivulgaCandidato(ano, ue, sq)}
    />
  );
}
CandidatoFichaContainer.displayName = "CandidatoFichaContainer";
