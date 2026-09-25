import type { QueryClient, QueryKey } from "@tanstack/react-query";

/**
 * Loader das fichas para o título da aba seguir o H1: pré-carrega a mesma
 * query do componente (mesma queryKey, então o componente reaproveita o
 * cache) e devolve o H1. Dado ausente ou falha viram `{ h1: null }` — o 404 e
 * o erro continuam sendo tratados pelo componente.
 */
export async function carregarH1<T>(
  queryClient: QueryClient,
  opts: {
    queryKey: QueryKey;
    queryFn: () => Promise<T>;
    h1: (data: NonNullable<T>) => string | null;
  },
): Promise<{ h1: string | null }> {
  try {
    const data = await queryClient.ensureQueryData({
      queryKey: opts.queryKey,
      queryFn: opts.queryFn,
    });
    return { h1: data == null ? null : opts.h1(data) };
  } catch {
    return { h1: null };
  }
}
