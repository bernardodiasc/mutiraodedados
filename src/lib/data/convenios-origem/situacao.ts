/**
 * A situação lida na origem (Transferegov) difere da do espelho da CGU?
 * Só há divergência quando os dois lados têm valor; a comparação ignora caixa.
 */
export function situacoesDivergem(origem: string | null, espelho: string | null): boolean {
  return !!origem && !!espelho && origem.toLowerCase() !== espelho.toLowerCase();
}
