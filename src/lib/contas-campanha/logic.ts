export type Estado = "carregando" | "erro" | "vazio" | "pronto";

/**
 * Estado da seção "Contas de campanha" da ficha do candidato — some quando a
 * campanha não tem receitas nem despesas no acervo (seção vazia seria ruído).
 */
export function deriveEstado(input: {
  carregando: boolean;
  temErro: boolean;
  temDados: boolean;
}): Estado {
  if (input.carregando) return "carregando";
  if (input.temErro) return "erro";
  return input.temDados ? "pronto" : "vazio";
}
