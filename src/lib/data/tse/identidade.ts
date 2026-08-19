/**
 * Como ligar candidaturas da mesma pessoa entre eleições.
 *
 * O TSE mudou o que publica: até 2022 o arquivo de candidatos trazia
 * NR_CPF_CANDIDATO; em 2024 esse campo vem "NÃO DIVULGÁVEL" em todas as linhas e
 * quem passou a vir preenchido é NR_TITULO_ELEITORAL_CANDIDATO. Por isso a chave
 * primária de ligação é o TÍTULO, com o CPF como reforço para os anos antigos.
 *
 * O que NÃO se faz aqui é cair para nome: homônimo é comum, e o erro custaria
 * atribuir o patrimônio declarado de uma pessoa a outra. Sem identificador
 * numérico, a ficha assume que não sabe.
 */

/** Espelha o guard `length(cpf) = 11` da RPC tse_evolucao_patrimonial. */
export function cpfUtilizavel(cpf: string | null | undefined): boolean {
  if (!cpf || !/^\d{11}$/.test(cpf)) return false;
  return !/^(\d)\1{10}$/.test(cpf);
}

/**
 * Título eleitoral tem 12 dígitos, mas a origem às vezes omite zeros à
 * esquerda — daí a faixa de 10 a 12. Dígito repetido é preenchimento.
 */
export function tituloUtilizavel(titulo: string | null | undefined): boolean {
  if (!titulo || !/^\d{10,12}$/.test(titulo)) return false;
  return !/^(\d)\1+$/.test(titulo);
}

export type ChavesIdentidade = {
  titulo: string | null;
  cpf: string | null;
};

/** Os identificadores aproveitáveis de uma candidatura, já filtrados. */
export function chavesIdentidade(c: {
  titulo_eleitoral?: string | null;
  cpf?: string | null;
}): ChavesIdentidade {
  return {
    titulo: tituloUtilizavel(c.titulo_eleitoral) ? c.titulo_eleitoral! : null,
    cpf: cpfUtilizavel(c.cpf) ? c.cpf! : null,
  };
}

/** Há algum identificador com que buscar outras candidaturas? */
export function temIdentificador(chaves: ChavesIdentidade): boolean {
  return chaves.titulo != null || chaves.cpf != null;
}
