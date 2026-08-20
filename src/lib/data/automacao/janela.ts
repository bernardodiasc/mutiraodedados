/**
 * Janelas que o agendador usa — puro, testável.
 *
 * O tique roda sem operador, então "qual mês importar" não pode depender de
 * um seletor na tela: é sempre o mês CORRENTE em UTC (as fontes publicam com
 * dias de atraso; o mês anterior já foi varrido nos tiques daquele mês, e a
 * classificação de resultado sabe ler zero de período recente).
 */
export function janelaDoMesCorrente(agora: Date): {
  ano: number;
  mes: number;
  dataInicial: string;
  dataFinal: string;
} {
  const ano = agora.getUTCFullYear();
  const mes = agora.getUTCMonth() + 1;
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const mm = String(mes).padStart(2, "0");
  return {
    ano,
    mes,
    dataInicial: `${ano}-${mm}-01`,
    dataFinal: `${ano}-${mm}-${String(ultimo).padStart(2, "0")}`,
  };
}

/** Resumo de uma rodada para a coluna `ultimo_resultado` (curto, legível). */
export function resumoDoTique(r: {
  importados?: number;
  haMais?: boolean;
  erros?: number;
}): string {
  const partes = [`${r.importados ?? 0} importados`];
  if (r.haMais) partes.push("há mais");
  if (r.erros) partes.push(`${r.erros} erro(s)`);
  return partes.join(" · ");
}
