export type BotaoSalvarItemEstado = "deslogado" | "verificando" | "salvar" | "salvando" | "salvo";

/** Decide qual estado o botão "Salvar no caderno" deve mostrar. */
export function deriveItemEstado(input: {
  hasUser: boolean;
  authLoading: boolean;
  verificacaoLoading: boolean;
  jaSalvo: boolean | undefined;
  isPending: boolean;
}): BotaoSalvarItemEstado {
  if (input.authLoading) return "verificando";
  if (!input.hasUser) return "deslogado";
  if (input.jaSalvo) return "salvo";
  if (input.isPending) return "salvando";
  if (input.verificacaoLoading) return "verificando";
  return "salvar";
}
