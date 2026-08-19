/**
 * Particionamento das despesas de gabinete (CEAP na Câmara, CEAPS no Senado)
 * por parlamentar, para o runner retomável.
 *
 * Antes da v0.4.0 um mês inteiro era importado numa server function só, que
 * percorria todos os parlamentares em cache — centenas deles, cada um com até
 * 30 páginas. Sem orçamento, sem retomada e sem teto de subrequisições, era o
 * candidato mais provável a estourar os limites do Worker assim que o histórico
 * de várias legislaturas entrasse.
 *
 * Agora cada passo do runner processa UM parlamentar, e o cursor é a posição
 * dele na lista. Módulo puro de propósito: o erro que ele evita — pular um
 * parlamentar por um off-by-one, sem ninguém perceber — é silencioso e só some
 * com teste.
 */

/**
 * Chave da varredura. Um mês de uma casa é uma varredura; importar um
 * parlamentar específico é outra, para não embaralhar o progresso das duas.
 */
export function chaveVarreduraCeap(
  fonte: "camara_ceap" | "senado_ceaps",
  ano: number,
  mes: number,
  parlamentarId?: number,
): string {
  const base = `${fonte}#${ano}#${String(mes).padStart(2, "0")}`;
  return parlamentarId ? `${base}#${parlamentarId}` : base;
}

/**
 * Parlamentar na posição do cursor (1-based, como o runner numera).
 * `fim` quando o cursor passa do último — é o que encerra a varredura.
 *
 * A lista precisa vir na MESMA ordem a cada rodada, senão a retomada pula ou
 * repete parlamentar. Quem chama garante isso ordenando por id.
 */
export function parlamentarNoCursor<T>(
  ids: readonly T[],
  cursor: number,
): {
  id: T | null;
  fim: boolean;
} {
  if (cursor < 1 || cursor > ids.length) return { id: null, fim: true };
  return { id: ids[cursor - 1], fim: false };
}

/** Orçamento de tempo de uma rodada, com folga sob o limite do Worker. */
export const CEAP_ORCAMENTO_MS = 150_000;

/**
 * Teto de subrequisições por rodada. O Worker limita subrequisições por
 * invocação, e tempo sozinho não protege disso: um parlamentar pode ser rápido
 * e caro. Conta páginas buscadas e lotes gravados; a margem até o teto real
 * absorve as consultas de QA.
 */
export const CEAP_TETO_SUBREQUISICOES = 45;
