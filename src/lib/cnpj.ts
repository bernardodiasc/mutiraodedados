/**
 * Helpers únicos de CNPJ/CPF para bordas de consulta e links entre fontes.
 *
 * As tabelas cache guardam o documento em formatos diferentes:
 * `fornecedores_cache`/`contratos_cache` formatado (00.000.000/0001-91);
 * PNCP/TSE/convênios só dígitos. Nada de migrar colunas — normalize na
 * consulta e no link com estes helpers, consultando nas duas formas quando
 * a tabela guarda formatado.
 */

export function soDigitos(s: string): string {
  return s.replace(/\D+/g, "");
}

/** 14 dígitos do CNPJ, ou null quando a string não contém um CNPJ completo. */
export function normalizarCnpj(s: string): string | null {
  const d = soDigitos(s);
  return d.length === 14 ? d : null;
}

/** Formato de exibição 00.000.000/0001-91; devolve a entrada quando não é CNPJ. */
export function formatarCnpj(s: string): string {
  const d = soDigitos(s);
  if (d.length !== 14) return s;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

export function ehCnpj(s: string): boolean {
  return soDigitos(s).length === 14;
}

/** CPF de pessoa física mascarado pela origem (ex.: "***.123.456-**") — não cruza. */
export function ehCpfMascarado(s: string): boolean {
  return s.includes("*");
}
