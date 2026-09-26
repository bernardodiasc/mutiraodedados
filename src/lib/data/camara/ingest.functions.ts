import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sanitizarTextoPublico } from "@/lib/sanitize";
import { regrasCamaraCeap, flagQA } from "@/lib/data/qa";
import { rodarComOrcamento } from "@/lib/data/runner";
import { checkpointImportacao } from "@/lib/data/checkpoint.server";
import { PREFIXO_TRANSITORIO, ehErroTransitorio, reacaoAoErro } from "@/lib/data/erro-origem";
import { registrarRodadaImportacao, inserirImportacoes } from "@/lib/data/historico.server";
import {
  CEAP_ORCAMENTO_MS,
  CEAP_TETO_SUBREQUISICOES,
  chaveVarreduraCeap,
  legislaturaDoAno,
  parlamentarNoCursor,
} from "@/lib/data/ceap-varredura";
import { gatilhoPadrao, type OrigemRodada } from "@/lib/data/historico-rodada";
import { classificarResultado } from "@/lib/data/resultado-rodada";
import { totalDoHeader } from "@/lib/data/camara/votacoes-api";

const BASE = "https://dadosabertos.camara.leg.br/api/v2";
const UA = "MutiraoDeDados/1.0 (+https://mutiraodedados.com.br)";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * GET na API da Câmara com retry/backoff. A API fica atrás de um gateway que
 * às vezes devolve 429/5xx transitórios (ex.: 504 do Cloudflare). Repetimos
 * com espera exponencial (500 → 1500 → 4500 ms); 4xx são erros definitivos.
 * Esgotadas as tentativas, a falha sai com `TRANSIENT:`: a varredura para sem
 * avançar (a próxima rodada refaz) e o Histórico registra falha da origem.
 * Devolve também o total da consulta (header `X-Total-Count`).
 */
async function camaraGetComTotal<T = unknown>(
  path: string,
  params: Record<string, string> = {},
  tentativas = 4,
): Promise<{ corpo: T; totalOrigem: number | null }> {
  const qs = new URLSearchParams(params).toString();
  const url = `${BASE}${path}${qs ? `?${qs}` : ""}`;
  let ultimoErro = "sem resposta";
  for (let tent = 0; tent < tentativas; tent++) {
    if (tent > 0) await sleep(500 * 3 ** (tent - 1));
    let res: Response;
    try {
      res = await fetch(url, { headers: { accept: "application/json", "user-agent": UA } });
    } catch (e) {
      ultimoErro = (e as Error).message; // rede → retry
      continue;
    }
    if (res.ok) {
      return {
        corpo: (await res.json()) as T,
        totalOrigem: totalDoHeader(res.headers.get("x-total-count")),
      };
    }
    if (res.status === 429 || res.status >= 500) {
      ultimoErro = `${res.status}`; // transitório → retry
      continue;
    }
    const body = await res.text().catch(() => "");
    throw new Error(`Câmara API ${res.status}: ${body.slice(0, 200)}`); // 4xx definitivo
  }
  throw new Error(
    `${PREFIXO_TRANSITORIO} Câmara API indisponível após ${tentativas} tentativas (último: ${ultimoErro}).`,
  );
}

const camaraGet = async <T = unknown>(path: string, params: Record<string, string> = {}) =>
  (await camaraGetComTotal<T>(path, params)).corpo;

type CamaraEnvelope<T> = { dados: T; links?: Array<{ rel: string; href: string }> };

/**
 * Item de /deputados/{id}/historico: a linha do tempo de entradas/saídas do
 * mandato (posse, licença, afastamento, vacância, reassunção…), com o motivo em
 * `descricaoStatus` e a legislatura de cada evento.
 */
type HistoricoItem = {
  idLegislatura?: number;
  siglaPartido?: string;
  siglaUf?: string;
  dataHora?: string;
  situacao?: string | null;
  condicaoEleitoral?: string | null;
  descricaoStatus?: string;
};

/**
 * Histórico de um deputado. Separa "a origem respondeu lista vazia" de "a
 * consulta falhou": só a resposta autoriza regravar os eventos dele. Retry
 * esgotado (rede, 429, 5xx) sai com `TRANSIENT:`, para a rodada contar como
 * falha da origem e refazer o lote; 4xx e parse ficam como definitivos.
 */
async function historicoDeputado(
  id: number,
): Promise<{ itens: HistoricoItem[] } | { erro: string }> {
  try {
    const j = await camaraGet<CamaraEnvelope<HistoricoItem[]>>(`/deputados/${id}/historico`);
    return { itens: j.dados ?? [] };
  } catch (e) {
    // O prefixo passageiro vai à frente, onde a rodada o procura.
    const msg = (e as Error).message;
    const transitorio = msg.startsWith(PREFIXO_TRANSITORIO);
    const causa = transitorio ? msg.slice(PREFIXO_TRANSITORIO.length).trimStart() : msg;
    return {
      erro: `${transitorio ? `${PREFIXO_TRANSITORIO} ` : ""}histórico do deputado ${id}: ${causa}`,
    };
  }
}

/**
 * Ingere a trajetória (eventos de /historico) de um conjunto de deputados, em
 * lotes paralelos, gravando em `camara_deputado_eventos` (delete+insert por id,
 * idempotente). Devolve a situação ATUAL de cada um (último evento com situação),
 * usada para o roster — assim quem renunciou/faleceu deixa de constar "Exercício".
 * O deputado cuja consulta falhou fica de fora do delete+insert (os eventos
 * gravados continuam) e a falha volta em `erros`.
 */
async function ingerirEventosDeputados(
  ids: number[],
): Promise<{ situacaoAtual: Map<number, string>; erros: string[] }> {
  const situacaoAtual = new Map<number, string>();
  const erros: string[] = [];
  const LOTE = 8;
  const now = new Date().toISOString();
  for (let i = 0; i < ids.length; i += LOTE) {
    const lote = ids.slice(i, i + LOTE);
    const hists = await Promise.all(
      lote.map((id) => historicoDeputado(id).then((h) => [id, h] as const)),
    );
    const rows: Array<{
      deputado_id: number;
      id_legislatura: number | null;
      data_hora: string | null;
      situacao: string | null;
      condicao_eleitoral: string | null;
      sigla_partido: string | null;
      sigla_uf: string | null;
      descricao: string | null;
      updated_at: string;
    }> = [];
    const respondidos: number[] = [];
    for (const [id, r] of hists) {
      if ("erro" in r) {
        erros.push(r.erro);
        continue;
      }
      respondidos.push(id);
      const h = r.itens;
      for (let k = h.length - 1; k >= 0; k--) {
        const s = h[k].situacao;
        if (s) {
          situacaoAtual.set(id, s);
          break;
        }
      }
      for (const e of h) {
        rows.push({
          deputado_id: id,
          id_legislatura: e.idLegislatura ?? null,
          data_hora: e.dataHora ?? null,
          situacao: e.situacao ?? null,
          condicao_eleitoral: e.condicaoEleitoral ?? null,
          sigla_partido: e.siglaPartido ?? null,
          sigla_uf: e.siglaUf ?? null,
          descricao: e.descricaoStatus ?? null,
          updated_at: now,
        });
      }
    }
    // Idempotência: apaga os eventos de quem respondeu e regrava.
    if (respondidos.length === 0) continue;
    const { error: delErr } = await supabaseAdmin
      .from("camara_deputado_eventos")
      .delete()
      .in("deputado_id", respondidos);
    if (delErr) throw new Error(`db eventos: ${delErr.message}`);
    for (let j = 0; j < rows.length; j += 200) {
      const { error } = await supabaseAdmin
        .from("camara_deputado_eventos")
        .insert(rows.slice(j, j + 200));
      if (error) throw new Error(`db eventos: ${error.message}`);
    }
  }
  return { situacaoAtual, erros };
}

async function ensureAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error("Falha ao verificar permissão.");
  if (data?.role !== "admin") throw new Error("Acesso restrito: somente administradores.");
}

/** Legislatura corrente. 2023–2026 = 57. */
export function legislaturaAtualCamara(): number {
  return legislaturaDoAno(new Date().getFullYear());
}
function anoInicioLegislatura(n: number): number {
  return 2003 + (n - 52) * 4;
}

type DepListItem = {
  id: number;
  nome: string;
  siglaPartido?: string;
  siglaUf?: string;
  idLegislatura?: number;
  urlFoto?: string;
  email?: string;
};

/**
 * Núcleo: importa o cadastro de deputados de UMA legislatura — chamada única,
 * sem varredura (cerca de 6 páginas).
 *
 * - Legislatura ATUAL: grava a linha completa do roster (partido/UF/situação).
 * - Legislaturas PASSADAS: grava só a IDENTIDADE no roster (nome/foto/email) para
 *   NÃO sobrescrever o estado atual; partido/UF da legislatura vão para a tabela
 *   filha `camara_deputado_legislaturas` (histórico de mandatos).
 *
 * Sempre registra a rodada em `importacoes`, com `resultado` — inclusive a que
 * falhou, que não lança: o erro volta em `erros`. Devolve também o total da
 * origem (`X-Total-Count` da listagem): a lista repete o deputado que teve
 * mais de um mandato na legislatura (titular e suplente), e as repetições
 * contam como descartadas.
 */
export async function rodadaCadastroCamara(
  data: { idLegislatura?: number },
  userId: string | null,
  origem: OrigemRodada = {},
): Promise<{
  importados: number;
  legislatura: number;
  erros: string[];
  origem: { total: number; descartados: number } | null;
}> {
  const legAlvo = data.idLegislatura ?? legislaturaAtualCamara();
  const all: DepListItem[] = [];
  let totalOrigem: number | null = null;
  let importados = 0;
  const erros: string[] = [];
  try {
    importados = await gravarDeputadosLegislatura(legAlvo, all, (t) => (totalOrigem = t));
  } catch (e) {
    erros.push((e as Error).message);
  }

  const erroHistorico = await inserirImportacoes({
    fonte: "camara_deputados",
    escopo: `legislatura ${legAlvo}`,
    ano: anoInicioLegislatura(legAlvo),
    mes: 1,
    total_bruto: all.length,
    importados,
    erros,
    resultado: classificarResultado({ importados, erros }),
    user_id: userId,
    gatilho: origem.gatilho ?? gatilhoPadrao(userId),
    execucao_id: origem.execucaoId ?? null,
    endpoint: `GET https://dadosabertos.camara.leg.br/api/v2/deputados?idLegislatura=${legAlvo}`,
  });
  if (erroHistorico)
    console.error("[camara_deputados] falha ao registrar importacao", erroHistorico);

  // A anotação desfaz o estreitamento para `null`: quem atribui é a closure.
  const total = totalOrigem as number | null;
  return {
    importados,
    legislatura: legAlvo,
    erros,
    origem:
      total === null || erros.length > 0 ? null : { total, descartados: all.length - importados },
  };
}

/**
 * Busca e grava o roster da legislatura; devolve quantos deputados distintos
 * gravou. `all` recebe a lista crua, com as repetições da origem.
 */
async function gravarDeputadosLegislatura(
  legAlvo: number,
  all: DepListItem[],
  aoLerTotal: (total: number | null) => void,
): Promise<number> {
  const ehAtual = legAlvo === legislaturaAtualCamara();

  const params: Record<string, string> = {
    itens: "100",
    ordem: "ASC",
    ordenarPor: "nome",
    idLegislatura: String(legAlvo),
  };

  let pagina = 1;
  while (pagina < 20) {
    const { corpo: json, totalOrigem } = await camaraGetComTotal<CamaraEnvelope<DepListItem[]>>(
      "/deputados",
      { ...params, pagina: String(pagina) },
    );
    if (pagina === 1) aoLerTotal(totalOrigem);
    const list = json.dados ?? [];
    if (list.length === 0) break;
    all.push(...list);
    if (list.length < 100) break;
    pagina++;
  }

  if (all.length === 0) return 0;

  // A API pode repetir o mesmo deputado (titular + suplente que assumiu) na
  // mesma legislatura; dedupe por id para o upsert não afetar a mesma linha 2x.
  const unicos = [...new Map(all.map((d) => [d.id, d])).values()];

  const now = new Date().toISOString();
  // Roster: completo para a legislatura atual; só identidade para as passadas.
  const rosterRows = unicos.map((d) =>
    ehAtual
      ? {
          id: d.id,
          nome: d.nome,
          nome_civil: null,
          sigla_partido: d.siglaPartido ?? null,
          sigla_uf: d.siglaUf ?? null,
          id_legislatura: d.idLegislatura ?? legAlvo,
          url_foto: d.urlFoto ?? null,
          email: d.email ?? null,
          // Situação real (afastado/vacância/…) vem à parte, por importarTrajetoriaCamara.
          situacao: "Exercício",
          condicao_eleitoral: null,
          updated_at: now,
        }
      : {
          // Legislaturas passadas: só identidade estável, para NÃO sobrescrever
          // foto/email/partido/UF do estado atual do deputado.
          id: d.id,
          nome: d.nome,
          updated_at: now,
        },
  );

  for (let i = 0; i < rosterRows.length; i += 200) {
    const { error } = await supabaseAdmin
      .from("camara_deputados_cache")
      .upsert(rosterRows.slice(i, i + 200));
    if (error) throw new Error(`db: ${error.message}`);
  }

  // Linha-filha: histórico de partido/UF por legislatura.
  const legRows = unicos.map((d) => ({
    deputado_id: d.id,
    id_legislatura: legAlvo,
    sigla_partido: d.siglaPartido ?? null,
    sigla_uf: d.siglaUf ?? null,
    situacao: ehAtual ? "Exercício" : null,
    condicao_eleitoral: null,
    updated_at: now,
  }));
  for (let i = 0; i < legRows.length; i += 200) {
    const { error } = await supabaseAdmin
      .from("camara_deputado_legislaturas")
      .upsert(legRows.slice(i, i + 200));
    if (error) throw new Error(`db: ${error.message}`);
  }

  return unicos.length;
}

/** Casca do painel: o erro da rodada vira exceção, como antes. */
async function ingerirDeputadosLegislatura(
  idLegislatura: number | undefined,
  userId: string,
): Promise<{ importados: number; legislatura: number }> {
  const r = await rodadaCadastroCamara({ idLegislatura }, userId);
  if (r.erros.length > 0) throw new Error(r.erros[0]);
  return { importados: r.importados, legislatura: r.legislatura };
}

/** Importa o cadastro de deputados de uma legislatura (padrão: atual). */
/**
 * Parâmetros do cadastro — fonte única da validação: a casca autenticada e o
 * modo nomeado de `/api/cron-importar` usam este mesmo schema.
 */
export const importarDeputadosSchema = z.object({
  idLegislatura: z.number().int().min(50).max(100).optional(),
});

export const importarDeputados = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => importarDeputadosSchema.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);
    return ingerirDeputadosLegislatura(data.idLegislatura, context.userId);
  });

/** Importa o histórico de deputados de uma FAIXA de legislaturas (inclusive). */
export const importarDeputadosHistorico = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        legIni: z.number().int().min(50).max(100),
        legFim: z.number().int().min(50).max(100),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);
    const ini = Math.min(data.legIni, data.legFim);
    const fim = Math.max(data.legIni, data.legFim);
    let importados = 0;
    const legislaturas: number[] = [];
    const erros: string[] = [];
    for (let n = fim; n >= ini; n--) {
      try {
        const r = await ingerirDeputadosLegislatura(n, context.userId);
        importados += r.importados;
        legislaturas.push(n);
      } catch (e) {
        erros.push(`leg ${n}: ${(e as Error).message}`);
        console.error(`[camara_deputados] legislatura ${n} falhou`, e);
      }
    }
    return { importados, legislaturas, erros };
  });

/**
 * Parâmetros da trajetória — fonte única da validação: a casca autenticada e
 * o modo nomeado de `/api/cron-importar` usam este mesmo schema. Sem
 * legislatura, vale a atual; `offset` é a posição na lista de deputados dela.
 */
export const importarTrajetoriaCamaraSchema = z.object({
  idLegislatura: z.number().int().min(50).max(100).optional(),
  offset: z.number().int().min(0).default(0),
});

/** Deputados por rodada: sub-requisições por chamada, com folga sob o teto do Worker. */
const DEPUTADOS_POR_RODADA = 60;

/**
 * Núcleo: importa a TRAJETÓRIA (linha do tempo de /historico) de uma
 * legislatura, em LOTES — uma legislatura inteira (~600 deputados × 1 chamada
 * cada) numa só requisição passaria do tempo. Quem chama repete com o
 * `proximoOffset` devolvido até ele ser `null`: o painel e a ferramenta
 * guardam o offset, nada fica no servidor. Grava eventos e, na legislatura
 * vigente, atualiza a situação real do roster (afastado/vacância/licença).
 *
 * Lê a lista de deputados do cadastro da legislatura: sem ele, a rodada falha
 * pedindo o cadastro antes. Cada rodada grava a sua linha em `importacoes`,
 * com `resultado`. Falha passageira devolve o mesmo offset (a próxima rodada
 * refaz o lote); falha definitiva encerra (`proximoOffset: null`), com o erro.
 */
export async function rodadaTrajetoriaCamara(
  data: { idLegislatura?: number; offset: number },
  userId: string | null,
  origem: OrigemRodada = {},
): Promise<{
  legislatura: number;
  total: number;
  processados: number;
  proximoOffset: number | null;
  erros: string[];
}> {
  const legislatura = data.idLegislatura ?? legislaturaAtualCamara();
  const erros: string[] = [];
  let ids: number[] = [];
  let lote: number[] = [];
  try {
    const { data: legRows, error } = await supabaseAdmin
      .from("camara_deputado_legislaturas")
      .select("deputado_id")
      .eq("id_legislatura", legislatura)
      .order("deputado_id", { ascending: true });
    if (error) throw new Error(`db: ${error.message}`);
    ids = [...new Set((legRows ?? []).map((r) => r.deputado_id as number))];
    if (ids.length === 0) {
      throw new Error(
        `Nenhum deputado da legislatura ${legislatura} no cadastro: importe o cadastro dessa legislatura antes.`,
      );
    }

    lote = ids.slice(data.offset, data.offset + DEPUTADOS_POR_RODADA);
    const { situacaoAtual: situacaoPorId, erros: errosHistorico } =
      await ingerirEventosDeputados(lote);
    erros.push(...errosHistorico);

    if (legislatura === legislaturaAtualCamara()) {
      for (const [id, situacao] of situacaoPorId) {
        const { error: erroSituacao } = await supabaseAdmin
          .from("camara_deputados_cache")
          .update({ situacao })
          .eq("id", id);
        if (erroSituacao) throw new Error(`db situação: ${erroSituacao.message}`);
      }
    }
  } catch (e) {
    erros.push((e as Error).message);
  }

  const falhou = erros.length > 0;
  const processados = falhou ? data.offset : Math.min(data.offset + lote.length, ids.length);
  const importados = processados - data.offset;
  let proximoOffset: number | null = processados < ids.length ? processados : null;
  if (falhou) proximoOffset = ehErroTransitorio(erros[0]) ? data.offset : null;

  const erroHistorico = await inserirImportacoes({
    fonte: "camara_trajetoria",
    escopo: `legislatura ${legislatura}`,
    ano: anoInicioLegislatura(legislatura),
    mes: 1,
    total_bruto: lote.length,
    importados,
    erros,
    resultado: classificarResultado({ importados, erros }),
    user_id: userId,
    gatilho: origem.gatilho ?? gatilhoPadrao(userId),
    execucao_id: origem.execucaoId ?? null,
    endpoint: `GET ${BASE}/deputados/{id}/historico (legislatura ${legislatura}: deputados ${data.offset + 1}–${processados} de ${ids.length})`,
  });
  if (erroHistorico)
    console.error("[camara_trajetoria] falha ao registrar importacao", erroHistorico);

  return { legislatura, total: ids.length, processados, proximoOffset, erros };
}

/**
 * Casca do painel da trajetória: uma rodada do núcleo; o cliente repete
 * avançando `offset` até `proximoOffset` ser null, exibindo progresso. O
 * erro da rodada vira exceção, como antes.
 */
export const importarTrajetoriaCamara = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => importarTrajetoriaCamaraSchema.parse(input))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);
    const r = await rodadaTrajetoriaCamara(data, context.userId);
    if (r.erros.length > 0) throw new Error(r.erros[0]);
    return {
      legislatura: r.legislatura,
      total: r.total,
      processados: r.processados,
      proximoOffset: r.proximoOffset,
    };
  });

/** Chave de varredura do mês — a mesma para painel, fila e ferramenta. */
export const chaveVarreduraCeapCamara = (data: { ano: number; mes: number; deputadoId?: number }) =>
  chaveVarreduraCeap("camara_ceap", data.ano, data.mes, data.deputadoId);

/** Importa despesas CEAP de um mês/ano para TODOS os deputados em cache. */
/** Núcleo chamável sem browser (v0.11.0) — usado pela casca autenticada e pelo agendador. */
export async function rodadaCEAPMes(
  data: { ano: number; mes: number; deputadoId?: number },
  userId: string | null,
  origem: OrigemRodada = {},
) {
  type DespesaRaw = {
    ano?: number;
    mes?: number;
    tipoDespesa?: string;
    codDocumento?: number;
    tipoDocumento?: string;
    numDocumento?: string;
    dataDocumento?: string;
    valorDocumento?: number;
    valorLiquido?: number;
    valorGlosa?: number;
    nomeFornecedor?: string;
    cnpjCpfFornecedor?: string;
    urlDocumento?: string;
  };

  const erros: string[] = [];

  // A ordem precisa ser a MESMA a cada rodada, senão a retomada pula ou
  // repete deputado — daí o `order` em todas as consultas abaixo.
  //
  // E o recorte por MANDATO é obrigatório: o cache acumula todas as
  // legislaturas já importadas, então varrer a tabela inteira consultava a
  // API para deputados que não estavam na Casa no mês pedido. Cada um deles
  // é uma requisição garantidamente vazia, e eram centenas — a varredura
  // avançava 45 por rodada e não terminava nunca.
  let deputadoIds: number[] = [];
  if (data.deputadoId) {
    deputadoIds = [data.deputadoId];
  } else {
    const leg = legislaturaDoAno(data.ano);

    // Histórico de mandatos: a fonte precisa dessa resposta.
    const { data: mandatos, error: errMandatos } = await supabaseAdmin
      .from("camara_deputado_legislaturas")
      .select("deputado_id")
      .eq("id_legislatura", leg)
      .order("deputado_id");
    if (errMandatos) throw new Error(`db: ${errMandatos.message}`);
    deputadoIds = [...new Set((mandatos ?? []).map((m) => m.deputado_id as number))];

    if (deputadoIds.length === 0) {
      // Sem histórico de mandatos importado, o cadastro ainda carrega a
      // legislatura em que cada deputado entrou no cache.
      const { data: deps, error } = await supabaseAdmin
        .from("camara_deputados_cache")
        .select("id")
        .eq("id_legislatura", leg)
        .order("id");
      if (error) throw new Error(`db: ${error.message}`);
      deputadoIds = (deps ?? []).map((d) => d.id as number);
      if (deputadoIds.length > 0) {
        erros.push(
          `info: sem histórico de mandatos da legislatura ${leg} — usei a legislatura registrada no cadastro. Importe o cadastro da legislatura ${leg} para o recorte ficar exato.`,
        );
      }
    }

    if (deputadoIds.length === 0) {
      throw new Error(
        `Nenhum deputado da legislatura ${leg} em cache. Importe o cadastro dessa legislatura antes do CEAP de ${data.ano}.`,
      );
    }
  }

  let deputadosProcessados = 0;

  // Um passo = um deputado. Rodada limitada por tempo E por subrequisições;
  // o painel admin repete até `haMais` ficar falso.
  const inicioRodada = Date.now();
  const rodada = await rodarComOrcamento({
    chave: chaveVarreduraCeapCamara(data),
    checkpoint: checkpointImportacao,
    orcamentoMs: CEAP_ORCAMENTO_MS,
    orcamentoCusto: CEAP_TETO_SUBREQUISICOES,
    maxPassos: deputadoIds.length,
    passo: async (cursor) => {
      const { id: depId, fim } = parlamentarNoCursor(deputadoIds, cursor);
      if (fim || depId == null) return { processados: 0, fim: true };

      let custo = 0;
      try {
        const lista: DespesaRaw[] = [];
        let pagina = 1;
        while (pagina < 30) {
          const json = await camaraGet<CamaraEnvelope<DespesaRaw[]>>(
            `/deputados/${depId}/despesas`,
            {
              ano: String(data.ano),
              mes: String(data.mes),
              itens: "100",
              pagina: String(pagina),
              ordem: "ASC",
              ordenarPor: "dataDocumento",
            },
          );
          custo++;
          const arr = json.dados ?? [];
          if (arr.length === 0) break;
          lista.push(...arr);
          if (arr.length < 100) break;
          pagina++;
        }
        deputadosProcessados++;
        if (lista.length === 0) return { processados: 0, fim: false, custo };

        const rows = lista.map((d, idx) => {
          const cod = d.codDocumento ?? null;
          const id = cod ? `${depId}-${cod}` : `${depId}-${data.ano}-${data.mes}-${idx}`;
          return {
            id,
            deputado_id: depId,
            ano: d.ano ?? data.ano,
            mes: d.mes ?? data.mes,
            tipo_despesa:
              sanitizarTextoPublico((d.tipoDespesa ?? "").slice(0, 200)) || "(sem tipo)",
            cod_documento: cod,
            tipo_documento: d.tipoDocumento ?? null,
            num_documento: d.numDocumento ?? null,
            data_documento:
              d.dataDocumento && /^\d{4}-\d{2}-\d{2}/.test(d.dataDocumento)
                ? d.dataDocumento.slice(0, 10)
                : null,
            valor_documento: Number(d.valorDocumento ?? 0),
            valor_liquido: Number(d.valorLiquido ?? 0),
            valor_glosa: Number(d.valorGlosa ?? 0),
            fornecedor_nome: sanitizarTextoPublico((d.nomeFornecedor ?? "").slice(0, 240)) || null,
            fornecedor_cnpj: d.cnpjCpfFornecedor ?? null,
            url_documento: d.urlDocumento ?? null,
            updated_at: new Date().toISOString(),
          };
        });

        for (let i = 0; i < rows.length; i += 200) {
          const { error } = await supabaseAdmin
            .from("camara_despesas_cache")
            .upsert(rows.slice(i, i + 200));
          custo++;
          // Falha de banco passageira refaz o item; definitiva registra e
          // segue, para um erro permanente não travar a varredura.
          if (error) {
            return {
              processados: 0,
              fim: false,
              custo,
              interromper: reacaoAoErro(error).interromper,
              erros: [`dep ${depId}: ${error.message}`],
            };
          }
        }

        const errosPasso: string[] = [];
        try {
          await flagQA(
            regrasCamaraCeap(
              rows.map((r) => ({
                id: r.id,
                valor_liquido: r.valor_liquido,
                valor_documento: r.valor_documento,
                deputado_id: r.deputado_id,
              })),
            ),
          );
        } catch (e) {
          // Não interrompe a ingestão, mas o erro de QA fica visível.
          errosPasso.push(`qa dep ${depId}: ${(e as Error).message}`);
        }

        return { processados: rows.length, fim: false, custo, erros: errosPasso };
      } catch (e) {
        // Passageiro (rede, 5xx) interrompe sem avançar, para a próxima
        // rodada refazer este item. Definitivo (404) registra e segue —
        // senão um item que nunca vai responder trava a varredura inteira.
        const { interromper } = reacaoAoErro(e);
        return {
          processados: 0,
          fim: false,
          custo,
          interromper,
          erros: [`dep ${depId}: ${(e as Error).message}`],
        };
      }
    },
  });

  erros.push(...rodada.erros);

  // Linha de rodada no Histórico — inclui consulta vazia e motivo de parada.
  const avisoHistorico = await registrarRodadaImportacao(
    {
      fonte: "camara_ceap",
      ano: data.ano,
      mes: data.mes,
      endpoint: `GET ${BASE}/deputados/{id}/despesas?ano=${data.ano}&mes=${data.mes}`,
      unidade: "deputados",
      userId: userId,
      ...origem,
      duracaoMs: Date.now() - inicioRodada,
    },
    rodada,
  );
  if (avisoHistorico) erros.push(avisoHistorico);

  return {
    importados: rodada.processados,
    deputadosProcessados,
    erros,
    varredura: {
      haMais: !rodada.concluido,
      cursor: rodada.cursorFinal,
      totalDeputados: deputadoIds.length,
      totalAcumulado: rodada.totalAcumulado,
      orcamentoEsgotado: rodada.orcamentoEsgotado,
      custoEsgotado: rodada.custoEsgotado,
    },
  };
}

/**
 * Parâmetros da importação — fonte única da validação: a casca autenticada e
 * o modo nomeado de `/api/cron-importar` usam este mesmo schema.
 */
export const importarCEAPMesSchema = z.object({
  ano: z.number().int().min(2009).max(2100),
  mes: z.number().int().min(1).max(12),
  deputadoId: z.number().int().positive().optional(),
});

export const importarCEAPMes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => importarCEAPMesSchema.parse(input))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);
    return rodadaCEAPMes(data, context.userId);
  });
