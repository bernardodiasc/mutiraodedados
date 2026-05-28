/**
 * Sanitização de dados pessoais em campos livres.
 *
 * Este módulo aplica máscaras em padrões que identificam pessoas físicas
 * (CPF, e-mail, telefone, CEP) quando aparecem em descrições de contratos,
 * observações e outros textos livres reproduzidos do Portal da Transparência.
 *
 * Princípio: o fato de um dado pessoal constar em portal oficial não autoriza
 * sua republicação sem critério. LGPD (Lei 13.709/2018) exige minimização e
 * proporcionalidade mesmo no tratamento de dados de acesso público.
 *
 * CNPJ NÃO é dado pessoal — é identificador empresarial público e permanece
 * íntegro.
 */

const CPF_RE = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;
const EMAIL_RE = /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g;
// telefone BR: (11) 99999-9999, 11999999999, 11 9999-9999 etc.
const TEL_RE = /\b(?:\+?55\s?)?(?:\(?\d{2}\)?[\s.-]?)?9?\d{4}[\s.-]?\d{4}\b/g;
const CEP_RE = /\b\d{5}-?\d{3}\b/g;

function mascarar(texto: string, regex: RegExp, marca: string): string {
  return texto.replace(regex, marca);
}

/**
 * Sanitiza um campo de texto livre antes de exibir ao público.
 * Aplica todas as máscaras de PII. Idempotente.
 */
export function sanitizarTextoPublico(texto: string | null | undefined): string {
  if (!texto) return "";
  let s = texto;
  s = mascarar(s, CPF_RE, "[CPF removido]");
  s = mascarar(s, EMAIL_RE, "[e-mail removido]");
  // telefone tem alto risco de falso-positivo (matrículas, processos);
  // só mascara quando o padrão é inequívoco com DDD entre parênteses ou +55
  s = s.replace(/(\+55\s?)?\(\d{2}\)\s?9?\d{4}[\s.-]?\d{4}/g, "[telefone removido]");
  s = mascarar(s, CEP_RE, "[CEP removido]");
  return s;
}

/** Detecta se um texto contém PII potencial — útil para badges de aviso. */
export function contemPII(texto: string | null | undefined): boolean {
  if (!texto) return false;
  return CPF_RE.test(texto) || EMAIL_RE.test(texto) || /\(\d{2}\)\s?9?\d{4}/.test(texto);
}
