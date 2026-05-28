/**
 * Ingestão de Transferências Especiais e com Finalidade Definida (EC 105/2019)
 * direto da API oficial do Transferegov.
 *
 * Docs: https://docs.api.transferegov.gestao.gov.br/transferenciasespeciais/
 *
 * - API pública, não exige chave.
 * - Paginação via ?offset=&limit= (limite máx. observado ~500 por página).
 * - Resposta JSON com array no campo raiz.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sanitizarTextoPublico } from "@/lib/sanitize";
import { regrasTransferegovEmendas, flagQA } from "@/lib/data/qa";

const BASE_ESPECIAIS =
  "https://api.transferegov.dth.api.gov.br/transferenciasespeciais/plano_acao_especial";
const PORTAL_BASE = "https://api.portaldatransparencia.gov.br/api-de-dados";

const UF_BY_NAME: Record<string, string> = {
  ACRE: "AC",
  ALAGOAS: "AL",
  AMAPA: "AP",
  AMAZONAS: "AM",
  BAHIA: "BA",
  CEARA: "CE",
  "DISTRITO FEDERAL": "DF",
  "ESPIRITO SANTO": "ES",
  GOIAS: "GO",
  MARANHAO: "MA",
  "MATO GROSSO": "MT",
  "MATO GROSSO DO SUL": "MS",
  "MINAS GERAIS": "MG",
  PARA: "PA",
  PARAIBA: "PB",
  PARANA: "PR",
  PERNAMBUCO: "PE",
  PIAUI: "PI",
  "RIO DE JANEIRO": "RJ",
  "RIO GRANDE DO NORTE": "RN",
  "RIO GRANDE DO SUL": "RS",
  RONDONIA: "RO",
  RORAIMA: "RR",
  "SANTA CATARINA": "SC",
  "SAO PAULO": "SP",
  SERGIPE: "SE",
  TOCANTINS: "TO",
};

async function ensureAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error("Falha ao verificar permissão.");
  if (data?.role !== "admin") throw new Error("Acesso restrito.");
}

async function apiGet(url: string): Promise<unknown> {
  let lastErr: Error | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, {
        headers: {
          accept: "application/json",
          // Alguns nós do Transferegov bloqueiam UAs "robóticos" com 500.
          // UA neutro de navegador reduz substancialmente o bloqueio.
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
          "accept-encoding": "identity",
        },
      });
    } catch (e) {
      lastErr = new Error(`TRANSIENT: Transferegov indisponível: ${(e as Error).message}`);
      if (attempt === 0) await new Promise((r) => setTimeout(r, 1500));
      continue;
    }
    if (res.ok) return res.json();
    const transient = res.status >= 500 || res.status === 429;
    const body = (await res.text().catch(() => ""))
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 200);
    const msg = transient
      ? `TRANSIENT: Transferegov ${res.status}`
      : `Transferegov API ${res.status}: ${body}`;
    lastErr = new Error(msg);
    if (!transient) throw lastErr;
    if (attempt === 0) await new Promise((r) => setTimeout(r, 1500));
  }
  throw lastErr ?? new Error("TRANSIENT: Transferegov indisponível");
}

async function portalGet(params: Record<string, string>): Promise<unknown> {
  const key = process.env.PORTAL_TRANSPARENCIA_API_KEY;
  if (!key) throw new Error("PORTAL_TRANSPARENCIA_API_KEY não configurada.");
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${PORTAL_BASE}/emendas?${qs}`, {
    headers: {
      accept: "application/json",
      "chave-api-dados": key,
      "user-agent": "AuditoriaCidada/1.0 (transparencia pública)",
    },
  });
  if (res.ok) return res.json();
  const body = (await res.text().catch(() => ""))
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
  if (res.status >= 500 || res.status === 429) {
    throw new Error(`TRANSIENT: Portal ${res.status}${body ? ` — ${body}` : ""}`);
  }
  throw new Error(`Portal API ${res.status}: ${body}`);
}

type EmendaRaw = Record<string, unknown>;

function s(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const t = String(v).trim();
  return t === "" ? null : t;
}
function n(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const text = String(v).trim();
  if (!text) return 0;
  let normalized: string;
  if (text.includes(",")) {
    // Formato BR clássico: "1.234,56" → "1234.56"
    normalized = text.replace(/\./g, "").replace(",", ".");
  } else {
    // Sem vírgula: detecta pontos de milhar ("1.234" = mil duzentos e trinta e quatro)
    const parts = text.split(".");
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
      normalized = text.replace(/\./g, "");
    } else {
      normalized = text;
    }
  }
  const num = Number(normalized);
  return Number.isFinite(num) ? num : 0;
}
function d(v: unknown): string | null {
  const t = s(v);
  if (!t) return null;
  // Aceita YYYY-MM-DD ou DD/MM/YYYY
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = t.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  return br ? `${br[3]}-${br[2]}-${br[1]}` : null;
}

function mapEmenda(modalidade: "especial" | "finalidade_definida", row: EmendaRaw) {
  // Tenta múltiplos nomes — a API tem variações entre endpoints/versões.
  const idApi =
    s(row.id_transferencia_especial) ||
    s(row.codigoEmenda) ||
    s(row.id_disponibilizacao_recursos) ||
    s(row.id_plano_acao) ||
    s(row.id);
  const nrEmenda =
    s(row.nr_emenda) ||
    s(row.numero_emenda) ||
    s(row.numeroEmenda) ||
    s(row.numero_emenda_parlamentar_plano_acao) ||
    s(row.codigo_emenda) ||
    s(row.codigoEmenda) ||
    null;
  // Código completo da emenda (usado pelo Portal da Transparência como `codigoEmenda`).
  // Em "finalidade definida" vem separado do número curto (ex.: 0014 vs 17 dígitos).
  const codigoEmenda =
    s(row.codigoEmenda) ||
    s(row.codigo_emenda) ||
    null;
  const dataRef =
    d(row.dt_disponibilizacao) || d(row.dt_referencia) || d(row.dt_operacao) || null;
  const ano = Number(
    row.ano_emenda ??
      row.ano_referencia ??
      row.ano_plano_acao ??
      row.ano ??
      (dataRef ? dataRef.slice(0, 4) : 0),
  );
  if (!idApi || !ano) return null;
  const ibge = s(row.id_municipio_ibge) || s(row.cd_municipio_ibge) || null;
  const localidade = s(row.localidadeDoGasto);
  const localidadeUf = localidade?.match(/^(.+?)\s*\(UF\)$/)?.[1] ?? null;
  return {
    id: `${modalidade}-${idApi}`,
    modalidade,
    ano,
    numero_emenda: nrEmenda,
    codigo_emenda: codigoEmenda,
    autor_emenda:
      s(row.nome_parlamentar_emenda) ||
      s(row.nome_parlamentar_emenda_plano_acao) ||
      s(row.nm_parlamentar) ||
      s(row.nomeAutor) ||
      s(row.autor) ||
      s(row.autor_emenda) ||
      null,
    beneficiario_nome:
      sanitizarTextoPublico(
        (
          s(row.nome_beneficiario) ||
          s(row.nome_beneficiario_plano_acao) ||
          s(row.nm_beneficiario) ||
          s(row.beneficiario) ||
          localidade ||
          ""
        ).slice(0, 240),
      ) || null,
    beneficiario_cnpj:
      s(row.cnpj_beneficiario) || s(row.cnpj_beneficiario_plano_acao) || s(row.nr_cnpj_beneficiario) || null,
    uf: s(row.sg_uf) || s(row.uf_beneficiario) || s(row.uf_beneficiario_plano_acao) || s(row.uf) || (localidadeUf ? UF_BY_NAME[localidadeUf.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase()] ?? null : null),
    municipio_ibge: ibge,
    municipio_nome: s(row.nome_municipio) || s(row.nm_municipio) || null,
    valor: n(row.vl_disponibilizado ?? row.valor_disponibilizado ?? row.vl_repasse ?? row.valorEmpenhado ?? row.valor_custeio_plano_acao) + n(row.valor_investimento_plano_acao),
    valor_pago: n(row.vl_pago ?? row.valor_pago ?? row.valorPago ?? row.valorRestoPago),
    data_referencia: dataRef ?? `${ano}-01-01`,
    funcao: s(row.ds_funcao) || s(row.funcao) || null,
    subfuncao: s(row.ds_subfuncao) || s(row.subfuncao) || null,
    finalidade:
      sanitizarTextoPublico(
        (
          s(row.ds_finalidade) ||
          s(row.finalidade) ||
          s(row.ds_objeto) ||
          s(row.tipoEmenda) ||
          s(row.codigo_descricao_areas_politicas_publicas_plano_acao) ||
          s(row.descricao_programacao_orcamentaria_plano_acao) ||
          ""
        ).slice(0, 1000),
      ) || null,
    url_transferegov: null as string | null,
    updated_at: new Date().toISOString(),
  };
}

async function importarTransferegovEspecial(
  modalidade: "especial" | "finalidade_definida",
  base: string,
  ano: number,
  maxPaginas: number,
) {
  const limit = 500;
  let total = 0;
  for (let pagina = 0; pagina < maxPaginas; pagina++) {
    // Espaça as chamadas entre páginas para não ser barrado por rate-limit.
    if (pagina > 0) await new Promise((r) => setTimeout(r, 1200));
    const qs = new URLSearchParams({
      ano_plano_acao: `eq.${ano}`,
      limit: String(limit),
      offset: String(pagina * limit),
    }).toString();
    const json = (await apiGet(`${base}?${qs}`)) as unknown;
    const arr: EmendaRaw[] = Array.isArray(json)
      ? (json as EmendaRaw[])
      : Array.isArray((json as { data?: unknown }).data)
      ? ((json as { data: EmendaRaw[] }).data)
      : [];
    if (arr.length === 0) break;
    const rows = arr.map((r) => mapEmenda(modalidade, r)).filter((x): x is NonNullable<typeof x> => x !== null);
    for (let i = 0; i < rows.length; i += 200) {
      const slice = rows.slice(i, i + 200);
      const { error } = await (supabaseAdmin.from as (t: string) => any)(
        "transferegov_emendas_cache",
      ).upsert(slice);
      if (error) throw new Error(`db: ${error.message}`);
    }
    try {
      await flagQA(
        regrasTransferegovEmendas(
          rows.map((r) => ({ id: r.id, valor: r.valor, valor_pago: r.valor_pago, modalidade: r.modalidade })),
        ),
      );
    } catch {
      // ignora erros de QA
    }
    total += rows.length;
    if (arr.length < limit) break;
  }
  return total;
}

async function importarFinalidadePortal(ano: number, maxPaginas: number) {
  let total = 0;
  for (let pagina = 1; pagina <= maxPaginas; pagina++) {
    const json = (await portalGet({
      ano: String(ano),
      tipoEmenda: "Finalidade Definida",
      pagina: String(pagina),
    })) as unknown;
    const arr: EmendaRaw[] = Array.isArray(json) ? (json as EmendaRaw[]) : [];
    if (arr.length === 0) break;
    const rows = arr
      .map((r) => mapEmenda("finalidade_definida", r))
      .filter((x): x is NonNullable<typeof x> => x !== null);
    for (let i = 0; i < rows.length; i += 200) {
      const { error } = await (supabaseAdmin.from as (t: string) => any)(
        "transferegov_emendas_cache",
      ).upsert(rows.slice(i, i + 200));
      if (error) throw new Error(`db: ${error.message}`);
    }
    try {
      await flagQA(
        regrasTransferegovEmendas(
          rows.map((r) => ({ id: r.id, valor: r.valor, valor_pago: r.valor_pago, modalidade: r.modalidade })),
        ),
      );
    } catch {
      // ignora erros de QA
    }
    total += rows.length;
    if (arr.length < 15) break;
  }
  return total;
}

const InputSchema = z.object({
  ano: z.number().int().min(2020).max(2100),
  maxPaginas: z.number().int().min(1).max(2000).default(2000),
});

export const importarTransferenciasEspeciais = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);
    // Transientes (TRANSIENT:/timeout) são re-lançados para que o wrap em
    // cobertura-jobs NÃO registre o ano como "tentado" — assim "Sincronizar
    // tudo" pode retentar automaticamente na próxima execução. Erros não
    // transientes ficam logados normalmente.
    const importados = await importarTransferegovEspecial(
      "especial",
      BASE_ESPECIAIS,
      data.ano,
      data.maxPaginas,
    );
    return { importados, erro: null as string | null };
  });

export const importarTransferenciasFinalidade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);
    const importados = await importarFinalidadePortal(data.ano, data.maxPaginas);
    return { importados, erro: null as string | null };
  });