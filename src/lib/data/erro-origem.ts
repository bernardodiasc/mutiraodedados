/**
 * Erro passageiro × erro definitivo, na varredura retomável.
 *
 * A distinção decide o que a rodada faz quando um item falha:
 *
 * - **Passageiro** (rede caiu, 5xx, 429): o item ainda existe, a origem é que
 *   não respondeu. Interrompe a rodada SEM avançar o cursor — a próxima refaz
 *   o mesmo item.
 * - **Definitivo** (404, 4xx, parse): esse item não vai melhorar por
 *   insistência. Registra o erro, avança e segue.
 *
 * Tratar os dois igual foi um bug real: um 404 permanente num parlamentar
 * fazia a rodada voltar ao mesmo item para sempre, e a varredura inteira
 * parava com "nenhum passo executado" e zero importados.
 */

/** Prefixo que os clientes HTTP usam para marcar falha passageira. */
export const PREFIXO_TRANSITORIO = "TRANSIENT:";

export function ehErroTransitorio(erro: unknown): boolean {
  const msg = erro instanceof Error ? erro.message : String(erro ?? "");
  if (msg.startsWith(PREFIXO_TRANSITORIO)) return true;
  // Timeout do runner do painel e falhas de rede do fetch não têm o prefixo.
  return /timeout|network|fetch failed|ECONNRESET|ETIMEDOUT|socket hang up/i.test(msg);
}

/**
 * Como a varredura reage a um erro num item.
 * `interromper: true` NÃO avança o cursor (a próxima rodada refaz o item).
 */
export function reacaoAoErro(erro: unknown): { interromper: boolean; motivo: string } {
  return ehErroTransitorio(erro)
    ? { interromper: true, motivo: "origem indisponível — a próxima rodada refaz este item" }
    : { interromper: false, motivo: "erro definitivo — item registrado e varredura segue" };
}

/**
 * Reação a um erro ao buscar a LISTA que a varredura percorre (a página de
 * proposições, a pauta de votações, o rol de matérias).
 *
 * Aqui avançar o cursor não adianta: sem a lista não há item nenhum a
 * processar, e insistir num 404 permanente gastaria centenas de requisições
 * inúteis. Passageiro refaz; definitivo encerra a rodada com o erro
 * registrado — o operador vê no Histórico que a varredura parou por falha,
 * não por ter terminado.
 */
export function reacaoAoErroDeLista(erro: unknown): { interromper: boolean; fim: boolean } {
  return ehErroTransitorio(erro)
    ? { interromper: true, fim: false }
    : { interromper: false, fim: true };
}
