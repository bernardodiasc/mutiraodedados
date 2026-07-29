export type Estado = "carregando" | "erro" | "sem-vinculo" | "pronto";

export function deriveEstado(input: {
  carregando: boolean;
  temErro: boolean;
  temVinculo: boolean;
}): Estado {
  if (input.carregando) return "carregando";
  if (input.temErro) return "erro";
  if (!input.temVinculo) return "sem-vinculo";
  return "pronto";
}

/** Vínculo derivado por nome (sem CPF) merece aviso visível na ficha. */
export function vinculoPrecisaAviso(metodo: string, confianca: number): boolean {
  return metodo !== "cpf" && confianca < 0.8;
}

/** "ELEITO POR MÉDIA" → true (destaque visual do resultado). */
export function foiEleito(situacao: string | null): boolean {
  return (situacao ?? "").toLowerCase().startsWith("eleito");
}
