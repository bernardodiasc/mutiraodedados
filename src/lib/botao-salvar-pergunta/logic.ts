export type BotaoSalvarPerguntaEstado = "deslogado" | "salvar" | "salvando" | "salvo";

/** Decide qual estado visual o botão deve mostrar. */
export function deriveBotaoEstado(input: {
  hasUser: boolean;
  justSaved: boolean;
  isPending: boolean;
}): BotaoSalvarPerguntaEstado {
  if (!input.hasUser) return "deslogado";
  if (input.justSaved) return "salvo";
  if (input.isPending) return "salvando";
  return "salvar";
}

/** Normaliza payload de pergunta para o server-fn. Faz trim e descarta vazios. */
export function normalizarPayloadPergunta(input: { texto: string; contexto?: string }): {
  titulo: string;
  contexto: string | null;
} {
  const titulo = input.texto.trim();
  const contexto = input.contexto?.trim() ? input.contexto.trim() : null;
  return { titulo, contexto };
}
