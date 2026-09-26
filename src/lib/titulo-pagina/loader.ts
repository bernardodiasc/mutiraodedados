import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { notFound } from "@tanstack/react-router";

/**
 * Loader das fichas: busca o registro principal e o devolve nos dados da rota
 * — serializados no SSR, então o cliente hidrata com o mesmo registro sem
 * buscá-lo de novo — junto com o H1, para o título da aba seguir a página.
 * Registro ausente (`null`) vira 404; falha vai para o errorComponent da rota.
 *
 * O componente lê o registro com `Route.useLoaderData()`, nunca com `useQuery`
 * na mesma queryKey: o cache do queryClient não é hidratado no cliente, então
 * a query começaria vazia e a primeira renderização divergiria do HTML do
 * servidor. O queryClient só serve para navegações no cliente reaproveitarem
 * o registro já buscado.
 */
export async function carregarFicha<T>(
  queryClient: QueryClient,
  opts: {
    queryKey: QueryKey;
    queryFn: () => Promise<T>;
    h1: (dado: NonNullable<T>) => string | null;
  },
): Promise<{ dado: NonNullable<T>; h1: string | null }> {
  const dado = await queryClient.ensureQueryData({
    queryKey: opts.queryKey,
    queryFn: opts.queryFn,
  });
  if (dado == null) throw notFound();
  return { dado, h1: opts.h1(dado) };
}
