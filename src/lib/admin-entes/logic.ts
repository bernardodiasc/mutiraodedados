/**
 * Funções puras extraídas de AdminEntesPanel.
 */

export const UFS = [
  "",
  "AC",
  "AL",
  "AM",
  "AP",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MG",
  "MS",
  "MT",
  "PA",
  "PB",
  "PE",
  "PI",
  "PR",
  "RJ",
  "RN",
  "RO",
  "RR",
  "RS",
  "SC",
  "SE",
  "SP",
  "TO",
] as const;

export type Ente = {
  codigo: string;
  nome: string;
  uf?: string;
  tipo: "UF" | "Município";
};

export const PRESETS: Ente[] = [
  { codigo: "35", nome: "São Paulo (estado)", uf: "SP", tipo: "UF" },
  { codigo: "3550308", nome: "São Paulo (capital)", uf: "SP", tipo: "Município" },
  { codigo: "2611606", nome: "Recife", uf: "PE", tipo: "Município" },
  { codigo: "33", nome: "Rio de Janeiro (estado)", uf: "RJ", tipo: "UF" },
  { codigo: "3304557", nome: "Rio de Janeiro (capital)", uf: "RJ", tipo: "Município" },
  { codigo: "53", nome: "Distrito Federal", uf: "DF", tipo: "UF" },
];

const UF_RAW: Array<[string, string, string]> = [
  ["11", "Rondônia", "RO"],
  ["12", "Acre", "AC"],
  ["13", "Amazonas", "AM"],
  ["14", "Roraima", "RR"],
  ["15", "Pará", "PA"],
  ["16", "Amapá", "AP"],
  ["17", "Tocantins", "TO"],
  ["21", "Maranhão", "MA"],
  ["22", "Piauí", "PI"],
  ["23", "Ceará", "CE"],
  ["24", "Rio Grande do Norte", "RN"],
  ["25", "Paraíba", "PB"],
  ["26", "Pernambuco", "PE"],
  ["27", "Alagoas", "AL"],
  ["28", "Sergipe", "SE"],
  ["29", "Bahia", "BA"],
  ["31", "Minas Gerais", "MG"],
  ["32", "Espírito Santo", "ES"],
  ["33", "Rio de Janeiro", "RJ"],
  ["35", "São Paulo", "SP"],
  ["41", "Paraná", "PR"],
  ["42", "Santa Catarina", "SC"],
  ["43", "Rio Grande do Sul", "RS"],
  ["50", "Mato Grosso do Sul", "MS"],
  ["51", "Mato Grosso", "MT"],
  ["52", "Goiás", "GO"],
  ["53", "Distrito Federal", "DF"],
];

export const UF_LIST: Ente[] = UF_RAW.map(([codigo, nome, uf]) => ({
  codigo,
  nome: `${nome} (estado)`,
  uf,
  tipo: "UF" as const,
}));

/** Mantém apenas dígitos e limita a 7 caracteres (compatível com código IBGE). */
export function sanitizeIbge(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 7);
}

/** Retorna o primeiro e último dia (YYYY-MM-DD) de um mês. */
export function monthRange(year: number, month: number): { ini: string; fim: string } {
  const last = new Date(year, month, 0).getDate();
  const mm = String(month).padStart(2, "0");
  return { ini: `${year}-${mm}-01`, fim: `${year}-${mm}-${String(last).padStart(2, "0")}` };
}

/** True quando o código IBGE corresponde a um município (7 dígitos). */
export function isMunicipio(codigo: string): boolean {
  return codigo.length === 7 && /^\d{7}$/.test(codigo);
}

/** True quando o código IBGE corresponde a uma UF (2 dígitos). */
export function isUF(codigo: string): boolean {
  return codigo.length === 2 && /^\d{2}$/.test(codigo);
}

/**
 * Quantos entes um conjunto de varredura representa. `municipios` depende da
 * UF e só se sabe no servidor, então a tela mostra a estimativa média (~206
 * municípios por UF) até a varredura começar.
 */
export function tamanhoDoConjunto(conjunto: "ufs" | "capitais" | "municipios" | "ente"): {
  n: number;
  exato: boolean;
} {
  if (conjunto === "ufs") return { n: 27, exato: true };
  if (conjunto === "capitais") return { n: 27, exato: true };
  if (conjunto === "ente") return { n: 1, exato: true };
  return { n: 206, exato: false };
}

/**
 * Frase que a tela mostra ANTES de começar, para o operador saber no que está
 * se metendo — o produto (entes × exercícios × relatórios) cresce rápido.
 */
export function estimativaVarredura(
  conjunto: "ufs" | "capitais" | "municipios" | "ente",
  exercicioInicial: number,
  exercicioFinal: number,
  alvosPorExercicio = 10,
): string {
  const anos = exercicioFinal - exercicioInicial + 1;
  if (anos <= 0) return "Intervalo de exercícios inválido.";
  const { n, exato } = tamanhoDoConjunto(conjunto);
  const total = n * anos * alvosPorExercicio;
  const aprox = exato ? "" : "~";
  const plural = (v: number, s: string, p: string) => `${v} ${v === 1 ? s : p}`;
  return `${aprox}${plural(n, "ente", "entes")} × ${plural(anos, "exercício", "exercícios")} × ${alvosPorExercicio} relatórios = ${aprox}${total.toLocaleString("pt-BR")} consultas`;
}

/** Progresso da varredura em percentual inteiro, tolerante a total zero. */
export function percentualVarredura(cursor: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((cursor / total) * 100));
}

// ---------------------------------------------------------------------------
// Escopo compartilhado: as três fontes usam o MESMO ente e o MESMO período
// ---------------------------------------------------------------------------
//
// Até a v0.6.0 cada fonte tinha o seu recorte — o SICONFI usava o ente mas
// ignorava o mês, o PNCP tinha uma UF própria e ignorava o ente, e o
// Transferegov só filtrava município. A tela chegou a *explicar* essa
// divergência, o que só a tornou mais confusa: o certo é não existir.

export type EscopoEnte =
  | { tipo: "uf"; codigoIbge: string; sigla: string }
  | { tipo: "municipio"; codigoIbge: string }
  | { tipo: "nenhum" };

/**
 * Interpreta o código IBGE escolhido no topo da aba. 2 dígitos são UF (e
 * rendem a sigla, que algumas APIs exigem no lugar do código); 7 são
 * município.
 */
export function escopoDoEnte(ibge: string): EscopoEnte {
  const cod = sanitizeIbge(ibge);
  if (isUF(cod)) {
    const uf = UF_LIST.find((u) => u.codigo === cod);
    return { tipo: "uf", codigoIbge: cod, sigla: uf?.uf ?? "" };
  }
  if (isMunicipio(cod)) return { tipo: "municipio", codigoIbge: cod };
  return { tipo: "nenhum" };
}

/** Frase curta do escopo, para a tela dizer sobre quem a importação é. */
export function rotuloEscopo(e: EscopoEnte, nomeEnte?: string): string {
  if (e.tipo === "nenhum") return "Brasil inteiro";
  if (e.tipo === "uf") return nomeEnte ?? `UF ${e.sigla || e.codigoIbge}`;
  return nomeEnte ?? `município ${e.codigoIbge}`;
}

/**
 * Período fiscal do SICONFI a partir do mês escolhido. O RREO é bimestral e o
 * RGF quadrimestral, então o mês determina os dois — não havia motivo para a
 * aba pedir o período de novo.
 */
export function periodoFiscalDoMes(mes: number, tipo: "RREO" | "RGF" | "DCA"): number | undefined {
  if (tipo === "DCA") return undefined; // anual
  const m = Math.min(12, Math.max(1, Math.round(mes)));
  // Bimestre = 2 meses (6 no ano); quadrimestre = 4 meses (3 no ano).
  return tipo === "RREO" ? Math.ceil(m / 2) : Math.ceil(m / 4);
}

/** Como o período fiscal se chama, para o rótulo não mentir. */
export function nomePeriodoFiscal(tipo: "RREO" | "RGF" | "DCA"): string {
  if (tipo === "RREO") return "bimestre";
  if (tipo === "RGF") return "quadrimestre";
  return "exercício";
}

const MESES_ABREV = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

/**
 * Período fiscal com os meses que ele cobre — "3 (mai–jun)".
 *
 * Só o número confunde: para o mesmo mês de maio, o RREO cai no bimestre 3 e
 * o RGF no quadrimestre 2, e sem os meses ao lado os dois parecem
 * arbitrários (ou errados).
 */
export function rotuloPeriodoFiscal(mes: number, tipo: "RREO" | "RGF" | "DCA"): string {
  if (tipo === "DCA") return "ano inteiro";
  const p = periodoFiscalDoMes(mes, tipo);
  if (p == null) return "—";
  const tamanho = tipo === "RREO" ? 2 : 4;
  const primeiro = (p - 1) * tamanho;
  const ultimo = primeiro + tamanho - 1;
  return `${p} (${MESES_ABREV[primeiro]}–${MESES_ABREV[ultimo]})`;
}

// ---------------------------------------------------------------------------
// Varredura paginada travada na origem
// ---------------------------------------------------------------------------
//
// Uma rodada que falha por erro passageiro NÃO avança o cursor — de propósito,
// para a próxima refazer o mesmo item. Mas o laço do painel repetia rodadas
// até 200 vezes sem olhar se alguma delas produzia algo: com o PNCP devolvendo
// 504, cada rodada gastava ~5 min só para falhar igual, e o botão ficava
// girando por horas. Uma rodada que importa zero E registra erro é estéril;
// duas seguidas significam que a origem está fora do ar, não que falta pouco.

/** Rodadas estéreis seguidas que encerram a varredura. */
export const MAX_RODADAS_ESTEREIS = 2;

/** A rodada não produziu nada e a origem reclamou. */
export function rodadaEsteril(importados: number, erros: readonly string[] | undefined): boolean {
  return importados === 0 && (erros?.length ?? 0) > 0;
}

/**
 * Por que a varredura deve parar, ou `null` para continuar. A mensagem vai
 * para o operador — precisa dizer que a culpa é da origem, não do painel.
 */
export function paradaPorOrigem(esterisSeguidas: number, ultimoErro?: string): string | null {
  if (esterisSeguidas < MAX_RODADAS_ESTEREIS) return null;
  const causa = ultimoErro ? ` Último erro: ${ultimoErro}` : "";
  return `a origem não respondeu em ${esterisSeguidas} rodadas seguidas — parei para não insistir à toa. Tente de novo mais tarde; a varredura retoma de onde parou.${causa}`;
}
