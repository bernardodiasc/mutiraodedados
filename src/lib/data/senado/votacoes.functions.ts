import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BASE = "https://legis.senado.leg.br/dadosabertos";
const UA = "AuditoriaCidada/1.0 (+https://auditoria-cidada.lovable.app)";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// GET com retry/backoff (500 → 1500 → 4500 ms) para 429/5xx e erros de rede
// transitórios; 4xx é erro definitivo.
async function senadoGet<T = unknown>(path: string, tentativas = 4): Promise<T> {
  let ultimoErro = "sem resposta";
  for (let tent = 0; tent < tentativas; tent++) {
    if (tent > 0) await sleep(500 * 3 ** (tent - 1));
    let res: Response;
    try {
      res = await fetch(`${BASE}${path}`, { headers: { accept: "application/json", "user-agent": UA } });
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
    throw new Error(`Senado API ${res.status}: ${body.slice(0, 200)}`);
  }
  throw new Error(`Senado API indisponível após ${tentativas} tentativas (último: ${ultimoErro}).`);
}

function asArray<T>(v: T | T[] | null | undefined): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

async function ensureAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles").select("role")
    .eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (error) throw new Error("Falha ao verificar permissão.");
  if (data?.role !== "admin") throw new Error("Acesso restrito: somente administradores.");
}

type VotacaoItem = {
  CodigoSessaoVotacao?: string | number;
  CodigoSessao?: string | number;
  SessaoPlenaria?: { CodigoSessao?: string | number };
  DataSessao?: string;
  DescricaoVotacao?: string;
  Resultado?: string;
  Materia?: { CodigoMateria?: string | number; DescricaoIdentificacao?: string; SiglaMateria?: string };
  Votos?: { VotoParlamentar?: VotoItem | VotoItem[] };
};

type VotoItem = {
  CodigoParlamentar?: string | number;
  NomeParlamentar?: string;
  SiglaPartido?: string;
  SiglaUF?: string;
  Voto?: string;
};

function ymd(s: string): string {
  // "2025-05-12" → "20250512"
  return s.replace(/-/g, "");
}

/** Importa votações nominais em um intervalo de datas (até ~30 dias por chamada). */
export const importarVotacoesSenado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      dataInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      dataFim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);

    const json = await senadoGet<{
      ListaVotacoes?: { Votacoes?: { Votacao?: VotacaoItem | VotacaoItem[] } };
    }>(`/plenario/lista/votacao/${ymd(data.dataInicio)}/${ymd(data.dataFim)}`);

    const votacoes = asArray(json.ListaVotacoes?.Votacoes?.Votacao);
    if (votacoes.length === 0) return { votacoes: 0, votos: 0 };

    let totalVotos = 0;
    const erros: string[] = [];

    for (const v of votacoes) {
      try {
        const codSessao =
          v.CodigoSessaoVotacao ?? v.CodigoSessao ?? v.SessaoPlenaria?.CodigoSessao;
        if (!codSessao) continue;
        const id = String(codSessao);

        const votos = asArray(v.Votos?.VotoParlamentar);
        const tally = { sim: 0, nao: 0, outros: 0 };
        for (const x of votos) {
          const t = (x.Voto ?? "").toLowerCase().trim();
          if (t === "sim" || t.startsWith("sim")) tally.sim++;
          else if (t === "não" || t === "nao" || t.startsWith("nã") || t.startsWith("na")) tally.nao++;
          else tally.outros++;
        }

        const row = {
          id,
          data:
            v.DataSessao && /^\d{4}-\d{2}-\d{2}/.test(v.DataSessao)
              ? v.DataSessao.slice(0, 10)
              : null,
          descricao: (v.DescricaoVotacao ?? "").slice(0, 2000) || null,
          resultado: v.Resultado ?? null,
          materia_id: v.Materia?.CodigoMateria ? Number(v.Materia.CodigoMateria) : null,
          materia_titulo:
            v.Materia?.DescricaoIdentificacao ??
            (v.Materia?.SiglaMateria ? String(v.Materia.SiglaMateria) : null),
          sigla_orgao: "SF",
          votos_sim: tally.sim,
          votos_nao: tally.nao,
          votos_outros: tally.outros,
          updated_at: new Date().toISOString(),
        };
        const { error: e1 } = await supabaseAdmin.from("senado_votacoes_cache").upsert(row);
        if (e1) throw new Error(e1.message);

        const votoRows = votos
          .filter((x) => x.CodigoParlamentar)
          .map((x) => ({
            votacao_id: id,
            senador_id: Number(x.CodigoParlamentar),
            tipo_voto: (x.Voto ?? "—").slice(0, 40),
            sigla_partido: x.SiglaPartido ?? null,
            sigla_uf: x.SiglaUF ?? null,
            updated_at: new Date().toISOString(),
          }));

        if (votoRows.length > 0) {
          // limpa votos antigos desta votação para upsert idempotente (PK composta inexistente)
          await supabaseAdmin.from("senado_votos_cache").delete().eq("votacao_id", id);
          for (let i = 0; i < votoRows.length; i += 500) {
            const { error: e2 } = await supabaseAdmin
              .from("senado_votos_cache").insert(votoRows.slice(i, i + 500));
            if (e2) throw new Error(`votos: ${e2.message}`);
          }
          totalVotos += votoRows.length;
        }
      } catch (e) {
        erros.push(`vot: ${(e as Error).message}`);
      }
    }

    return { votacoes: votacoes.length, votos: totalVotos, erros };
  });

export const listarVotacoesSenado = createServerFn({ method: "GET" })
  .inputValidator((input) =>
    z.object({
      termo: z.string().max(120).optional(),
      limit: z.number().int().min(1).max(500).default(200),
    }).parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    let q = supabaseAdmin
      .from("senado_votacoes_cache")
      .select("id,data,descricao,resultado,materia_id,materia_titulo,votos_sim,votos_nao,votos_outros")
      .order("data", { ascending: false, nullsFirst: false })
      .limit(data.limit);
    if (data.termo) q = q.ilike("descricao", `%${data.termo}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({
      id: r.id as string,
      data: r.data as string | null,
      descricao: r.descricao as string | null,
      resultado: r.resultado as string | null,
      materiaId: r.materia_id as number | null,
      materiaTitulo: r.materia_titulo as string | null,
      votosSim: r.votos_sim as number,
      votosNao: r.votos_nao as number,
      votosOutros: r.votos_outros as number,
    }));
  });

export const getVotacaoSenadoDetalhe = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ id: z.string().min(1) }).parse(input))
  .handler(async ({ data }) => {
    const { data: v, error } = await supabaseAdmin
      .from("senado_votacoes_cache").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!v) return null;
    const { data: votos } = await supabaseAdmin
      .from("senado_votos_cache")
      .select("senador_id,tipo_voto,sigla_partido,sigla_uf")
      .eq("votacao_id", data.id);

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
      uf, total: [...m.values()].reduce((s, n) => s + n, 0),
      entradas: [...m.entries()].sort((a, b) => b[1] - a[1]),
    })).sort((a, b) => a.uf.localeCompare(b.uf));

    const ids = [...new Set((votos ?? []).map((x) => x.senador_id as number))];
    const { data: sens } = await supabaseAdmin
      .from("senado_senadores_cache").select("id,nome").in("id", ids.length ? ids : [0]);
    const nomes = new Map((sens ?? []).map((s) => [s.id as number, s.nome as string]));

    return {
      votacao: {
        id: v.id as string,
        data: v.data as string | null,
        descricao: v.descricao as string | null,
        resultado: v.resultado as string | null,
        materiaId: v.materia_id as number | null,
        materiaTitulo: v.materia_titulo as string | null,
        votosSim: v.votos_sim as number,
        votosNao: v.votos_nao as number,
        votosOutros: v.votos_outros as number,
      },
      votos: (votos ?? []).map((x) => ({
        senadorId: x.senador_id as number,
        nome: nomes.get(x.senador_id as number) ?? `Senador ${x.senador_id}`,
        tipoVoto: x.tipo_voto as string,
        siglaPartido: x.sigla_partido as string | null,
        siglaUf: x.sigla_uf as string | null,
      })),
      disciplina,
      porUf: porUfArr,
    };
  });

export const senadoVotacoesOverview = createServerFn({ method: "GET" }).handler(async () => {
  const [{ count: nVot }, { count: nVotos }, ultRes] = await Promise.all([
    supabaseAdmin.from("senado_votacoes_cache").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("senado_votos_cache").select("votacao_id", { count: "exact", head: true }),
    supabaseAdmin.from("senado_votacoes_cache").select("data").order("data", { ascending: false, nullsFirst: false }).limit(1),
  ]);
  return {
    totalVotacoes: nVot ?? 0,
    totalVotos: nVotos ?? 0,
    ultimaData: (ultRes.data?.[0]?.data as string | null) ?? null,
  };
});