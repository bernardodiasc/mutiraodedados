import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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

// -------------------------------------------------------------
// Contestações
// -------------------------------------------------------------
export type ContestacaoAdmin = {
  id: string;
  created_at: string;
  updated_at: string;
  url_pagina: string;
  tipo: string;
  solicitante_tipo: string;
  descricao: string;
  fundamento: string | null;
  contato: string | null;
  status: string;
  resposta: string | null;
  respondido_em: string | null;
};

export const listarContestacoesAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        status: z.enum(["aberta", "em_analise", "respondida", "arquivada"]).optional(),
        limit: z.number().int().min(1).max(500).default(200),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);
    let q = supabaseAdmin
      .from("contestacoes")
      .select(
        "id, created_at, updated_at, url_pagina, tipo, solicitante_tipo, descricao, fundamento, contato, status, resposta, respondido_em",
      )
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as ContestacaoAdmin[];
  });

export const atualizarContestacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["aberta", "em_analise", "respondida", "arquivada"]),
        resposta: z.string().max(8000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);
    const patch: {
      status: string;
      resposta?: string | null;
      respondido_em?: string | null;
      respondido_por?: string | null;
    } = { status: data.status };
    if (typeof data.resposta === "string") {
      const r = data.resposta.trim();
      patch.resposta = r || null;
      patch.respondido_em = r ? new Date().toISOString() : null;
      patch.respondido_por = r ? context.userId : null;
    }
    const { error } = await supabaseAdmin.from("contestacoes").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// -------------------------------------------------------------
// Marcações cidadãs (user_flags)
// -------------------------------------------------------------
export type MarcacaoAdmin = {
  id: string;
  user_id: string;
  entidade_tipo: string;
  entidade_id: string;
  tipo: string;
  comentario: string | null;
  created_at: string;
  votos_score: number;
  votos_total: number;
};

export const listarMarcacoesAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        entidade_tipo: z.enum(["orgao", "fornecedor", "contrato"]).optional(),
        limit: z.number().int().min(1).max(500).default(200),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);
    let q = supabaseAdmin
      .from("user_flags")
      .select("id, user_id, entidade_tipo, entidade_id, tipo, comentario, created_at")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.entidade_tipo) q = q.eq("entidade_tipo", data.entidade_tipo);
    const { data: flags, error } = await q;
    if (error) throw new Error(error.message);
    const lista = (flags ?? []) as Array<Omit<MarcacaoAdmin, "votos_score" | "votos_total">>;
    if (lista.length === 0) return [] as MarcacaoAdmin[];

    const ids = lista.map((f) => f.id);
    const { data: votos, error: errVotos } = await supabaseAdmin
      .from("votos_flag")
      .select("flag_id, valor")
      .in("flag_id", ids);
    if (errVotos) throw new Error(errVotos.message);
    const score = new Map<string, { soma: number; n: number }>();
    for (const v of votos ?? []) {
      const k = v.flag_id as string;
      const cur = score.get(k) ?? { soma: 0, n: 0 };
      cur.soma += (v.valor as number) ?? 0;
      cur.n += 1;
      score.set(k, cur);
    }
    return lista.map((f) => {
      const s = score.get(f.id) ?? { soma: 0, n: 0 };
      return { ...f, votos_score: s.soma, votos_total: s.n };
    }) as MarcacaoAdmin[];
  });

export const deletarMarcacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);
    const { error } = await supabaseAdmin.from("user_flags").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Status de investigação das marcações do usuário logado. Lookup por
// (entidade_tipo|entidade_id|regra=marcacao_<tipo>) com origem='marcacao_cidada'.
export type MarcacaoStatus = {
  status: string;
  severidade: string;
  reportado_em: string | null;
  reporte_canal: string | null;
  resolvido_em: string | null;
};

export const statusMarcacoesUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: flags, error: errF } = await supabaseAdmin
      .from("user_flags")
      .select("entidade_tipo, entidade_id, tipo")
      .eq("user_id", context.userId);
    if (errF) throw new Error(errF.message);
    const lista = flags ?? [];
    if (lista.length === 0) return {} as Record<string, MarcacaoStatus>;
    const ids = Array.from(new Set(lista.map((f) => f.entidade_id as string)));
    const { data: findings, error: errFi } = await supabaseAdmin
      .from("qa_findings")
      .select(
        "entidade_tipo, entidade_id, regra, status, severidade, reportado_em, reporte_canal, resolvido_em",
      )
      .eq("origem", "marcacao_cidada")
      .in("entidade_id", ids);
    if (errFi) throw new Error(errFi.message);
    const map: Record<string, MarcacaoStatus> = {};
    for (const f of findings ?? []) {
      const key = `${f.entidade_tipo}|${f.entidade_id}|${f.regra}`;
      map[key] = {
        status: (f.status as string) ?? "aberto",
        severidade: (f.severidade as string) ?? "aviso",
        reportado_em: (f.reportado_em as string | null) ?? null,
        reporte_canal: (f.reporte_canal as string | null) ?? null,
        resolvido_em: (f.resolvido_em as string | null) ?? null,
      };
    }
    return map;
  });

// Agregado pra dashboard
export const agregadoMarcacoes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context.userId);
    const [{ data: cts }, { data: fls }] = await Promise.all([
      supabaseAdmin.from("contestacoes").select("status"),
      supabaseAdmin.from("user_flags").select("entidade_tipo"),
    ]);
    const ctsAgg = { total: 0, aberta: 0, em_analise: 0, respondida: 0, arquivada: 0 };
    for (const r of cts ?? []) {
      ctsAgg.total++;
      const s = (r.status as string) || "aberta";
      if (s in ctsAgg) (ctsAgg as Record<string, number>)[s]++;
    }
    const flsAgg = { total: 0, orgao: 0, fornecedor: 0, contrato: 0 };
    for (const r of fls ?? []) {
      flsAgg.total++;
      const t = (r.entidade_tipo as string) || "";
      if (t in flsAgg) (flsAgg as Record<string, number>)[t]++;
    }
    return { contestacoes: ctsAgg, marcacoes: flsAgg };
  });
