/**
 * Busca TODAS as linhas de uma query, contornando o teto de linhas do PostgREST.
 *
 * O Supabase deste projeto aplica um teto de servidor (`db-max-rows`, 1000 linhas):
 * mesmo pedindo `.limit(100000)`, a resposta vem truncada em 1000. Isso silenciosamente
 * "perdia" deputados/senadores nas listagens e distorcia contagens. Aqui varremos a
 * tabela em páginas de 1000 via `.range()` até a última página vir incompleta.
 *
 * Use para varreduras completas de tabelas pequenas (cadastros, legislaturas).
 * NÃO use para tabelas grandes de lançamentos (ex.: despesas) — prefira agregação no banco.
 */
const TAMANHO_PAGINA = 1000;

type QueryPaginavel<T> = {
  range(
    de: number,
    ate: number,
  ): PromiseLike<{ data: T[] | null; error: { message: string } | null }>;
};

export async function selectAll<T>(construir: () => QueryPaginavel<T>): Promise<T[]> {
  const todas: T[] = [];
  for (let inicio = 0; ; inicio += TAMANHO_PAGINA) {
    const { data, error } = await construir().range(inicio, inicio + TAMANHO_PAGINA - 1);
    if (error) throw new Error(error.message);
    const pagina = data ?? [];
    todas.push(...pagina);
    if (pagina.length < TAMANHO_PAGINA) break;
  }
  return todas;
}
