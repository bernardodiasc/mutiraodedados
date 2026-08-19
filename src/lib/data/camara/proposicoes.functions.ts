import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BASE = "https://dadosabertos.camara.leg.br/api/v2";
const UA = "MutiraoDeDados/1.0 (+https://mutiraodedados.com.br)";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// GET com retry/backoff (500 → 1500 → 4500 ms) para 429/5xx e erros de rede
// transitórios (ex.: 504 do gateway); 4xx é erro definitivo.
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
      ultimoErro = (e as Error).message;
      continue;
    }
    if (res.ok) return (await res.json()) as T;
    if (res.status === 429 || res.status >= 500) {
      ultimoErro = `${res.status}`;
      continue;
    }
    const body = await res.text().catch(() => "");
    throw new Error(`Câmara API ${res.status}: ${body.slice(0, 200)}`);
  }
  throw new Error(`Câmara API indisponível após ${tentativas} tentativas (último: ${ultimoErro}).`);
}

type Env<T> = { dados: T };

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

type ProposicaoListItem = {
  id: number;
  siglaTipo: string;
  codTipo?: number;
  numero: number;
  ano: number;
  ementa?: string;
};

type ProposicaoDetalhe = {
  id: number;
  siglaTipo: string;
  numero: number;
  ano: number;
  ementa?: string;
  ementaDetalhada?: string;
  keywords?: string;
  dataApresentacao?: string;
  codTipo?: number;
  descricaoTipo?: string;
  urlInteiroTeor?: string;
  statusProposicao?: {
    dataHora?: string;
    descricaoTramitacao?: string;
    despacho?: string;
    descricaoSituacao?: string;
    siglaOrgao?: string;
  };
};

type AutorItem = {
  uri?: string;
  nome: string;
  tipo?: string;
  ordemAssinatura?: number;
  proponente?: number; // 0/1
};

/**
 * Importa proposições de um ano + tipo (PL, PEC, MPV, PLP, PDL...).
 * Para cada proposição: busca detalhe + autores e popula autores_cache.
 */
export const importarProposicoes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        ano: z.number().int().min(1990).max(2100),
        siglaTipo: z.string().min(2).max(10).default("PL"),
        maxPaginas: z.number().int().min(1).max(50).default(5),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);

    // 1) Lista proposições por ano + tipo
    const listas: ProposicaoListItem[] = [];
    let pagina = 1;
    while (pagina <= data.maxPaginas) {
      const json = await camaraGet<Env<ProposicaoListItem[]>>("/proposicoes", {
        ano: String(data.ano),
        siglaTipo: data.siglaTipo,
        itens: "100",
        pagina: String(pagina),
        ordem: "ASC",
        ordenarPor: "id",
      });
      const arr = json.dados ?? [];
      if (arr.length === 0) break;
      listas.push(...arr);
      if (arr.length < 100) break;
      pagina++;
    }

    if (listas.length === 0) return { importados: 0, autores: 0 };

    let totalAutores = 0;
    let importados = 0;
    const erros: string[] = [];

    // 2) Para cada proposição: detalhe + autores
    for (const p of listas) {
      try {
        const det = await camaraGet<Env<ProposicaoDetalhe>>(`/proposicoes/${p.id}`);
        const d = det.dados;
        const st = d.statusProposicao ?? {};
        const row = {
          id: d.id,
          sigla_tipo: d.siglaTipo,
          numero: d.numero,
          ano: d.ano,
          ementa: d.ementa ?? null,
          ementa_detalhada: d.ementaDetalhada ?? null,
          keywords: d.keywords ?? null,
          data_apresentacao: d.dataApresentacao ? d.dataApresentacao.slice(0, 10) : null,
          cod_tipo: d.codTipo ?? null,
          descricao_tipo: d.descricaoTipo ?? null,
          url_inteiro_teor: d.urlInteiroTeor ?? null,
          ultimo_status_data: st.dataHora ? st.dataHora.slice(0, 10) : null,
          ultimo_status_descricao: st.descricaoTramitacao ?? null,
          ultimo_status_despacho: st.despacho ?? null,
          ultimo_status_situacao: st.descricaoSituacao ?? null,
          ultimo_status_orgao_sigla: st.siglaOrgao ?? null,
          updated_at: new Date().toISOString(),
        };
        const { error: e1 } = await supabaseAdmin.from("camara_proposicoes_cache").upsert(row);
        if (e1) throw new Error(e1.message);
        importados++;

        // autores
        const aut = await camaraGet<Env<AutorItem[]>>(`/proposicoes/${p.id}/autores`);
        const autores = aut.dados ?? [];
        const autRows = autores.map((a) => {
          // Extrai id do deputado do URI (.../deputados/123)
          let depId: number | null = null;
          if (a.uri) {
            const m = a.uri.match(/\/deputados\/(\d+)/);
            if (m) depId = Number(m[1]);
          }
          return {
            proposicao_id: p.id,
            deputado_id: depId,
            nome: (a.nome ?? "(sem nome)").slice(0, 240),
            tipo: a.tipo ?? null,
            ordem_assinatura: a.ordemAssinatura ?? null,
            proponente: Boolean(a.proponente),
            updated_at: new Date().toISOString(),
          };
        });
        if (autRows.length > 0) {
          const { error: e2 } = await supabaseAdmin
            .from("camara_proposicoes_autores_cache")
            .upsert(autRows);
          if (e2) throw new Error(`autores: ${e2.message}`);
          totalAutores += autRows.length;
        }
      } catch (e) {
        erros.push(`prop ${p.id}: ${(e as Error).message}`);
      }
    }

    return { importados, autores: totalAutores, erros };
  });

// ============ QUERIES públicas (read-only) ============

export type ProposicaoRow = {
  id: number;
  siglaTipo: string;
  numero: number;
  ano: number;
  ementa: string | null;
  dataApresentacao: string | null;
  ultimoStatusDescricao: string | null;
  ultimoStatusSituacao: string | null;
  ultimoStatusOrgaoSigla: string | null;
};

export const listarProposicoes = createServerFn({ method: "GET" })
  .inputValidator((input) =>
    z
      .object({
        ano: z.number().int().optional(),
        siglaTipo: z.string().optional(),
        termo: z.string().max(120).optional(),
        limit: z.number().int().min(1).max(500).default(200),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    let q = supabaseAdmin
      .from("camara_proposicoes_cache")
      .select(
        "id,sigla_tipo,numero,ano,ementa,data_apresentacao,ultimo_status_descricao,ultimo_status_situacao,ultimo_status_orgao_sigla",
      )
      .order("data_apresentacao", { ascending: false })
      .limit(data.limit);
    if (data.ano) q = q.eq("ano", data.ano);
    if (data.siglaTipo) q = q.eq("sigla_tipo", data.siglaTipo);
    if (data.termo) q = q.ilike("ementa", `%${data.termo}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const out: ProposicaoRow[] = (rows ?? []).map((r) => ({
      id: r.id as number,
      siglaTipo: r.sigla_tipo as string,
      numero: r.numero as number,
      ano: r.ano as number,
      ementa: r.ementa as string | null,
      dataApresentacao: r.data_apresentacao as string | null,
      ultimoStatusDescricao: r.ultimo_status_descricao as string | null,
      ultimoStatusSituacao: r.ultimo_status_situacao as string | null,
      ultimoStatusOrgaoSigla: r.ultimo_status_orgao_sigla as string | null,
    }));
    return out;
  });

export const getProposicaoDetalhe = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ id: z.number().int().positive() }).parse(input))
  .handler(async ({ data }) => {
    const { data: p, error } = await supabaseAdmin
      .from("camara_proposicoes_cache")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!p) return null;
    const { data: aut } = await supabaseAdmin
      .from("camara_proposicoes_autores_cache")
      .select("deputado_id,nome,tipo,ordem_assinatura,proponente")
      .eq("proposicao_id", data.id)
      .order("ordem_assinatura", { ascending: true });
    return {
      proposicao: {
        id: p.id as number,
        siglaTipo: p.sigla_tipo as string,
        numero: p.numero as number,
        ano: p.ano as number,
        ementa: p.ementa as string | null,
        ementaDetalhada: p.ementa_detalhada as string | null,
        keywords: p.keywords as string | null,
        dataApresentacao: p.data_apresentacao as string | null,
        descricaoTipo: p.descricao_tipo as string | null,
        urlInteiroTeor: p.url_inteiro_teor as string | null,
        ultimoStatusData: p.ultimo_status_data as string | null,
        ultimoStatusDescricao: p.ultimo_status_descricao as string | null,
        ultimoStatusDespacho: p.ultimo_status_despacho as string | null,
        ultimoStatusSituacao: p.ultimo_status_situacao as string | null,
        ultimoStatusOrgaoSigla: p.ultimo_status_orgao_sigla as string | null,
      },
      autores: (aut ?? []).map((a) => ({
        deputadoId: a.deputado_id as number | null,
        nome: a.nome as string,
        tipo: a.tipo as string | null,
        ordemAssinatura: a.ordem_assinatura as number | null,
        proponente: Boolean(a.proponente),
      })),
    };
  });

export const proposicoesDoDeputado = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ deputadoId: z.number().int().positive() }).parse(input))
  .handler(async ({ data }) => {
    const { data: links, error } = await supabaseAdmin
      .from("camara_proposicoes_autores_cache")
      .select("proposicao_id,proponente,ordem_assinatura")
      .eq("deputado_id", data.deputadoId);
    if (error) throw new Error(error.message);
    const ids = [...new Set((links ?? []).map((l) => l.proposicao_id as number))];
    if (ids.length === 0) return [];
    const { data: props } = await supabaseAdmin
      .from("camara_proposicoes_cache")
      .select("id,sigla_tipo,numero,ano,ementa,data_apresentacao,ultimo_status_situacao")
      .in("id", ids)
      .order("data_apresentacao", { ascending: false });
    const proponenteMap = new Map<number, boolean>();
    for (const l of links ?? []) {
      if (l.proponente) proponenteMap.set(l.proposicao_id as number, true);
    }
    return (props ?? []).map((p) => ({
      id: p.id as number,
      siglaTipo: p.sigla_tipo as string,
      numero: p.numero as number,
      ano: p.ano as number,
      ementa: p.ementa as string | null,
      dataApresentacao: p.data_apresentacao as string | null,
      ultimoStatusSituacao: p.ultimo_status_situacao as string | null,
      proponente: proponenteMap.get(p.id as number) ?? false,
    }));
  });

export const camaraProposicoesOverview = createServerFn({ method: "GET" }).handler(async () => {
  const { count } = await supabaseAdmin
    .from("camara_proposicoes_cache")
    .select("id", { count: "exact", head: true });
  const { data: porTipo } = await supabaseAdmin
    .from("camara_proposicoes_cache")
    .select("sigla_tipo")
    .limit(10000);
  const tipos = new Map<string, number>();
  for (const r of porTipo ?? []) {
    const k = r.sigla_tipo as string;
    tipos.set(k, (tipos.get(k) ?? 0) + 1);
  }
  return {
    total: count ?? 0,
    porTipo: [...tipos.entries()].map(([tipo, n]) => ({ tipo, n })).sort((a, b) => b.n - a.n),
  };
});
