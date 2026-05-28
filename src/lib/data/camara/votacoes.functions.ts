import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BASE = "https://dadosabertos.camara.leg.br/api/v2";
const UA = "AuditoriaCidada/1.0 (+https://auditoria-cidada.lovable.app)";

async function camaraGet<T = unknown>(path: string, params: Record<string, string> = {}): Promise<T> {
  const qs = new URLSearchParams(params).toString();
  const url = `${BASE}${path}${qs ? `?${qs}` : ""}`;
  const maxAttempts = 4;
  let lastErr: Error | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 45_000);
      const res = await fetch(url, {
        headers: { accept: "application/json", "user-agent": UA },
        signal: ctrl.signal,
      }).finally(() => clearTimeout(timeout));
      if (res.ok) return (await res.json()) as T;
      // Retry on transient upstream errors / rate-limit
      if ([429, 502, 503, 504].includes(res.status) && attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 500 * 2 ** (attempt - 1)));
        continue;
      }
      const body = await res.text().catch(() => "");
      throw new Error(`Câmara API ${res.status}: ${body.slice(0, 200)}`);
    } catch (e) {
      lastErr = e as Error;
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 500 * 2 ** (attempt - 1)));
        continue;
      }
      throw lastErr;
    }
  }
  throw lastErr ?? new Error("Câmara API: falha desconhecida");
}
type Env<T> = { dados: T };

async function ensureAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles").select("role")
    .eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (error) throw new Error("Falha ao verificar permissão.");
  if (data?.role !== "admin") throw new Error("Acesso restrito: somente administradores.");
}

type VotacaoItem = {
  id: string;
  data?: string;
  dataHoraRegistro?: string;
  siglaOrgao?: string;
  descricao?: string;
  aprovacao?: number;
  proposicaoObjeto?: string;
};

type VotoItem = {
  tipoVoto?: string;
  deputado_?: {
    id?: number;
    nome?: string;
    siglaPartido?: string;
    siglaUf?: string;
  };
};

/**
 * Processa UMA votação: busca detalhe + votos paginados e faz upsert.
 * Extraído para ser reutilizado por `importarVotacoes` (mês inteiro num
 * único worker call) e `importarVotacaoUnica` (uma chamada por votação,
 * usado pelos lotes longos para não bater no limite de subrequests).
 */
async function processarVotacao(v: VotacaoItem): Promise<number> {
  type Detalhe = VotacaoItem & {
    descricaoResultado?: string;
    ultimaApresentacaoProposicao?: { idProposicao?: number; descricao?: string };
  };
  const det = await camaraGet<Env<Detalhe>>(`/votacoes/${v.id}`);
  const d = det.dados;

  const votos: VotoItem[] = [];
  let p = 1;
  while (p < 10) {
    const json = await camaraGet<Env<VotoItem[]>>(`/votacoes/${v.id}/votos`, {
      itens: "200",
      pagina: String(p),
    });
    const arr = json.dados ?? [];
    if (arr.length === 0) break;
    votos.push(...arr);
    if (arr.length < 200) break;
    p++;
  }

  const tally = { sim: 0, nao: 0, outros: 0 };
  for (const x of votos) {
    const t = (x.tipoVoto ?? "").toLowerCase();
    if (t.startsWith("sim")) tally.sim++;
    else if (t.startsWith("não") || t.startsWith("nao")) tally.nao++;
    else tally.outros++;
  }

  const row = {
    id: v.id,
    data:
      d.data ??
      v.data ??
      ((d.dataHoraRegistro ?? v.dataHoraRegistro ?? "").slice(0, 10) || null),
    data_hora_registro: d.dataHoraRegistro ?? v.dataHoraRegistro ?? null,
    sigla_orgao: d.siglaOrgao ?? v.siglaOrgao ?? null,
    descricao: (d.descricao ?? v.descricao ?? "").slice(0, 2000) || null,
    aprovacao: d.aprovacao ?? v.aprovacao ?? null,
    descricao_resultado: d.descricaoResultado ?? null,
    proposicao_id: d.ultimaApresentacaoProposicao?.idProposicao ?? null,
    proposicao_titulo: d.ultimaApresentacaoProposicao?.descricao ?? d.proposicaoObjeto ?? null,
    votos_sim: tally.sim,
    votos_nao: tally.nao,
    votos_outros: tally.outros,
    updated_at: new Date().toISOString(),
  };
  const { error: e1 } = await supabaseAdmin.from("camara_votacoes_cache").upsert(row);
  if (e1) throw new Error(e1.message);

  const votoRows = votos
    .filter((x) => x.deputado_?.id)
    .map((x) => ({
      votacao_id: v.id,
      deputado_id: x.deputado_!.id!,
      tipo_voto: (x.tipoVoto ?? "").slice(0, 40) || "—",
      sigla_partido: x.deputado_?.siglaPartido ?? null,
      sigla_uf: x.deputado_?.siglaUf ?? null,
      updated_at: new Date().toISOString(),
    }));

  for (let i = 0; i < votoRows.length; i += 500) {
    const { error: e2 } = await supabaseAdmin
      .from("camara_votos_cache").upsert(votoRows.slice(i, i + 500));
    if (e2) throw new Error(`votos: ${e2.message}`);
  }
  return votoRows.length;
}

/**
 * Apenas lista IDs+meta básica de votações num intervalo de datas.
 * Chamada barata (1–N requests à Câmara, sem buscar votos), usada pelos
 * lotes longos para descobrir o universo de trabalho antes de despachar
 * uma chamada por votação.
 */
export const listarVotacoesPeriodo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      dataInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      dataFim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      maxPaginas: z.number().int().min(1).max(2000).default(2000),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);
    const ids: string[] = [];
    let pagina = 1;
    while (pagina <= data.maxPaginas) {
      const json = await camaraGet<Env<VotacaoItem[]>>("/votacoes", {
        dataInicio: data.dataInicio,
        dataFim: data.dataFim,
        itens: "100",
        pagina: String(pagina),
        ordem: "DESC",
        ordenarPor: "dataHoraRegistro",
      });
      const arr = json.dados ?? [];
      if (arr.length === 0) break;
      for (const v of arr) ids.push(v.id);
      if (arr.length < 100) break;
      pagina++;
    }
    return { ids };
  });

/**
 * Importa UMA votação (detalhe + votos + upsert). Cada chamada faz no
 * máximo ~11 subrequests à Câmara — bem abaixo de qualquer limite do
 * worker. Pensada para ser chamada repetidamente pelo cliente.
 */
export const importarVotacaoUnica = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().min(1).max(40) }).parse(input))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);
    const votos = await processarVotacao({ id: data.id });
    return { votos };
  });

/** Importa votações em um intervalo de datas; depois, votos de cada votação. */
export const importarVotacoes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      dataInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      dataFim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      maxPaginas: z.number().int().min(1).max(2000).default(2000),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);

    // 1) Lista de votações
    const votacoes: VotacaoItem[] = [];
    let pagina = 1;
    while (pagina <= data.maxPaginas) {
      const json = await camaraGet<Env<VotacaoItem[]>>("/votacoes", {
        dataInicio: data.dataInicio,
        dataFim: data.dataFim,
        itens: "100",
        pagina: String(pagina),
        ordem: "DESC",
        ordenarPor: "dataHoraRegistro",
      });
      const arr = json.dados ?? [];
      if (arr.length === 0) break;
      votacoes.push(...arr);
      if (arr.length < 100) break;
      pagina++;
    }
    if (votacoes.length === 0) return { votacoes: 0, votos: 0 };

    let totalVotos = 0;
    const erros: string[] = [];

    for (const v of votacoes) {
      try {
        totalVotos += await processarVotacao(v);
      } catch (e) {
        erros.push(`vot ${v.id}: ${(e as Error).message}`);
      }
    }

    return { votacoes: votacoes.length, votos: totalVotos, erros };
  });

// ===== QUERIES =====

export const listarVotacoes = createServerFn({ method: "GET" })
  .inputValidator((input) =>
    z.object({
      termo: z.string().max(120).optional(),
      limit: z.number().int().min(1).max(500).default(200),
    }).parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    let q = supabaseAdmin
      .from("camara_votacoes_cache")
      .select("id,data,sigla_orgao,descricao,aprovacao,descricao_resultado,proposicao_id,proposicao_titulo,votos_sim,votos_nao,votos_outros")
      .order("data", { ascending: false, nullsFirst: false })
      .limit(data.limit);
    if (data.termo) q = q.ilike("descricao", `%${data.termo}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({
      id: r.id as string,
      data: r.data as string | null,
      siglaOrgao: r.sigla_orgao as string | null,
      descricao: r.descricao as string | null,
      aprovacao: r.aprovacao as number | null,
      descricaoResultado: r.descricao_resultado as string | null,
      proposicaoId: r.proposicao_id as number | null,
      proposicaoTitulo: r.proposicao_titulo as string | null,
      votosSim: r.votos_sim as number,
      votosNao: r.votos_nao as number,
      votosOutros: r.votos_outros as number,
    }));
  });

export const getVotacaoDetalhe = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ id: z.string().min(1) }).parse(input))
  .handler(async ({ data }) => {
    const { data: v, error } = await supabaseAdmin
      .from("camara_votacoes_cache").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!v) return null;
    const { data: votos } = await supabaseAdmin
      .from("camara_votos_cache")
      .select("deputado_id,tipo_voto,sigla_partido,sigla_uf")
      .eq("votacao_id", data.id);

    // Disciplina partidária: para cada partido, o tipo de voto majoritário e a fração que seguiu
    const porPartido = new Map<string, Map<string, number>>();
    const porUf = new Map<string, Map<string, number>>();
    for (const x of votos ?? []) {
      const part = (x.sigla_partido as string | null) ?? "—";
      const uf = (x.sigla_uf as string | null) ?? "—";
      const t = (x.tipo_voto as string) ?? "—";
      if (!porPartido.has(part)) porPartido.set(part, new Map());
      porPartido.get(part)!.set(t, (porPartido.get(part)!.get(t) ?? 0) + 1);
      if (!porUf.has(uf)) porUf.set(uf, new Map());
      porUf.get(uf)!.set(t, (porUf.get(uf)!.get(t) ?? 0) + 1);
    }
    const disciplina = [...porPartido.entries()].map(([part, m]) => {
      const total = [...m.values()].reduce((s, n) => s + n, 0);
      const entradas = [...m.entries()].sort((a, b) => b[1] - a[1]);
      const [majTipo, majN] = entradas[0] ?? ["—", 0];
      return { partido: part, total, majTipo, indice: total ? majN / total : 0, detalhe: entradas };
    }).sort((a, b) => b.total - a.total);

    const porUfArr = [...porUf.entries()].map(([uf, m]) => ({
      uf,
      total: [...m.values()].reduce((s, n) => s + n, 0),
      entradas: [...m.entries()].sort((a, b) => b[1] - a[1]),
    })).sort((a, b) => a.uf.localeCompare(b.uf));

    // Carrega nomes dos deputados
    const ids = [...new Set((votos ?? []).map((x) => x.deputado_id as number))];
    const { data: deps } = await supabaseAdmin
      .from("camara_deputados_cache").select("id,nome").in("id", ids.length ? ids : [0]);
    const nomes = new Map((deps ?? []).map((d) => [d.id as number, d.nome as string]));

    return {
      votacao: {
        id: v.id as string,
        data: v.data as string | null,
        siglaOrgao: v.sigla_orgao as string | null,
        descricao: v.descricao as string | null,
        aprovacao: v.aprovacao as number | null,
        descricaoResultado: v.descricao_resultado as string | null,
        proposicaoId: v.proposicao_id as number | null,
        proposicaoTitulo: v.proposicao_titulo as string | null,
        votosSim: v.votos_sim as number,
        votosNao: v.votos_nao as number,
        votosOutros: v.votos_outros as number,
      },
      votos: (votos ?? []).map((x) => ({
        deputadoId: x.deputado_id as number,
        nome: nomes.get(x.deputado_id as number) ?? `Deputado ${x.deputado_id}`,
        tipoVoto: x.tipo_voto as string,
        siglaPartido: x.sigla_partido as string | null,
        siglaUf: x.sigla_uf as string | null,
      })),
      disciplina,
      porUf: porUfArr,
    };
  });

export const camaraVotacoesOverview = createServerFn({ method: "GET" }).handler(async () => {
  const [{ count: nVot }, { count: nVotos }, ultRes] = await Promise.all([
    supabaseAdmin.from("camara_votacoes_cache").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("camara_votos_cache").select("votacao_id", { count: "exact", head: true }),
    supabaseAdmin.from("camara_votacoes_cache").select("data").order("data", { ascending: false, nullsFirst: false }).limit(1),
  ]);
  return {
    totalVotacoes: nVot ?? 0,
    totalVotos: nVotos ?? 0,
    ultimaData: (ultRes.data?.[0]?.data as string | null) ?? null,
  };
});