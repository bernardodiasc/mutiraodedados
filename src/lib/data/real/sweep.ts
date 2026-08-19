import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { portalGet, PORTAL_BASE } from "@/lib/data/real/portal-client";
import { flagQA, type QaFinding } from "@/lib/data/qa";

/**
 * Maquinaria compartilhada de varredura do Portal da Transparência (CGU).
 *
 * O Portal expõe vários endpoints (`/contratos`, `/licitacoes`, `/convenios`,
 * `/emendas`, `/transferencias`, …) que paginam do mesmo jeito e que ingerimos
 * com a MESMA mecânica: gate admin → loop retomável por orçamento de tempo →
 * upsert em lote → QA → log de requisição → persistência da varredura.
 *
 * Este módulo extrai dessa mecânica o que é genérico (independente de qual
 * entidade). Licitações, convênios e emendas usam o motor `varrerPaginado`
 * abaixo. O ingest de contratos (`real/portal.functions.ts`) segue com loop
 * próprio por causa da conferência-por-detalhe (listagem × `/contratos/id`)
 * específica de contratos — a unificação foi avaliada e adiada de propósito
 * (o caminho mais crítico do site não muda de estrutura sem necessidade);
 * contratos reaproveitam daqui apenas os helpers (chave de varredura,
 * persistência, logs).
 */

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Normaliza uma data da API (que vem ora em ISO `YYYY-MM-DD`, ora em BR
 * `DD/MM/YYYY`) para ISO. Retorna "" quando ausente/inválida.
 */
export function parseDatePortal(br: string | undefined | null): string {
  if (!br) return "";
  const iso = br.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const [d, m, y] = br.split("/");
  if (!d || !m || !y) return "";
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

/** Converte ISO `YYYY-MM-DD` → BR `DD/MM/YYYY` (formato de filtro da CGU). */
export function isoToBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/**
 * Linha de log de UMA requisição (página ou detalhe). Marcada com
 * `log_kind='requisicao'` para o Histórico filtrá-la fora; ano/mes ficam NULL
 * para `cobertura_tentativas` ignorá-la automaticamente.
 */
export type LogRequisicao = {
  fonte: string;
  orgao_cod: string;
  escopo: string;
  log_kind: string;
  endpoint: string;
  total_bruto: number;
  importados: number;
  erros: string[];
  consultado_em: string;
  user_id: string;
};

/**
 * Gate de administrador. Cada server function de ingest chama isto no início do
 * handler (mesmo padrão de todos os ingests do projeto).
 */
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

/**
 * Erro do PostgREST quando a tabela `cgu_varredura` ainda não existe no schema
 * (migração não aplicada). Tratamos como benigno: a varredura é opcional — sem
 * ela a ingestão só perde a capacidade de retomar.
 */
export function tabelaVarreduraAusente(
  err: { message?: string; code?: string } | null | undefined,
): boolean {
  if (!err) return false;
  const m = err.message ?? "";
  return err.code === "PGRST205" || /could not find the table|schema cache|does not exist/i.test(m);
}

export async function inserirLogsRequisicao(rows: LogRequisicao[]): Promise<void> {
  if (rows.length === 0) return;
  await supabaseAdmin.from("importacoes").insert(rows);
}

/**
 * Salva/atualiza o ponteiro de retomada de uma varredura. A primeira coluna da
 * tabela `cgu_varredura` (`orgao_cod`) guarda a CHAVE composta (ver
 * {@link montarVarreduraKey}), não apenas o código do órgão.
 */
export async function persistirVarredura(
  varreduraKey: string,
  ultimaPagina: number,
  completa: boolean,
  totalImportado: number,
): Promise<{ persistida: boolean; erro: string | null }> {
  const up = await supabaseAdmin.from("cgu_varredura").upsert({
    orgao_cod: varreduraKey,
    ultima_pagina: ultimaPagina,
    completa,
    total_importado: totalImportado,
    atualizado_em: new Date().toISOString(),
  });
  if (up.error) {
    if (tabelaVarreduraAusente(up.error)) return { persistida: false, erro: null };
    return { persistida: true, erro: `cgu_varredura: ${up.error.message}` };
  }
  return { persistida: true, erro: null };
}

// ---------------------------------------------------------------------------
// Chave de varredura (multi-entidade)
// ---------------------------------------------------------------------------
//
// A `cgu_varredura` guarda o progresso retomável de cada (entidade, órgão,
// [janela]). A chave é uma string composta gravada na coluna `orgao_cod`:
//
//   - contratos (legado):  `<cod>`  ou  `<cod>#<ini>#<fim>`
//   - demais entidades:    `<entidade>#<cod>`  ou  `<entidade>#<cod>#<ini>#<fim>`
//
// Contratos mantêm o formato legado (sem prefixo) para não invalidar varreduras
// em andamento. Como códigos de órgão são numéricos (`\d{4,6}`) e nomes de
// entidade são alfabéticos, a desambiguação no parse é determinística.

const RX_ORGAO = /^\d{4,6}$/;

export function montarVarreduraKey(
  entidade: string,
  orgaoCod: string,
  dataInicial?: string,
  dataFinal?: string,
): string {
  const base = entidade === "contratos" ? orgaoCod : `${entidade}#${orgaoCod}`;
  return dataInicial && dataFinal ? `${base}#${dataInicial}#${dataFinal}` : base;
}

export type VarreduraKeyParts = {
  entidade: string;
  orgaoCod: string;
  dataInicial?: string;
  dataFinal?: string;
};

export function parseVarreduraKey(key: string): VarreduraKeyParts {
  const parts = String(key).split("#");
  // Legado de contratos: primeiro segmento é um código de órgão numérico.
  if (RX_ORGAO.test(parts[0])) {
    return {
      entidade: "contratos",
      orgaoCod: parts[0],
      ...(parts[1] && parts[2] ? { dataInicial: parts[1], dataFinal: parts[2] } : {}),
    };
  }
  return {
    entidade: parts[0],
    orgaoCod: parts[1] ?? "",
    ...(parts[2] && parts[3] ? { dataInicial: parts[2], dataFinal: parts[3] } : {}),
  };
}

// ---------------------------------------------------------------------------
// Motor genérico de varredura paginada
// ---------------------------------------------------------------------------
//
// Reaproveitado pelas entidades-tópico SIMPLES (sem dupla-busca por detalhe):
// licitações, convênios (varredura por órgão) e emendas (varredura por ano).
// Contratos têm a conferência-por-detalhe própria e seguem em
// `portal.functions.ts`. O motor é faithful ao loop de contratos: retomável por
// orçamento de tempo, progresso por página em `cgu_varredura`, upsert+QA+log por
// página, e uma linha de rodada em `importacoes` (log_kind NULL → Histórico).

export type SweepRodada = {
  totalAcumulado: number;
  ultimaPagina: number;
  completa: boolean;
  haMais: boolean;
  orcamentoEsgotado: boolean;
  erros: string[];
  avisos: string[];
};

/** Empurra logs de requisição extras e findings de QA detectados no mapeamento. */
export type SweepPush = {
  log: (l: LogRequisicao) => void;
  finding: (f: QaFinding) => void;
};

export type VarrerPaginadoOpts<TRaw, TRow> = {
  /** Prefixo da chave de varredura + rótulo nas mensagens (ex.: "licitacoes"). */
  entidade: string;
  /** Valor de `importacoes.fonte` (ex.: "cgu_licitacoes"). */
  fonte: string;
  /** Caminho do endpoint para `portalGet` (ex.: "/licitacoes"). */
  endpoint: string;
  /** Valor de `importacoes.orgao_cod` (código do órgão, ou "" p/ varredura por ano). */
  orgaoCodLog: string;
  /** Rótulo do escopo (sigla do órgão, ou ano). */
  escopo: string;
  userId: string;
  /** Chave composta de retomada (ver `montarVarreduraKey`). */
  varreduraKey: string;
  /** Tamanho fixo de página do endpoint (página menor que isso = última). */
  tamPagina: number;
  maxPaginas: number;
  delayMs: number;
  orcamentoMs: number;
  /** Monta os parâmetros de query da página N (inclui codigoOrgao/ano/janela). */
  montarParams: (pagina: number) => Record<string, string>;
  /** Mapeia a página crua → linhas do cache (+ logs/findings via `push`). */
  mapPagina: (list: TRaw[], pagina: number, push: SweepPush) => Promise<TRow[]> | TRow[];
  /** Persiste um lote de linhas; devolve mensagens de erro (não lança). */
  upsertBatch: (rows: TRow[]) => Promise<string[]>;
  /** Sincroniza QA do lote pós-upsert (opcional). */
  qaSync?: (rows: TRow[]) => Promise<void>;
  /** Data ISO de uma linha, para o intervalo data_inicial/data_final do log. */
  rowDateIso?: (row: TRow) => string | null;
};

export async function varrerPaginado<TRaw, TRow>(
  opts: VarrerPaginadoOpts<TRaw, TRow>,
): Promise<SweepRodada> {
  const {
    entidade,
    fonte,
    endpoint,
    orgaoCodLog,
    escopo,
    userId,
    varreduraKey,
    tamPagina,
    maxPaginas,
    delayMs,
    orcamentoMs,
    montarParams,
    mapPagina,
    upsertBatch,
    qaSync,
    rowDateIso,
  } = opts;

  // Retoma de onde parou (cgu_varredura). Sem estado, ou já completa → do zero.
  let paginaInicial = 1;
  let totalAcumulado = 0;
  {
    const { data: est } = await supabaseAdmin
      .from("cgu_varredura")
      .select("ultima_pagina, completa, total_importado")
      .eq("orgao_cod", varreduraKey)
      .maybeSingle();
    if (est && !est.completa && (est.ultima_pagina ?? 0) > 0) {
      paginaInicial = (est.ultima_pagina ?? 0) + 1;
      totalAcumulado = est.total_importado ?? 0;
    }
  }

  const inicio = Date.now();
  const erros: string[] = [];
  const datasRodada: string[] = [];
  let ultimaPaginaVarrida = paginaInicial - 1;
  let acumuladoRodada = 0;
  let completa = false;
  let persistida = true;
  let orcamentoEsgotado = false;

  for (let n = 0; n < maxPaginas; n++) {
    if (Date.now() - inicio > orcamentoMs) {
      orcamentoEsgotado = true;
      break;
    }
    const pagina = paginaInicial + n;
    const params = montarParams(pagina);
    const urlPagina = `${PORTAL_BASE}${endpoint}?${new URLSearchParams(params).toString()}`;
    let list: TRaw[];
    try {
      list = await portalGet<TRaw[]>(endpoint, params);
    } catch (e) {
      const msg = (e as Error).message;
      erros.push(`p${pagina}: ${msg}`);
      // JSON inválido/não-JSON é transitório no Portal — pula a página e segue.
      if (msg.includes("JSON inválido") || msg.includes("não-JSON")) {
        if (delayMs > 0) await sleep(delayMs);
        continue;
      }
      break;
    }
    if (delayMs > 0) await sleep(delayMs);
    if (!Array.isArray(list) || list.length === 0) {
      completa = true;
      break;
    }

    const reqLogs: LogRequisicao[] = [
      {
        fonte,
        orgao_cod: orgaoCodLog,
        escopo,
        log_kind: "requisicao",
        endpoint: `GET ${urlPagina}`,
        total_bruto: list.length,
        importados: list.length,
        erros: [],
        consultado_em: new Date().toISOString(),
        user_id: userId,
      },
    ];
    const findings: QaFinding[] = [];
    const push: SweepPush = { log: (l) => reqLogs.push(l), finding: (f) => findings.push(f) };

    let rows: TRow[];
    try {
      rows = await mapPagina(list, pagina, push);
    } catch (e) {
      erros.push(`map p${pagina}: ${(e as Error).message}`);
      rows = [];
    }

    erros.push(...(await upsertBatch(rows)));
    if (qaSync) {
      try {
        await qaSync(rows);
      } catch (e) {
        erros.push(`qa: ${(e as Error).message}`);
      }
    }
    if (findings.length > 0) {
      try {
        await flagQA(findings);
      } catch (e) {
        erros.push(`qa_alertas: ${(e as Error).message}`);
      }
    }
    try {
      await inserirLogsRequisicao(reqLogs);
    } catch (e) {
      erros.push(`log: ${(e as Error).message}`);
    }

    ultimaPaginaVarrida = pagina;
    acumuladoRodada += rows.length;
    totalAcumulado += rows.length;
    if (rowDateIso) {
      for (const r of rows) {
        const d = rowDateIso(r);
        if (d) datasRodada.push(d);
      }
    }

    // Avança o ponteiro ANTES da próxima página (sobrevive a kill do servidor).
    const pv = await persistirVarredura(varreduraKey, ultimaPaginaVarrida, false, totalAcumulado);
    persistida = pv.persistida;
    if (pv.erro) erros.push(pv.erro);

    if (list.length < tamPagina) {
      completa = true;
      break;
    }
  }

  // Estado final.
  {
    const pv = await persistirVarredura(
      varreduraKey,
      ultimaPaginaVarrida,
      completa,
      totalAcumulado,
    );
    persistida = pv.persistida;
    if (pv.erro) erros.push(pv.erro);
  }

  const haMais = !completa;
  const avisos: string[] = [];
  if (haMais) {
    avisos.push(
      persistida
        ? `info: varredura parcial (até pág. ${ultimaPaginaVarrida}${orcamentoEsgotado ? ", tempo da rodada esgotado" : ""}) — há mais ${entidade}; continue para baixar o restante.`
        : `info: varredura parcial (até pág. ${ultimaPaginaVarrida}) — a tabela cgu_varredura não existe (migração pendente), então NÃO retoma. Aplique a migração.`,
    );
  }

  // Log da RODADA (uma linha, log_kind NULL → aparece no Histórico).
  datasRodada.sort();
  await supabaseAdmin.from("importacoes").insert({
    fonte,
    orgao_cod: orgaoCodLog || null,
    escopo,
    data_inicial: datasRodada[0] ?? null,
    data_final: datasRodada[datasRodada.length - 1] ?? null,
    total_bruto: acumuladoRodada,
    importados: acumuladoRodada,
    erros: [...erros, ...avisos],
    consultado_em: new Date().toISOString(),
    endpoint: `GET ${PORTAL_BASE}${endpoint} (varredura ${entidade}, pág. ${paginaInicial}–${ultimaPaginaVarrida}${completa ? " — completa" : " — parcial"})`,
    user_id: userId,
  });

  return {
    totalAcumulado,
    ultimaPagina: ultimaPaginaVarrida,
    completa,
    haMais,
    orcamentoEsgotado,
    erros,
    avisos,
  };
}
