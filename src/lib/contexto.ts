import type { Dataset } from "./data/source";

/** Salário mínimo nacional 2026 (referência didática). */
export const SALARIO_MINIMO = 1518;

/** Quantos salários mínimos anuais cabem em um valor. */
export function emSalariosMinimos(valor: number): number {
  return valor / (SALARIO_MINIMO * 12);
}

/** Mediana do gasto anual de órgãos da mesma função. */
export function medianaPorFuncao(ds: Dataset, funcao: string): number {
  const totais: number[] = [];
  for (const o of ds.orgaos) {
    if (o.funcao !== funcao) continue;
    const total = ds.contratos.filter(c => c.orgaoCod === o.cod).reduce((s, c) => s + c.valor, 0);
    if (total > 0) totais.push(total);
  }
  if (totais.length === 0) return 0;
  const s = [...totais].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Frase humana comparando um valor ao salário mínimo anual. */
export function descreverValor(valor: number): string {
  const sm = emSalariosMinimos(valor);
  if (sm < 1) return "menos de um salário mínimo anual";
  if (sm < 10) return `cerca de ${sm.toFixed(1)} salários mínimos anuais`;
  if (sm < 1000) return `o equivalente a ${Math.round(sm)} salários mínimos anuais`;
  return `o equivalente a ${Math.round(sm).toLocaleString("pt-BR")} salários mínimos anuais`;
}