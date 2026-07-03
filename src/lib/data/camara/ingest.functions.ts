import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sanitizarTextoPublico } from "@/lib/sanitize";
import { regrasCamaraCeap, flagQA } from "@/lib/data/qa";

const BASE = "https://dadosabertos.camara.leg.br/api/v2";
const UA = "AuditoriaCidada/1.0 (+https://auditoria-cidada.lovable.app)";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * GET na API da Câmara com retry/backoff. A API fica atrás de um gateway que
 * às vezes devolve 429/5xx transitórios (ex.: 504 do Cloudflare). Repetimos
 * com espera exponencial (500 → 1500 → 4500 ms); 4xx são erros definitivos.
 */
async function camaraGet<T = unknown>(
  path: string,
  params: Record<string, string> = {},
  tentativas = 4,
): Promise<T> {
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
    if (res.ok) return (await res.json()) as T;
    if (res.status === 429 || res.status >= 500) {
      ultimoErro = `${res.status}`; // transitório → retry
      continue;
    }
    const body = await res.text().catch(() => "");
    throw new Error(`Câmara API ${res.status}: ${body.slice(0, 200)}`); // 4xx definitivo
  }
  throw new Error(`Câmara API indisponível após ${tentativas} tentativas (último: ${ultimoErro}).`);
}

type CamaraEnvelope<T> = { dados: T; links?: Array<{ rel: string; href: string }> };

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

/** Legislatura corrente (52 = 2003–2007, +1 a cada 4 anos). 2023–2027 = 57. */
export function legislaturaAtualCamara(): number {
  return 52 + Math.floor((new Date().getFullYear() - 2003) / 4);
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
 * Núcleo: importa o cadastro de deputados de UMA legislatura.
 *
 * - Legislatura ATUAL: grava a linha completa do roster (partido/UF/situação).
 * - Legislaturas PASSADAS: grava só a IDENTIDADE no roster (nome/foto/email) para
 *   NÃO sobrescrever o estado atual; partido/UF da legislatura vão para a tabela
 *   filha `camara_deputado_legislaturas` (histórico de mandatos).
 * Sempre grava a linha-filha da legislatura e registra a rodada em `importacoes`.
 */
async function ingerirDeputadosLegislatura(
  idLegislatura: number | undefined,
  userId: string,
): Promise<{ importados: number; legislatura: number }> {
  const legAtual = legislaturaAtualCamara();
  const legAlvo = idLegislatura ?? legAtual;
  const ehAtual = legAlvo === legAtual;

  const params: Record<string, string> = {
    itens: "100",
    ordem: "ASC",
    ordenarPor: "nome",
    idLegislatura: String(legAlvo),
  };

  const all: DepListItem[] = [];
  let pagina = 1;
  while (pagina < 20) {
    const json = await camaraGet<CamaraEnvelope<DepListItem[]>>("/deputados", {
      ...params,
      pagina: String(pagina),
    });
    const list = json.dados ?? [];
    if (list.length === 0) break;
    all.push(...list);
    if (list.length < 100) break;
    pagina++;
  }

  if (all.length === 0) return { importados: 0, legislatura: legAlvo };

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

  try {
    await supabaseAdmin.from("importacoes").insert({
      fonte: "camara_deputados",
      escopo: `legislatura ${legAlvo}`,
      ano: anoInicioLegislatura(legAlvo),
      mes: 1,
      total_bruto: all.length,
      importados: unicos.length,
      erros: [],
      user_id: userId,
      endpoint: `GET https://dadosabertos.camara.leg.br/api/v2/deputados?idLegislatura=${legAlvo}`,
    });
  } catch (e) {
    console.error("[camara_deputados] falha ao registrar importacao", e);
  }

  return { importados: unicos.length, legislatura: legAlvo };
}

/** Importa o cadastro de deputados de uma legislatura (padrão: atual). */
export const importarDeputados = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        idLegislatura: z.number().int().min(50).max(100).optional(),
      })
      .parse(input ?? {}),
  )
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

/** Importa despesas CEAP de um mês/ano para TODOS os deputados em cache. */
export const importarCEAPMes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        ano: z.number().int().min(2009).max(2100),
        mes: z.number().int().min(1).max(12),
        deputadoId: z.number().int().positive().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);

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

    // Decide quais deputados processar
    let deputadoIds: number[] = [];
    if (data.deputadoId) {
      deputadoIds = [data.deputadoId];
    } else {
      const { data: deps, error } = await supabaseAdmin
        .from("camara_deputados_cache")
        .select("id");
      if (error) throw new Error(`db: ${error.message}`);
      deputadoIds = (deps ?? []).map((d) => d.id as number);
    }

    if (deputadoIds.length === 0) {
      throw new Error("Nenhum deputado em cache. Importe o cadastro primeiro.");
    }

    let totalImportados = 0;
    const erros: string[] = [];

    for (const depId of deputadoIds) {
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
          const arr = json.dados ?? [];
          if (arr.length === 0) break;
          lista.push(...arr);
          if (arr.length < 100) break;
          pagina++;
        }
        if (lista.length === 0) continue;

        const rows = lista.map((d, idx) => {
          const cod = d.codDocumento ?? null;
          const id = cod ? `${depId}-${cod}` : `${depId}-${data.ano}-${data.mes}-${idx}`;
          return {
            id,
            deputado_id: depId,
            ano: d.ano ?? data.ano,
            mes: d.mes ?? data.mes,
            tipo_despesa: sanitizarTextoPublico((d.tipoDespesa ?? "").slice(0, 200)) || "(sem tipo)",
            cod_documento: cod,
            tipo_documento: d.tipoDocumento ?? null,
            num_documento: d.numDocumento ?? null,
            data_documento: d.dataDocumento && /^\d{4}-\d{2}-\d{2}/.test(d.dataDocumento)
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
          if (error) throw new Error(error.message);
        }
        totalImportados += rows.length;
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
        } catch {
          // ignora erros de QA
        }
      } catch (e) {
        erros.push(`dep ${depId}: ${(e as Error).message}`);
      }
    }

    return { importados: totalImportados, deputadosProcessados: deputadoIds.length, erros };
  });