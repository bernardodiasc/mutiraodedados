import { FONTES_LIMPEZA } from "@/lib/data/limpeza";

export const MONTHS = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
] as const;

/** Lista decrescente de anos de 2014 até `currentYear` (inclusive). */
export function yearList(currentYear: number): number[] {
  return Array.from({ length: currentYear - 2014 + 1 }, (_, i) => currentYear - i);
}

/** Período padrão = mês 3 meses atrás. Parametriza `now` para ser pura. */
export function defaultMonth(now: Date = new Date()): {
  ini: string; fim: string; ano: number; mes: number;
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

/** IDs válidos de fontes para limpeza (referência ao catálogo). */
export function fontesLimpezaIds(): string[] {
  return FONTES_LIMPEZA.map((f) => f.id);
}