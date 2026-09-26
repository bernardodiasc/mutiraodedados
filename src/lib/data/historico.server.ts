/**
 * Gravação da linha de rodada no Histórico (`importacoes`). Server-only.
 *
 * Nunca lança: o registro do histórico não pode derrubar uma importação que
 * já gravou dados. Falha aqui vira aviso no retorno da rodada.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { TablesInsert } from "@/integrations/supabase/types";
import type { ResultadoRodada } from "@/lib/data/runner";
import { montarLinhaRodada, type MetaRodada } from "@/lib/data/historico-rodada";

/**
 * Colunas que chegam ao banco por migration própria, em grupos: as de gatilho
 * e execução, e as métricas de desempenho da rodada.
 */
const COLUNAS_POR_MIGRATION = [
  ["gatilho", "execucao_id", "conferencia"],
  ["duracao_ms", "itens_processados", "subrequisicoes", "motivo_parada"],
] as const;

type Linha = TablesInsert<"importacoes">;

/**
 * Insere linhas em `importacoes`. Devolve a mensagem de erro, ou `null`.
 *
 * Se o banco ainda não tem as colunas de um grupo (o código chegou antes da
 * migration), grava de novo sem esse grupo, e assim por diante: perder uma
 * métrica ou o gatilho por um tempo é melhor que perder a linha da rodada,
 * que também marca a cobertura. Só o grupo que falta sai — sem as métricas, a
 * execução continua gravada, e a conferência da ferramenta depende dela.
 */
export async function inserirImportacoes(linhas: Linha | Linha[]): Promise<string | null> {
  let atuais = linhas;
  const restantes: Array<readonly string[]> = [...COLUNAS_POR_MIGRATION];
  for (;;) {
    const { error } = await supabaseAdmin.from("importacoes").insert(atuais);
    if (!error) return null;
    const grupo =
      error.code === "PGRST204"
        ? restantes.find((g) => g.some((c) => error.message.includes(`'${c}'`)))
        : undefined;
    if (!grupo) return error.message;
    restantes.splice(restantes.indexOf(grupo), 1);
    const semGrupo = (l: Linha) => {
      const copia: Record<string, unknown> = { ...l };
      for (const c of grupo) delete copia[c];
      return copia as Linha;
    };
    atuais = Array.isArray(atuais) ? atuais.map(semGrupo) : semGrupo(atuais);
  }
}

export async function registrarRodadaImportacao(
  meta: MetaRodada,
  rodada: ResultadoRodada,
): Promise<string | null> {
  const linha = montarLinhaRodada(meta, rodada);
  const erro = await inserirImportacoes({
    ...linha,
    consultado_em: new Date().toISOString(),
  });
  return erro ? `historico: ${erro}` : null;
}
