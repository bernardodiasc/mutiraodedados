/** Formata ISO em pt-BR; devolve string original quando inválida. */
export function formatarDataPt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR");
}