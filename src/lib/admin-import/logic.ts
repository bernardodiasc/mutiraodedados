import { FONTES_LIMPEZA } from "@/lib/data/limpeza";

export const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
] as const;

/** Lista decrescente de anos de 2014 até `currentYear` (inclusive). */
export function yearList(currentYear: number): number[] {
  return Array.from({ length: currentYear - 2014 + 1 }, (_, i) => currentYear - i);
}

/** Período padrão = mês 3 meses atrás. Parametriza `now` para ser pura. */
export function defaultMonth(now: Date = new Date()): {
  ini: string;
  fim: string;
  ano: number;
  mes: number;
} {
  const d = new Date(now);
  d.setMonth(d.getMonth() - 3);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const last = new Date(y, m, 0).getDate();
  return {
    ini: `${y}-${String(m).padStart(2, "0")}-01`,
    fim: `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}`,
    ano: y,
    mes: m,
  };
}

/** Intervalo [ini,fim] em ISO `YYYY-MM-DD` para um (ano, mês). */
export function monthRange(year: number, month: number): { ini: string; fim: string } {
  const last = new Date(year, month, 0).getDate();
  const mm = String(month).padStart(2, "0");
  return { ini: `${year}-${mm}-01`, fim: `${year}-${mm}-${String(last).padStart(2, "0")}` };
}

/** Rótulo curto "Mês/Ano" usado em jobs/batches. */
export function monthLabel(ano: number, mes: number): string {
  return `${MONTHS[mes - 1]}/${ano}`;
}

export type LimpezaPayload = {
  confirm: "APAGAR";
  fontes: string[];
  anoIni?: number;
  anoFim?: number;
};

/**
 * Valida entrada e monta o payload de limpeza seletiva.
 * Lança Error com mensagem amigável para os casos inválidos.
 */
export function buildLimpezaPayload(input: {
  confirm: string;
  fontes: Iterable<string>;
  usarPeriodo: boolean;
  anoIni: number;
  anoFim: number;
}): LimpezaPayload {
  if (input.confirm !== "APAGAR") {
    throw new Error("Digite APAGAR para confirmar.");
  }
  const fontes = Array.from(input.fontes);
  if (fontes.length === 0) {
    throw new Error("Selecione ao menos uma fonte.");
  }
  const payload: LimpezaPayload = { confirm: "APAGAR", fontes };
  if (input.usarPeriodo) {
    if (input.anoIni > input.anoFim) {
      throw new Error("Ano inicial maior que o final.");
    }
    payload.anoIni = input.anoIni;
    payload.anoFim = input.anoFim;
  }
  return payload;
}

export type ResultadoLimpeza = {
  removed: Record<string, number | string>;
  falhas?: Record<string, string>;
};

export type ResumoLimpeza = {
  /** `false` quando alguma fonte falhou — o chamador escolhe o tom do aviso. */
  ok: boolean;
  titulo: string;
  detalhe: string;
};

/**
 * Mensagem da limpeza, com as falhas em primeiro plano.
 *
 * A limpeza roda fonte a fonte e cada DELETE é uma transação própria: dá para
 * uma falhar e as outras terem sido apagadas de verdade. Despejar só o JSON de
 * `removed` — o que o admin fazia antes — escondia exatamente isso.
 */
export function resumirLimpeza(res: ResultadoLimpeza): ResumoLimpeza {
  const linhas = Object.entries(res.removed)
    .filter(([, v]) => v !== 0)
    .map(([k, v]) => `${k}: ${v}`);
  const apagado = linhas.length > 0 ? linhas.join(" · ") : "nada a apagar";
  const falhas = Object.entries(res.falhas ?? {});
  if (falhas.length === 0) return { ok: true, titulo: "Limpeza concluída", detalhe: apagado };
  return {
    ok: false,
    titulo:
      falhas.length === 1
        ? "1 fonte falhou — as demais foram apagadas"
        : `${falhas.length} fontes falharam — as demais foram apagadas`,
    detalhe: `${falhas.map(([f, m]) => `${f}: ${m}`).join(" · ")}\nApagado: ${apagado}`,
  };
}

/** IDs válidos de fontes para limpeza (referência ao catálogo). */
export function fontesLimpezaIds(): string[] {
  return FONTES_LIMPEZA.map((f) => f.id);
}

/**
 * Decide se a sessão deve ser renovada antes do próximo job.
 *
 * Antes da v0.6.0 a renovação era "a cada N jobs" — um chute que renovava
 * demais em lotes rápidos e de menos em rodadas longas (um job de varredura
 * pode levar 4 minutos; 10 deles passam de meia hora). Renovar por
 * proximidade da expiração segue o relógio real do JWT.
 *
 * `expiresAtS` é o `expires_at` da sessão do Supabase (epoch em SEGUNDOS).
 * Sem sessão legível (null), renova por precaução.
 */
export function precisaRenovarSessao(
  expiresAtS: number | null | undefined,
  agoraMs: number,
  margemS = 120,
): boolean {
  if (expiresAtS == null) return true;
  return expiresAtS * 1000 - agoraMs <= margemS * 1000;
}

/**
 * Fatia uma janela livre em janelas de no máximo um mês CALENDÁRIO.
 *
 * A API do Portal recusa períodos maiores em licitações e convênios — "o
 * período deve ser de no máximo 1 mês" — e devolve 400. Pedir ao operador que
 * importe mês a mês é a mesma armadilha que a varredura do SICONFI resolveu:
 * quem quer carga histórica escolhe um intervalo grande, e a ferramenta é que
 * deve saber quebrá-lo.
 *
 * As bordas são preservadas: um pedido de 15/jan a 20/mar rende 15–31/jan,
 * 1–29/fev e 1–20/mar.
 */
export function janelasMensais(
  dataInicial: string,
  dataFinal: string,
): Array<{ ini: string; fim: string }> {
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  if (!iso.test(dataInicial) || !iso.test(dataFinal) || dataFinal < dataInicial) return [];

  const janelas: Array<{ ini: string; fim: string }> = [];
  let ano = Number(dataInicial.slice(0, 4));
  let mes = Number(dataInicial.slice(5, 7));
  let ini = dataInicial;

  // Teto de segurança: 100 anos de meses. Sem ele, uma data absurda vinda de
  // um input livre giraria para sempre.
  for (let i = 0; i < 1200; i++) {
    const ultimoDia = new Date(ano, mes, 0).getDate();
    const fimDoMes = `${ano}-${String(mes).padStart(2, "0")}-${String(ultimoDia).padStart(2, "0")}`;
    const fim = fimDoMes < dataFinal ? fimDoMes : dataFinal;
    janelas.push({ ini, fim });
    if (fim >= dataFinal) break;
    mes += 1;
    if (mes > 12) {
      mes = 1;
      ano += 1;
    }
    ini = `${ano}-${String(mes).padStart(2, "0")}-01`;
  }
  return janelas;
}

/** O mínimo que o painel lê de uma rodada retomável: se há mais e os erros. */
export type RodadaRetomavel = { erros: string[]; varredura: { haMais: boolean } };

/**
 * Repete as rodadas de uma rotina retomável (catálogo SIAFI, atividade dos
 * órgãos) até ela terminar, com teto de rodadas como trava contra laço.
 * Devolve as rodadas feitas e se terminou; quem chama soma os contadores.
 */
export async function repetirAteTerminar<R extends RodadaRetomavel>(
  rodar: () => Promise<R>,
  maxRodadas = 100,
): Promise<{ rodadas: R[]; terminou: boolean }> {
  const rodadas: R[] = [];
  for (let n = 0; n < maxRodadas; n++) {
    const r = await rodar();
    rodadas.push(r);
    if (!r.varredura.haMais) return { rodadas, terminou: true };
  }
  return { rodadas, terminou: false };
}

const somar = <R>(rodadas: readonly R[], campo: (r: R) => number) =>
  rodadas.reduce((soma, r) => soma + campo(r), 0);

/**
 * O resumo do botão "Sincronizar catálogo de órgãos", depois das rodadas das
 * duas rotinas: nomes do SIAFI e atividade dos órgãos.
 */
export function resumoDoCatalogo(
  nomes: {
    rodadas: readonly { importados: number; invalidos: number; erros: string[] }[];
    terminou: boolean;
  },
  atividade: {
    rodadas: readonly { verificados: number; ativos: number; inativos: number; erros: string[] }[];
    terminou: boolean;
  },
): { texto: string; completo: boolean } {
  const erros =
    somar(nomes.rodadas, (r) => r.erros.length) + somar(atividade.rodadas, (r) => r.erros.length);
  const partes = [
    `Catálogo: ${somar(nomes.rodadas, (r) => r.importados)} órgãos (${somar(nomes.rodadas, (r) => r.invalidos)} inválidos ignorados)`,
    `atividade: ${somar(atividade.rodadas, (r) => r.ativos)} ativos, ${somar(atividade.rodadas, (r) => r.inativos)} extintos/inativos de ${somar(atividade.rodadas, (r) => r.verificados)} verificados`,
  ];
  if (erros > 0) partes.push(`${erros} erro(s) — veja o Histórico`);
  const completo = nomes.terminou && atividade.terminou;
  if (!completo) partes.push("parou no teto de rodadas; clique de novo para continuar");
  return { texto: partes.join(" · "), completo };
}
