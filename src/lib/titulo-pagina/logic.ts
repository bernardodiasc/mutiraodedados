const SITE = "Mutirão de Dados";
const MAX_H1 = 80;

/**
 * Título da aba do navegador: o H1 da página seguido do nome do site.
 * `padrao` cobre o instante em que o H1 ainda não existe (ex.: registro não
 * encontrado). H1 longo (objeto de contrato) é encurtado na última palavra.
 */
export function tituloDaPagina(h1: string | null | undefined, padrao?: string): string {
  const base = h1?.trim() || padrao?.trim();
  if (!base) return SITE;
  return `${encurtar(base)} — ${SITE}`;
}

function encurtar(texto: string): string {
  if (texto.length <= MAX_H1) return texto;
  const corte = texto.slice(0, MAX_H1);
  const ultimoEspaco = corte.lastIndexOf(" ");
  return `${(ultimoEspaco > 0 ? corte.slice(0, ultimoEspaco) : corte).replace(/[\s,;:.-]+$/, "")}…`;
}
