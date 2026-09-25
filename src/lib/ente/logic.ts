/**
 * Interpretação do código do ente na URL /entes/$codigo.
 * Aceita: sigla de UF ("sp", "SP"), código IBGE de estado (2 dígitos, ex. 35)
 * ou código IBGE de município (7 dígitos, ex. 3550308).
 */

export const UF_NOMES: Record<string, string> = {
  AC: "Acre",
  AL: "Alagoas",
  AM: "Amazonas",
  AP: "Amapá",
  BA: "Bahia",
  CE: "Ceará",
  DF: "Distrito Federal",
  ES: "Espírito Santo",
  GO: "Goiás",
  MA: "Maranhão",
  MG: "Minas Gerais",
  MS: "Mato Grosso do Sul",
  MT: "Mato Grosso",
  PA: "Pará",
  PB: "Paraíba",
  PE: "Pernambuco",
  PI: "Piauí",
  PR: "Paraná",
  RJ: "Rio de Janeiro",
  RN: "Rio Grande do Norte",
  RO: "Rondônia",
  RR: "Roraima",
  RS: "Rio Grande do Sul",
  SC: "Santa Catarina",
  SE: "Sergipe",
  SP: "São Paulo",
  TO: "Tocantins",
};

// Código IBGE de 2 dígitos → sigla (o SICONFI usa esse código para estados).
const COD_UF: Record<string, string> = {
  "11": "RO",
  "12": "AC",
  "13": "AM",
  "14": "RR",
  "15": "PA",
  "16": "AP",
  "17": "TO",
  "21": "MA",
  "22": "PI",
  "23": "CE",
  "24": "RN",
  "25": "PB",
  "26": "PE",
  "27": "AL",
  "28": "SE",
  "29": "BA",
  "31": "MG",
  "32": "ES",
  "33": "RJ",
  "35": "SP",
  "41": "PR",
  "42": "SC",
  "43": "RS",
  "50": "MS",
  "51": "MT",
  "52": "GO",
  "53": "DF",
};

export type EnteInterpretado =
  | { tipo: "estado"; uf: string; codIbge: string }
  | { tipo: "municipio"; ibge: string };

export function interpretarCodigoEnte(codigo: string): EnteInterpretado | null {
  const bruto = codigo.trim();
  const sigla = bruto.toUpperCase();
  if (UF_NOMES[sigla]) {
    const codIbge = Object.entries(COD_UF).find(([, s]) => s === sigla)?.[0] ?? "";
    return { tipo: "estado", uf: sigla, codIbge };
  }
  if (/^\d{2}$/.test(bruto) && COD_UF[bruto]) {
    return { tipo: "estado", uf: COD_UF[bruto], codIbge: bruto };
  }
  if (/^\d{7}$/.test(bruto)) return { tipo: "municipio", ibge: bruto };
  return null;
}

/** URL canônica do ente: estados pela sigla minúscula, municípios pelo IBGE. */
export function codigoCanonico(e: EnteInterpretado): string {
  return e.tipo === "estado" ? e.uf.toLowerCase() : e.ibge;
}

/** H1 da página do ente: município leva a UF entre parênteses. */
export function h1DoEnte(e: { tipo: "estado" | "municipio"; nome: string; uf: string | null }) {
  return e.tipo === "municipio" ? `${e.nome} (${e.uf})` : e.nome;
}
