/**
 * Classificação do resultado de uma rodada de importação.
 *
 * `importados = 0` cobria cinco situações muito diferentes, e o Histórico não
 * distinguia nenhuma: quem operava não sabia se o zero era erro, ausência
 * legítima, período ainda não publicado ou fonte quebrada. Na prática, o PNCP
 * passou meses devolvendo 404 e aparecendo como "0 sem erro".
 *
 * A informação para separá-las já existe no momento da chamada — só estava
 * sendo descartada antes de chegar ao log.
 */
import type { ResultadoRodada } from "@/lib/data/runner";

export const RESULTADOS = [
  "com_dados",
  "sem_dados",
  "nao_publicado",
  "fora_da_janela",
  "erro_origem",
  "erro_nosso",
] as const;

export type ResultadoClassificado = (typeof RESULTADOS)[number];

export const ROTULO_RESULTADO: Record<ResultadoClassificado, string> = {
  com_dados: "Importou",
  sem_dados: "Consultado, sem dados",
  nao_publicado: "Ainda não publicado",
  fora_da_janela: "Fora da janela da fonte",
  erro_origem: "Falha na origem",
  erro_nosso: "Falha nossa",
};

export const EXPLICACAO_RESULTADO: Record<ResultadoClassificado, string> = {
  com_dados: "A rodada trouxe registros.",
  sem_dados: "A origem respondeu normalmente e não havia nada no período. Não precisa reconsultar.",
  nao_publicado:
    "A origem não tem esse período ainda (404 ou vazio em período recente). Vale reconsultar mais tarde.",
  fora_da_janela: "O período é anterior ao início da fonte — nunca vai existir.",
  erro_origem: "A origem falhou (indisponível, timeout, 5xx). Vale tentar de novo.",
  erro_nosso: "Falha do nosso lado (endpoint errado, parse, banco). Precisa de correção no código.",
};

/** Rodada que precisa de ação de quem opera. */
export function exigeAtencao(r: ResultadoClassificado): boolean {
  return r === "erro_origem" || r === "erro_nosso";
}

/**
 * Erros que denunciam defeito NOSSO, não da origem. Um 404 numa URL que
 * montamos é endpoint errado; 401/403 é credencial; parse e banco somos nós.
 */
function pareceErroNosso(erros: readonly string[]): boolean {
  const txt = erros.join(" ").toLowerCase();
  return /\b40[134]\b|json inválido|não-json|parse|db:|invalid input|violates|constraint/.test(txt);
}

function pareceErroDeOrigem(erros: readonly string[]): boolean {
  const txt = erros.join(" ");
  return /TRANSIENT:|timeout|\b5\d{2}\b|\b429\b/i.test(txt);
}

export type ContextoClassificacao = {
  /** Registros importados na rodada. */
  importados: number;
  erros: readonly string[];
  /** O período pedido é anterior ao início da fonte? (de `janelas.ts`) */
  foraDaJanela?: boolean;
  /**
   * O período pedido ainda está aberto ou é muito recente para a origem já ter
   * publicado. Um zero aqui é espera, não ausência definitiva.
   */
  periodoRecente?: boolean;
};

/**
 * Classifica a rodada. A ordem importa: um erro nosso mascarado de zero é o
 * caso que mais confundiu, então erro vem antes de qualquer leitura de "vazio".
 */
export function classificarResultado(ctx: ContextoClassificacao): ResultadoClassificado {
  if (ctx.foraDaJanela) return "fora_da_janela";
  if (ctx.erros.length > 0) {
    if (pareceErroNosso(ctx.erros)) return "erro_nosso";
    if (pareceErroDeOrigem(ctx.erros)) return "erro_origem";
    // Erro que não sabemos atribuir conta como nosso: melhor investigar à toa
    // do que deixar passar defeito silencioso.
    return "erro_nosso";
  }
  if (ctx.importados > 0) return "com_dados";
  return ctx.periodoRecente ? "nao_publicado" : "sem_dados";
}

/** Classifica a partir do resultado do runner, sem repetir a montagem do contexto. */
export function classificarRodada(
  rodada: Pick<ResultadoRodada, "processados" | "erros">,
  extra: Omit<ContextoClassificacao, "importados" | "erros"> = {},
): ResultadoClassificado {
  return classificarResultado({
    importados: rodada.processados,
    erros: rodada.erros,
    ...extra,
  });
}
