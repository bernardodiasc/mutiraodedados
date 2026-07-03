/**
 * Funções puras da lista ordenável (drag-and-drop). Sem DOM: recebem os ids na
 * ordem atual e devolvem a nova ordem.
 */

/** Move `origemId` para a posição de `destinoId`, preservando os demais. */
export function moverPara(ids: string[], origemId: string, destinoId: string): string[] {
  if (origemId === destinoId) return ids;
  const de = ids.indexOf(origemId);
  const para = ids.indexOf(destinoId);
  if (de < 0 || para < 0) return ids;
  const copia = ids.slice();
  copia.splice(de, 1);
  // Após remover a origem, o índice do destino pode ter deslocado uma casa.
  const destinoAjustado = copia.indexOf(destinoId);
  const insercao = de < para ? destinoAjustado + 1 : destinoAjustado;
  copia.splice(insercao, 0, origemId);
  return copia;
}

/** True quando a nova ordem difere da atual (evita salvar à toa). */
export function ordemMudou(antes: string[], depois: string[]): boolean {
  if (antes.length !== depois.length) return true;
  return antes.some((id, i) => id !== depois[i]);
}

/**
 * Aplica uma reordenação feita numa visão filtrada à lista completa: os itens
 * ocultos ficam fixos em suas posições globais e os visíveis são recolocados,
 * na nova sequência, apenas nos "espaços" que eram ocupados por itens visíveis.
 *
 * Ex.: completa [A,B,C,D,E], visíveis (B,C,E) reordenados para [E,B,C]
 *      → [A,E,B,D,C] (A e D, ocultos, não se movem).
 */
export function mesclarOrdemFiltrada(
  idsCompletos: string[],
  idsVisiveisNaNovaOrdem: string[],
): string[] {
  const visiveis = new Set(idsVisiveisNaNovaOrdem);
  let i = 0;
  return idsCompletos.map((id) => (visiveis.has(id) ? idsVisiveisNaNovaOrdem[i++] : id));
}
