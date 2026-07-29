import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { resumoEleicoes } from "@/lib/data/tse/queries.functions";
import { agruparPorAno, deriveEstado } from "@/lib/eleicoes-hub/logic";
import { EleicoesHubView } from "@/components/EleicoesHubView";

export function EleicoesHubContainer() {
  const resumoFn = useServerFn(resumoEleicoes);
  const { data, isLoading, error } = useQuery({
    queryKey: ["tse", "resumo-eleicoes"],
    queryFn: () => resumoFn(),
  });
  const anos = agruparPorAno(data ?? []);
  const estado = deriveEstado({
    carregando: isLoading,
    temErro: !!error,
    temDados: anos.length > 0,
  });
  return <EleicoesHubView estado={estado} anos={anos} />;
}
EleicoesHubContainer.displayName = "EleicoesHubContainer";
