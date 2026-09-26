/**
 * Conferência da janela — leitura do banco e gravação. Server-only.
 *
 * As regras ficam em `conferencia.ts` (lógica pura); aqui só se juntam as
 * entradas: as linhas de rodada da execução, a contagem da célula da janela
 * no cache e as conferências já gravadas de uma fonte.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import {
  conferirJanela,
  type Conferencia,
  type ConferenciaGravada,
  type EntradaConferencia,
  type RodadaDaExecucao,
} from "@/lib/data/automacao/conferencia";
import { inserirImportacoes } from "@/lib/data/historico.server";
import { textoDoErroDoBanco } from "@/lib/data/erros-banco";

/**
 * Marca, em `importacoes.log_kind`, a linha que só registra uma conferência
 * sem reimportação. Aparece no Histórico (o filtro esconde só `requisicao`),
 * mas não conta como rodada quando outra conferência lê o log da janela.
 */
export const LOG_KIND_CONFERENCIA = "conferencia";

/** Linhas por página nas leituras de `importacoes` (o teto do PostgREST). */
const PAGINA = 1000;

type LinhaDeRodada = {
  ano: number | null;
  mes: number | null;
  resultado: string | null;
  erros: unknown;
};

const paraRodada = (l: LinhaDeRodada): RodadaDaExecucao => ({
  ano: l.ano,
  mes: l.mes,
  resultado: l.resultado,
  erros: Array.isArray(l.erros) ? l.erros.map(String) : [],
});

/**
 * Confere a janela de uma execução e grava o veredito na linha da última
 * rodada dela. Lança se não conseguir ler ou gravar — a rota responde 500 e
 * a janela continua pendente.
 */
export async function conferirEGravar(
  execucaoId: string,
  entrada: Omit<EntradaConferencia, "rodadas" | "registrosNaCelula">,
  contarNaCelula: (() => Promise<number>) | null,
): Promise<Conferencia> {
  // Em páginas: a varredura do SICONFI grava uma linha por consulta, e uma
  // execução passa das mil linhas que o PostgREST devolve de uma vez — sem
  // paginar, a "última" seria a milésima, não a da rodada final.
  const linhas: (LinhaDeRodada & { id: string })[] = [];
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await supabaseAdmin
      .from("importacoes")
      .select("id, ano, mes, resultado, erros")
      .eq("execucao_id", execucaoId)
      .is("log_kind", null)
      .order("consultado_em", { ascending: true })
      .range(de, de + PAGINA - 1);
    if (error) throw new Error(`conferência: leitura das rodadas: ${error.message}`);
    linhas.push(...(data ?? []));
    if ((data ?? []).length < PAGINA) break;
  }

  const rodadas = linhas.map(paraRodada);
  const conferencia = conferirJanela({
    ...entrada,
    rodadas,
    registrosNaCelula: contarNaCelula ? await contarNaCelula() : null,
  });

  const ultima = linhas[linhas.length - 1];
  if (ultima) {
    const { error: erroGravacao } = await supabaseAdmin
      .from("importacoes")
      .update({ conferencia: conferencia as unknown as Json })
      .eq("id", ultima.id);
    if (erroGravacao) throw new Error(`conferência: gravação: ${erroGravacao.message}`);
  }
  return conferencia;
}

/**
 * A última conferência gravada de uma janela da fonte, ou `null`. `escopo`
 * restringe à linha da matriz (órgão, ente) nas fontes que têm várias;
 * omitido, vale qualquer linha. Sem janela (cadastro), a última da fonte.
 */
export async function ultimaConferenciaDaJanela(
  fonte: string,
  janela: { ano: number; mes: number } | null,
  escopo?: string,
): Promise<Pick<Conferencia, "estado" | "motivo"> | null> {
  let consulta = supabaseAdmin.from("importacoes").select("conferencia").eq("fonte", fonte);
  if (janela) consulta = consulta.eq("ano", janela.ano).eq("mes", janela.mes);
  if (escopo !== undefined) consulta = consulta.eq("escopo", escopo);
  const { data, error } = await consulta
    .not("conferencia", "is", null)
    .order("consultado_em", { ascending: false })
    .limit(1);
  if (error) throw new Error(`conferência: leitura da última: ${error.message}`);
  const c = data?.[0]?.conferencia as Pick<Conferencia, "estado" | "motivo"> | undefined;
  return c?.estado ? c : null;
}

/** Rodadas antigas lidas, no máximo, por conferência sem reimportação. */
const RODADAS_ANTIGAS = 200;

/**
 * Confere uma janela que a varredura já dá como completa, sem reimportar, e
 * grava o veredito numa linha nova (`gatilho = ferramenta`, o `execucao_id`
 * da chamada, `log_kind = conferencia`). As rodadas antigas não têm
 * `execucao_id`: são achadas por fonte + ano/mês, como a cobertura casa as
 * tentativas; no cadastro (sem janela), pela fonte. Falha ao buscar o total
 * na origem não lança — vira inconclusiva. Lança se não conseguir ler ou
 * gravar no banco.
 */
export async function conferirSemReimportar(opts: {
  fonte: string;
  /** Linha da matriz (órgão, ente); omitido, as rodadas de qualquer linha e a nova com "". */
  escopo?: string;
  execucaoId: string;
  entrada: Pick<EntradaConferencia, "janela" | "acumulado" | "recente" | "findingsNovos">;
  totalDaOrigem: () => Promise<{ total: number; descartados: number } | null>;
  /** `null` = fonte sem célula no tempo (cadastro). */
  contarNaCelula: (() => Promise<number>) | null;
  descricao: string;
}): Promise<Conferencia> {
  const { fonte, escopo, execucaoId, entrada } = opts;
  let consulta = supabaseAdmin
    .from("importacoes")
    .select("ano, mes, resultado, erros")
    .eq("fonte", fonte);
  if (entrada.janela) {
    consulta = consulta.eq("ano", entrada.janela.ano).eq("mes", entrada.janela.mes);
  }
  if (escopo !== undefined) consulta = consulta.eq("escopo", escopo);
  const { data: linhas, error } = await consulta
    .is("log_kind", null)
    .order("consultado_em", { ascending: false })
    .limit(RODADAS_ANTIGAS);
  if (error) throw new Error(`conferência: leitura das rodadas da janela: ${error.message}`);

  let origem: { total: number; descartados: number } | null = null;
  let falhaAoConsultarOrigem: string | null = null;
  try {
    origem = await opts.totalDaOrigem();
  } catch (e) {
    falhaAoConsultarOrigem = (e as Error).message;
  }

  const conferencia = conferirJanela({
    ...entrada,
    terminou: true,
    semReimportacao: true,
    rodadas: (linhas ?? []).map(paraRodada).reverse(),
    origem,
    falhaAoConsultarOrigem,
    registrosNaCelula: opts.contarNaCelula ? await opts.contarNaCelula() : null,
  });

  const erro = await inserirImportacoes({
    fonte,
    escopo: escopo ?? "",
    ano: entrada.janela?.ano ?? null,
    mes: entrada.janela?.mes ?? null,
    total_bruto: 0,
    importados: 0,
    erros: [],
    endpoint: `${opts.descricao} (conferência sem reimportação: a janela já estava completa)`,
    user_id: null,
    gatilho: "ferramenta",
    execucao_id: execucaoId,
    log_kind: LOG_KIND_CONFERENCIA,
    conferencia: conferencia as unknown as Json,
    consultado_em: new Date().toISOString(),
  });
  if (erro) throw new Error(`conferência: gravação: ${erro}`);
  return conferencia;
}

/** Registros de uma tabela de cache com a coluna de data dentro da janela. */
export async function contarRegistrosNaJanela(
  tabela: "camara_votacoes_cache" | "senado_votacoes_cache",
  janela: { dataInicio: string; dataFim: string },
): Promise<number> {
  const { count, error, status } = await supabaseAdmin
    .from(tabela)
    .select("id", { count: "exact" })
    .gte("data", janela.dataInicio)
    .lte("data", janela.dataFim)
    .limit(0);
  if (error)
    throw new Error(`conferência: contagem em ${tabela}: ${textoDoErroDoBanco(error, status)}`);
  return count ?? 0;
}

/**
 * Recorte das conferências de uma fonte. Um texto é o `escopo` exato — a
 * linha da matriz (órgão, ente). O objeto recorta também pelo ente consultado
 * (`orgao_cod`) e pelo começo do `escopo`: o SICONFI grava o relatório no
 * escopo e o ente em `orgao_cod`.
 */
export type FiltroConferencias = { escopo?: string; orgaoCod?: string; escopoComeca?: string };

/**
 * Todas as conferências gravadas de uma fonte, para calcular as pendentes.
 * Sem recorte, vale qualquer linha.
 */
export async function lerConferencias(
  fonte: string,
  recorte?: string | FiltroConferencias,
): Promise<ConferenciaGravada[]> {
  const filtro: FiltroConferencias =
    typeof recorte === "string" ? { escopo: recorte } : (recorte ?? {});
  const todas: ConferenciaGravada[] = [];
  for (let de = 0; ; de += PAGINA) {
    let consulta = supabaseAdmin
      .from("importacoes")
      .select("ano, mes, escopo, conferencia, execucao_id, consultado_em")
      .eq("fonte", fonte);
    if (filtro.escopo !== undefined) consulta = consulta.eq("escopo", filtro.escopo);
    if (filtro.orgaoCod) consulta = consulta.eq("orgao_cod", filtro.orgaoCod);
    if (filtro.escopoComeca) consulta = consulta.like("escopo", `${filtro.escopoComeca}%`);
    const { data, error } = await consulta
      .not("conferencia", "is", null)
      .order("consultado_em", { ascending: false })
      .range(de, de + PAGINA - 1);
    if (error) throw new Error(`pendentes: ${error.message}`);
    for (const l of data ?? []) {
      const c = l.conferencia as { estado?: string; motivo?: string } | null;
      if (!c?.estado) continue;
      todas.push({
        ano: l.ano,
        mes: l.mes,
        escopo: l.escopo ?? "",
        estado: c.estado as ConferenciaGravada["estado"],
        motivo: c.motivo ?? "",
        execucao_id: l.execucao_id,
        consultado_em: l.consultado_em,
      });
    }
    if ((data ?? []).length < PAGINA) return todas;
  }
}
