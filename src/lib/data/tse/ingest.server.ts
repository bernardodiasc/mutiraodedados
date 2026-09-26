/**
 * Motor de ingestão da fonte TSE — roda SÓ no servidor (usa supabaseAdmin).
 * Carregado pelos handlers de ingest.functions.ts via `await import`.
 *
 * Mecânica (análoga à varredura CGU, adaptada a arquivo em vez de paginação):
 * cada invocação processa UM (tipo de arquivo, ano, UF) — limite de tempo do
 * Worker — em streaming direto do zip do CDN (HTTP Range; nunca baixamos o
 * zip inteiro nem guardamos CSV em disco). Progresso retomável por contagem
 * de linhas em `tse_varredura`; upserts idempotentes em lotes de 200.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { mensagemColunaAusente } from "@/lib/data/erros-banco";
import { selectAll } from "@/lib/data/select-all";
import {
  abrirEntradaZip,
  encontrarEntrada,
  lerLinhasCsv,
  listarEntradasZip,
} from "@/lib/data/ckan/client";
import {
  combinacaoValida,
  montarChaveTse,
  nomeEntradaTse,
  urlZipTse,
  type TseTipoArquivo,
} from "@/lib/data/tse/client-ckan";
import {
  IndiceCabecalho,
  mapearBem,
  mapearCandidato,
  mapearDespesa,
  mapearReceita,
  mapearResultado,
  type TseResultadoRow,
} from "@/lib/data/tse/parsers";
import { regrasQualidadeTse } from "@/lib/data/tse/qualidade";
import { flagQA } from "@/lib/data/qa";
import { sanitizarTextoPublico } from "@/lib/sanitize";
import { inserirImportacoes } from "@/lib/data/historico.server";
import { ehPeriodoRecente, gatilhoPadrao, type OrigemRodada } from "@/lib/data/historico-rodada";
import { classificarResultado } from "@/lib/data/resultado-rodada";
import type { Checkpoint } from "@/lib/data/runner";

export type TseRodada = {
  chave: string;
  importados: number;
  linhasProcessadas: number;
  /** Importados somando todas as rodadas da varredura (`tse_varredura.importados`). */
  totalAcumulado: number;
  completa: boolean;
  haMais: boolean;
  erros: string[];
};

const LOTE = 200;

export async function ensureAdmin(userId: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error("Falha ao verificar permissão.");
  if (data?.role !== "admin") throw new Error("Acesso restrito: somente administradores.");
}

async function lerVarredura(
  chave: string,
): Promise<{ linhas: number; importados: number; completa: boolean }> {
  const { data } = await supabaseAdmin
    .from("tse_varredura")
    .select("linhas_processadas, importados, completa")
    .eq("chave", chave)
    .maybeSingle();
  return {
    linhas: Number(data?.linhas_processadas ?? 0),
    importados: Number(data?.importados ?? 0),
    completa: !!data?.completa,
  };
}

/**
 * A varredura do TSE vista como {@link Checkpoint}: o cursor é a linha de
 * dados em que parou e o total, os importados. É o que o modo nomeado lê para
 * saber se a janela já está completa.
 */
export const checkpointTse: Checkpoint = {
  ler: async (chave) => {
    const { data } = await supabaseAdmin
      .from("tse_varredura")
      .select("linhas_processadas, importados, completa")
      .eq("chave", chave)
      .maybeSingle();
    if (!data) return null;
    return {
      cursor: Number(data.linhas_processadas ?? 0),
      total: Number(data.importados ?? 0),
      completa: !!data.completa,
    };
  },
  salvar: async (chave, estado) => {
    await persistirVarredura(chave, estado.cursor, estado.total, estado.completa);
    return { persistido: true, erro: null };
  },
};

async function persistirVarredura(
  chave: string,
  linhas: number,
  importados: number,
  completa: boolean,
): Promise<void> {
  await supabaseAdmin.from("tse_varredura").upsert({
    chave,
    linhas_processadas: linhas,
    importados,
    completa,
    atualizado_em: new Date().toISOString(),
  });
}

type TabelaTse =
  | "tse_candidatos_cache"
  | "tse_bens_candidato_cache"
  | "tse_receitas_campanha_cache"
  | "tse_despesas_campanha_cache"
  | "tse_resultados_cache";

const TABELA_POR_TIPO: Record<TseTipoArquivo, TabelaTse> = {
  candidatos: "tse_candidatos_cache",
  bens: "tse_bens_candidato_cache",
  receitas: "tse_receitas_campanha_cache",
  despesas: "tse_despesas_campanha_cache",
  resultados: "tse_resultados_cache",
};

async function upsertLote(
  tabela: TabelaTse,
  rows: Record<string, unknown>[],
  erros: string[],
): Promise<number> {
  let ok = 0;
  for (let i = 0; i < rows.length; i += LOTE) {
    const slice = rows.slice(i, i + LOTE);
    const { error } = await supabaseAdmin.from(tabela).upsert(slice as never[]);
    if (error)
      erros.push(mensagemColunaAusente(tabela, error.message) ?? `${tabela}: ${error.message}`);
    else ok += slice.length;
  }
  return ok;
}

/**
 * Processa um chunk (tipo, ano, uf). `orcamentoMs` limita a rodada; quando
 * estoura, salva o progresso e devolve `haMais=true` (a UI re-dispara).
 *
 * Resultados e candidatos são a exceção da retomada: precisam do arquivo
 * inteiro numa rodada (resultados soma zonas por município; candidatos
 * deduplicam por candidato mantendo o turno final). Rodada interrompida
 * recomeça do zero — inócuo, porque o upsert substitui pela chave natural.
 * Ambos os arquivos são limitados por UF e cabem numa rodada.
 *
 * `userId` nulo = rodada sem operador (a ferramenta, pelo modo nomeado de
 * `/api/cron-importar`); `origem` diz o gatilho e a execução. Falha ao ler o
 * arquivo não lança: a rodada é gravada no Histórico com o erro (o
 * `resultado` separa falha da origem de falha nossa), a varredura fica onde
 * estava e a rodada termina com `haMais` falso — quem chama decide se tenta
 * de novo, e a tentativa seguinte retoma do mesmo ponto.
 */
export async function sincronizarArquivoTse(args: {
  tipo: TseTipoArquivo;
  ano: number;
  uf: string;
  userId: string | null;
  orcamentoMs?: number;
  reprocessar?: boolean;
  origem?: OrigemRodada;
}): Promise<TseRodada> {
  const { tipo, ano, uf, userId } = args;
  const origem = args.origem ?? {};
  const orcamentoMs = args.orcamentoMs ?? 150_000;
  const chave = montarChaveTse(tipo, ano, uf);
  const erros: string[] = [];
  const inicio = Date.now();

  if (!combinacaoValida(tipo, ano, uf)) {
    await persistirVarredura(chave, 0, 0, true);
    return {
      chave,
      importados: 0,
      linhasProcessadas: 0,
      totalAcumulado: 0,
      completa: true,
      haMais: false,
      erros,
    };
  }

  const estado = await lerVarredura(chave);
  if (estado.completa && !args.reprocessar) {
    return {
      chave,
      importados: 0,
      linhasProcessadas: estado.linhas,
      totalAcumulado: estado.importados,
      completa: true,
      haMais: false,
      erros,
    };
  }
  // Resultados e candidatos sempre recomeçam (agregação/dedupe precisa do
  // arquivo inteiro).
  const linhasJaProcessadas =
    tipo === "resultados" || tipo === "candidatos" || args.reprocessar ? 0 : estado.linhas;
  let importadosAcum = args.reprocessar ? 0 : estado.importados;
  const log = { tipo, ano, uf, userId, origem };

  try {
    return await lerArquivo();
  } catch (e) {
    // A varredura não avança: o que esta rodada gravou é refeito na próxima
    // (upsert idempotente).
    const mensagem = (e as Error).message;
    erros.push(mensagem);
    await logRodada({ ...log, importados: 0, totalBruto: 0, erros });
    return {
      chave,
      importados: 0,
      linhasProcessadas: estado.linhas,
      totalAcumulado: estado.importados,
      completa: false,
      haMais: false,
      erros,
    };
  }

  async function lerArquivo(): Promise<TseRodada> {
    const url = urlZipTse(tipo, ano);
    const entradas = await listarEntradasZip(url);
    const alvo = encontrarEntrada(entradas, nomeEntradaTse(tipo, ano, uf));
    if (!alvo) {
      // Ausência do arquivo na origem: não é erro nosso — completa com zero e
      // deixa rastro (a lacuna serie_historica_incompleta cuida da distinção).
      await persistirVarredura(chave, 0, importadosAcum, true);
      await logRodada({
        ...log,
        importados: 0,
        totalBruto: 0,
        erros: [
          `info: arquivo ${nomeEntradaTse(tipo, ano, uf)} não existe em ${url} (ausência na origem)`,
        ],
      });
      return {
        chave,
        importados: 0,
        linhasProcessadas: 0,
        totalAcumulado: importadosAcum,
        completa: true,
        haMais: false,
        erros,
      };
    }

    const stream = await abrirEntradaZip(url, alvo);
    const tabela = TABELA_POR_TIPO[tipo];

    let idx: IndiceCabecalho | null = null;
    let linha = 0; // linhas de DADOS vistas (não conta o cabeçalho)
    let importadosRodada = 0;
    let pendentes: Record<string, unknown>[] = [];
    let orcamentoEsgotado = false;

    // Agregadores específicos
    const resultadosPorChave = new Map<string, TseResultadoRow>();
    const candidatosComBens = new Set<string>(); // valor > 0 nesta rodada
    // Candidatos: dedupe por sq_candidato mantendo o turno mais alto. Em eleições
    // com 2º turno o mesmo candidato aparece em 2 linhas (turno 1 e 2) e a linha
    // do turno final carrega a situacao_totalizacao definitiva (ex.: "Eleito").
    // Sem isso, as duas linhas caem no mesmo lote de upsert e o Postgres recusa
    // ("ON CONFLICT DO UPDATE command cannot affect row a second time").
    const candidatosPorChave = new Map<string, Record<string, unknown>>();

    const flush = async () => {
      if (pendentes.length === 0) return;
      const rows = pendentes;
      pendentes = [];
      try {
        await flagQA(regrasQualidadeTse(tipo, rows as never, ano));
      } catch (e) {
        erros.push(`qa: ${(e as Error).message}`);
      }
      importadosRodada += await upsertLote(tabela, rows, erros);
    };

    for await (const campos of lerLinhasCsv(stream)) {
      if (!idx) {
        idx = new IndiceCabecalho(campos);
        continue;
      }
      linha++;
      if (linha <= linhasJaProcessadas) continue; // retomada: pula o já feito
      if (Date.now() - inicio > orcamentoMs && tipo !== "resultados" && tipo !== "candidatos") {
        // A linha atual ainda não foi lida: fica para a próxima rodada.
        linha--;
        orcamentoEsgotado = true;
        break;
      }

      switch (tipo) {
        case "candidatos": {
          const r = mapearCandidato(idx, campos);
          if (r) {
            const anterior = candidatosPorChave.get(r.sq_candidato) as
              | { nr_turno?: number }
              | undefined;
            if (!anterior || r.nr_turno >= (anterior.nr_turno ?? 1)) {
              candidatosPorChave.set(r.sq_candidato, {
                ...r,
                ocupacao: r.ocupacao && sanitizarTextoPublico(r.ocupacao),
              });
            }
          }
          break;
        }
        case "bens": {
          const r = mapearBem(idx, campos);
          if (r) {
            pendentes.push({ ...r, descricao: r.descricao && sanitizarTextoPublico(r.descricao) });
            if (r.valor && r.valor > 0) candidatosComBens.add(r.sq_candidato);
          }
          break;
        }
        case "receitas": {
          const r = mapearReceita(idx, campos, ano);
          if (r) {
            pendentes.push({
              ...r,
              nome_doador: r.nome_doador && sanitizarTextoPublico(r.nome_doador),
            });
          }
          break;
        }
        case "despesas": {
          const r = mapearDespesa(idx, campos, ano);
          if (r) {
            pendentes.push({
              ...r,
              descricao: r.descricao && sanitizarTextoPublico(r.descricao),
            });
          }
          break;
        }
        case "resultados": {
          const r = mapearResultado(idx, campos);
          if (r) {
            const k = `${r.sq_candidato}|${r.nr_turno}|${r.municipio_cod}`;
            const atual = resultadosPorChave.get(k);
            if (atual) {
              atual.votos_nominais += r.votos_nominais;
              atual.votos_nominais_validos += r.votos_nominais_validos;
            } else {
              resultadosPorChave.set(k, { ...r });
            }
          }
          break;
        }
      }

      if (pendentes.length >= LOTE) await flush();
    }

    if (tipo === "resultados") {
      pendentes = [...resultadosPorChave.values()] as unknown as Record<string, unknown>[];
      await flush();
    } else if (tipo === "candidatos") {
      pendentes = [...candidatosPorChave.values()];
      await flush();
    } else {
      await flush();
    }

    // Bens: agrega o total declarado na ficha do candidato (padrão do plano:
    // bens_total_declarado vive em tse_candidatos_cache). O total é recalculado
    // a partir de tse_bens_candidato_cache para os candidatos tocados nesta
    // rodada — a soma só da rodada perderia os bens lidos em rodadas anteriores
    // quando a importação é retomada, e somar ao valor gravado duplicaria numa
    // reimportação.
    if (tipo === "bens" && candidatosComBens.size > 0) {
      const totais = await totaisBensDoCache([...candidatosComBens], ano, erros);
      for (const [sq, total] of totais) {
        const { error } = await supabaseAdmin
          .from("tse_candidatos_cache")
          .update({ bens_total_declarado: total })
          .eq("sq_candidato", sq)
          .eq("ano_eleicao", ano);
        if (error) {
          erros.push(`bens_total ${sq}: ${error.message}`);
          break; // erro estrutural — não repete para todos
        }
      }
    }

    const completa = !orcamentoEsgotado;
    importadosAcum += importadosRodada;
    await persistirVarredura(chave, linha, importadosAcum, completa);
    await logRodada({
      ...log,
      importados: importadosRodada,
      totalBruto: linha - linhasJaProcessadas,
      erros: [
        ...erros,
        ...(completa
          ? []
          : [`info: rodada parcial (linha ${linha}) — tempo esgotado; continue para retomar.`]),
      ],
    });

    return {
      chave,
      importados: importadosRodada,
      linhasProcessadas: linha,
      totalAcumulado: importadosAcum,
      completa,
      haMais: !completa,
      erros,
    };
  }
}

/**
 * Soma dos bens com valor positivo gravados no cache, por candidato. Em caso
 * de erro devolve vazio: melhor não gravar total nenhum do que um parcial.
 */
async function totaisBensDoCache(
  sqs: string[],
  ano: number,
  erros: string[],
): Promise<Map<string, number>> {
  const totais = new Map<string, number>();
  try {
    for (let i = 0; i < sqs.length; i += 100) {
      const grupo = sqs.slice(i, i + 100);
      const bens = await selectAll<{ sq_candidato: string; valor: number | null }>(() =>
        supabaseAdmin
          .from("tse_bens_candidato_cache")
          .select("sq_candidato, valor")
          .eq("ano_eleicao", ano)
          .in("sq_candidato", grupo)
          .gt("valor", 0)
          .order("sq_candidato")
          .order("ordem_bem"),
      );
      for (const b of bens) {
        totais.set(b.sq_candidato, (totais.get(b.sq_candidato) ?? 0) + Number(b.valor));
      }
    }
  } catch (e) {
    erros.push(`bens_total: ${(e as Error).message}`);
    return new Map();
  }
  return totais;
}

/**
 * A linha de rodada no Histórico. `mes` 1 é a âncora da janela anual (a
 * eleição), como nas demais fontes anuais; `resultado` segue a classificação
 * de `resultado-rodada.ts`, com os avisos `info:` fora da conta.
 */
async function logRodada(args: {
  tipo: TseTipoArquivo;
  ano: number;
  uf: string;
  userId: string | null;
  origem: OrigemRodada;
  importados: number;
  totalBruto: number;
  erros: string[];
}): Promise<void> {
  await inserirImportacoes({
    fonte: `tse_${args.tipo}`,
    orgao_cod: null,
    escopo: `${args.ano}-${args.uf}`,
    ano: args.ano,
    mes: 1,
    data_inicial: `${args.ano}-01-01`,
    data_final: `${args.ano}-12-31`,
    total_bruto: args.totalBruto,
    importados: args.importados,
    erros: args.erros,
    consultado_em: new Date().toISOString(),
    endpoint: `GET ${urlZipTse(args.tipo, args.ano)} (${nomeEntradaTse(args.tipo, args.ano, args.uf)})`,
    user_id: args.userId,
    gatilho: args.origem.gatilho ?? gatilhoPadrao(args.userId),
    execucao_id: args.origem.execucaoId ?? null,
    resultado: classificarResultado({
      importados: args.importados,
      erros: args.erros.filter((e) => !e.startsWith("info:")),
      // A eleição do ano corrente ainda está sendo publicada: zero é espera.
      periodoRecente: ehPeriodoRecente(args.ano, 12),
    }),
  });
}

/** Progresso por (tipo, ano): UFs completas/pendentes — alimenta a aba TSE do admin. */
export async function progressoTse(): Promise<
  Array<{
    chave: string;
    linhas: number;
    importados: number;
    completa: boolean;
    atualizadoEm: string;
  }>
> {
  const { data, error } = await supabaseAdmin
    .from("tse_varredura")
    .select("chave, linhas_processadas, importados, completa, atualizado_em")
    .order("chave");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    chave: r.chave,
    linhas: Number(r.linhas_processadas),
    importados: Number(r.importados),
    completa: r.completa,
    atualizadoEm: r.atualizado_em,
  }));
}
