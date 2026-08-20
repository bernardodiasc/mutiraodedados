/**
 * Particionamento da varredura em massa do SICONFI.
 *
 * O SICONFI publica por (ente, exercício, relatório). Importar "tudo" é o
 * produto cartesiano dessas três dimensões — e mesmo o recorte mais modesto já
 * é grande: 27 UFs × 14 exercícios × 10 relatórios = 3.780 consultas. Fazer
 * isso ente a ente pela tela seria inviável.
 *
 * Este módulo é a aritmética que transforma esse produto numa sequência linear
 * de consultas, para o runner retomável percorrer. Puro de propósito: um erro
 * de índice aqui pula um ente ou um exercício inteiro em silêncio.
 */

export type AlvoSiconfi = {
  tipoRelatorio: "RREO" | "RGF" | "DCA";
  periodo?: number;
};

/**
 * Conjunto padrão de relatórios de um ente/exercício: RREO por bimestre (1–6),
 * RGF por quadrimestre (1–3) e o DCA anual. A ordem é fixa — é ela que define
 * a posição de cada consulta no cursor.
 */
export const ALVOS_SICONFI: readonly AlvoSiconfi[] = [
  ...[1, 2, 3, 4, 5, 6].map((p) => ({ tipoRelatorio: "RREO" as const, periodo: p })),
  ...[1, 2, 3].map((p) => ({ tipoRelatorio: "RGF" as const, periodo: p })),
  { tipoRelatorio: "DCA" as const },
];

export type EnteSiconfi = { codigo: string; nome: string; uf: string };

/**
 * Capitais dos 27 entes federativos, com código IBGE conferido contra
 * `servicodados.ibge.gov.br/api/v1/localidades/municipios`.
 */
export const CAPITAIS: readonly EnteSiconfi[] = [
  { codigo: "1200401", nome: "Rio Branco", uf: "AC" },
  { codigo: "2704302", nome: "Maceió", uf: "AL" },
  { codigo: "1302603", nome: "Manaus", uf: "AM" },
  { codigo: "1600303", nome: "Macapá", uf: "AP" },
  { codigo: "2927408", nome: "Salvador", uf: "BA" },
  { codigo: "2304400", nome: "Fortaleza", uf: "CE" },
  { codigo: "5300108", nome: "Brasília", uf: "DF" },
  { codigo: "3205309", nome: "Vitória", uf: "ES" },
  { codigo: "5208707", nome: "Goiânia", uf: "GO" },
  { codigo: "2111300", nome: "São Luís", uf: "MA" },
  { codigo: "3106200", nome: "Belo Horizonte", uf: "MG" },
  { codigo: "5002704", nome: "Campo Grande", uf: "MS" },
  { codigo: "5103403", nome: "Cuiabá", uf: "MT" },
  { codigo: "1501402", nome: "Belém", uf: "PA" },
  { codigo: "2507507", nome: "João Pessoa", uf: "PB" },
  { codigo: "2611606", nome: "Recife", uf: "PE" },
  { codigo: "2211001", nome: "Teresina", uf: "PI" },
  { codigo: "4106902", nome: "Curitiba", uf: "PR" },
  { codigo: "3304557", nome: "Rio de Janeiro", uf: "RJ" },
  { codigo: "2408102", nome: "Natal", uf: "RN" },
  { codigo: "1100205", nome: "Porto Velho", uf: "RO" },
  { codigo: "1400100", nome: "Boa Vista", uf: "RR" },
  { codigo: "4314902", nome: "Porto Alegre", uf: "RS" },
  { codigo: "4205407", nome: "Florianópolis", uf: "SC" },
  { codigo: "2800308", nome: "Aracaju", uf: "SE" },
  { codigo: "3550308", nome: "São Paulo", uf: "SP" },
  { codigo: "1721000", nome: "Palmas", uf: "TO" },
];

export type ConjuntoSiconfi = "ufs" | "capitais" | "municipios" | "ente";

export const ROTULO_CONJUNTO: Record<ConjuntoSiconfi, string> = {
  ufs: "todos os estados e o DF",
  capitais: "as 27 capitais",
  municipios: "os municípios de uma UF",
  ente: "o ente selecionado",
};

/** Exercícios de um intervalo, em ordem crescente. Intervalo invertido devolve vazio. */
export function exerciciosDoIntervalo(inicial: number, final: number): number[] {
  if (final < inicial) return [];
  return Array.from({ length: final - inicial + 1 }, (_, i) => inicial + i);
}

/** Quantas consultas a varredura inteira representa — o número que a tela mostra antes de começar. */
export function totalDeConsultas(nEntes: number, nExercicios: number): number {
  return nEntes * nExercicios * ALVOS_SICONFI.length;
}

export type PosicaoSiconfi = {
  ente: EnteSiconfi;
  exercicio: number;
  alvo: AlvoSiconfi;
};

/**
 * Consulta na posição do cursor (1-based, como o runner numera).
 *
 * A ordem é ente → exercício → relatório: a varredura termina um ente inteiro
 * antes de passar ao próximo, o que deixa o progresso legível no Histórico e
 * permite parar no meio sem deixar um ente pela metade em vários anos.
 */
export function alvoNoCursor(
  entes: readonly EnteSiconfi[],
  exercicios: readonly number[],
  cursor: number,
): { posicao: PosicaoSiconfi | null; fim: boolean } {
  const porEnte = exercicios.length * ALVOS_SICONFI.length;
  const total = entes.length * porEnte;
  if (cursor < 1 || cursor > total || porEnte === 0) return { posicao: null, fim: true };

  const i = cursor - 1;
  const ente = entes[Math.floor(i / porEnte)];
  const resto = i % porEnte;
  const exercicio = exercicios[Math.floor(resto / ALVOS_SICONFI.length)];
  const alvo = ALVOS_SICONFI[resto % ALVOS_SICONFI.length];
  return { posicao: { ente, exercicio, alvo }, fim: false };
}

/** Rótulo curto de um alvo, para mensagens e log. */
export function rotuloAlvo(alvo: AlvoSiconfi): string {
  return alvo.periodo ? `${alvo.tipoRelatorio} P${alvo.periodo}` : alvo.tipoRelatorio;
}

/**
 * Chave da varredura. Precisa distinguir tudo que muda o conjunto de
 * consultas — conjunto, UF (quando o conjunto é municípios) e o intervalo de
 * exercícios —, senão uma varredura retomaria do cursor de outra.
 */
export function chaveVarreduraSiconfi(
  conjunto: ConjuntoSiconfi,
  exercicioInicial: number,
  exercicioFinal: number,
  filtro?: string | null,
): string {
  const base = `siconfi_varredura#${conjunto}#${exercicioInicial}-${exercicioFinal}`;
  return filtro ? `${base}#${filtro}` : base;
}
