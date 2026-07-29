import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { eleicoesDoParlamentar } from "@/lib/data/tse/queries.functions";
import { deriveEstado } from "@/lib/secao-eleicao/logic";
import { SecaoEleicaoView } from "@/components/SecaoEleicaoView";

export function SecaoEleicaoContainer({ tipo, id }: { tipo: "deputado" | "senador"; id: string }) {
  const fn = useServerFn(eleicoesDoParlamentar);
  const { data, isLoading, error } = useQuery({
    queryKey: ["tse", "eleicoes-parlamentar", tipo, id],
    queryFn: () => fn({ data: { tipo, id } }),
  });
  const estado = deriveEstado({
    carregando: isLoading,
    temErro: !!error,
    temVinculo: !!data,
  });
  return <SecaoEleicaoView estado={estado} dados={data ?? null} />;
}
SecaoEleicaoContainer.displayName = "SecaoEleicaoContainer";
