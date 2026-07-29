import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { doacoesEleitoraisDoCnpj } from "@/lib/data/tse/queries.functions";
import { deriveEstado, paraItens } from "@/lib/doacoes-eleitorais/logic";
import { DoacoesEleitoraisView } from "@/components/DoacoesEleitoraisView";

export function DoacoesEleitoraisContainer({ cnpj }: { cnpj: string }) {
  const fn = useServerFn(doacoesEleitoraisDoCnpj);
  const { data, isLoading, error } = useQuery({
    queryKey: ["tse", "doacoes-cnpj", cnpj],
    queryFn: () => fn({ data: { cnpj } }),
  });
  const itens = paraItens(data?.doacoes ?? []);
  const estado = deriveEstado({
    carregando: isLoading,
    temErro: !!error,
    temDados: itens.length > 0,
  });
  return <DoacoesEleitoraisView estado={estado} itens={itens} total={data?.total ?? 0} />;
}
DoacoesEleitoraisContainer.displayName = "DoacoesEleitoraisContainer";
