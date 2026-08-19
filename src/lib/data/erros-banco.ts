/**
 * Tradução de erros do PostgREST para instruções acionáveis.
 *
 * Módulo puro: nenhuma importação de servidor, para poder ser testado e usado
 * por qualquer fonte.
 */

/**
 * "Coluna não existe" quase sempre significa migration pendente.
 *
 * O parser passa a gravar a coluna nova no instante em que o código é mergeado,
 * mas a migration só chega ao banco no `db push`. Nesse intervalo o PostgREST
 * responde `PGRST204` ou `42703`, e o admin vê "Could not find the 'x' column of
 * 'y' in the schema cache" repetido uma vez por UF — mensagem que não diz o que
 * fazer nem que o problema é o mesmo em todas as linhas.
 *
 * Devolve `null` quando o erro é outro, para o chamador manter o texto original.
 */
/**
 * A função RPC ainda não existe no banco (migration não aplicada)?
 *
 * Serve para quem tem um caminho alternativo: preferir a RPC quando ela existe
 * e cair no caminho antigo quando não existe, em vez de quebrar entre o merge
 * do código e o `db push`. Diferente de coluna ausente, que não tem alternativa
 * — sem a coluna não há onde gravar o dado.
 */
export function funcaoRpcAusente(erro: { code?: string; message?: string } | null): boolean {
  if (!erro) return false;
  if (erro.code === "PGRST202") return true;
  return /Could not find the function|function [\w.]+\(.*\) does not exist/i.test(
    erro.message ?? "",
  );
}

export function mensagemColunaAusente(tabela: string, msg: string): string | null {
  const coluna =
    // PostgREST (cache de esquema): Could not find the 'x' column of 'y' …
    msg.match(/Could not find the '([a-z0-9_]+)' column/i)?.[1] ??
    // Postgres cru (42703): column y.x does not exist
    msg.match(/column (?:[a-z0-9_]+\.)?"?([a-z0-9_]+)"? does not exist/i)?.[1];
  if (!coluna) return null;
  return `${tabela}: a coluna "${coluna}" ainda não existe no banco. Aplique as migrations pendentes (supabase db push) e importe de novo.`;
}
