/** Formata o status de uma pergunta para exibição em pt-BR. */
export function formatarStatusPergunta(status: string): string {
  const map: Record<string, string> = {
    privada: "Privada",
    em_revisao: "Em revisão",
    publicada: "Pública",
    arquivada: "Arquivada",
    encerrada: "Encerrada",
  };
  return map[status] ?? status.replace(/_/g, " ");
}

/** Formata ISO em pt-BR; devolve string original quando inválida. */
export function formatarDataPt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR");
}
