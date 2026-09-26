/**
 * Linha de rodada no Histórico para as tarefas cujo núcleo não grava a sua:
 * o vínculo parlamentar↔candidato e os cruzamentos. A conferência da janela
 * lê as linhas do `execucao_id` — sem ela, a janela seria reprovada por não
 * ter rodada registrada. `resultado` segue `resultado-rodada.ts`, com os
 * avisos `info:` fora da conta.
 */
import { inserirImportacoes } from "@/lib/data/historico.server";
import { classificarResultado } from "@/lib/data/resultado-rodada";
import type { OrigemRodada } from "@/lib/data/historico-rodada";

export async function registrarRodadaAvulsa(linha: {
  fonte: string;
  escopo: string;
  ano: number | null;
  mes: number | null;
  /** O que a rodada produziu (vínculos, findings). */
  importados: number;
  /** O que a rodada percorreu (parlamentares, candidatos avaliados). */
  processados: number;
  erros: string[];
  endpoint: string;
  origem: OrigemRodada;
}): Promise<string | null> {
  const erro = await inserirImportacoes({
    fonte: linha.fonte,
    escopo: linha.escopo,
    ano: linha.ano,
    mes: linha.mes,
    total_bruto: linha.processados,
    importados: linha.importados,
    erros: linha.erros,
    endpoint: linha.endpoint,
    user_id: null,
    gatilho: linha.origem.gatilho ?? "ferramenta",
    execucao_id: linha.origem.execucaoId ?? null,
    resultado: classificarResultado({
      importados: linha.processados,
      erros: linha.erros.filter((e) => !e.startsWith("info:")),
    }),
    consultado_em: new Date().toISOString(),
  });
  return erro ? `historico: ${erro}` : null;
}
