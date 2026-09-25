/**
 * Texto do H1 das fichas da Câmara e do Senado. A mesma função alimenta o H1
 * renderizado e o título da aba (via loader), para os dois nunca divergirem.
 */

/** Deputado ou senador: o nome parlamentar. */
export function h1DoParlamentar(p: { nome: string }): string {
  return p.nome;
}

/** Proposição da Câmara: "PL 2630/2020". */
export function h1DaProposicao(p: { siglaTipo: string; numero: number; ano: number }): string {
  return `${p.siglaTipo} ${p.numero}/${p.ano}`;
}

/** Matéria do Senado: "PEC 45/2019". */
export function h1DaMateria(m: { siglaSubtipo: string; numero: number; ano: number }): string {
  return `${m.siglaSubtipo} ${m.numero}/${m.ano}`;
}

/** Votação (Câmara ou Senado): a descrição registrada pela Casa. */
export function h1DaVotacao(v: { descricao: string | null }): string {
  return v.descricao ?? "(sem descrição)";
}
