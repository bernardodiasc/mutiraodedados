import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";

export const PERGUNTA_STATUS = [
  "privada",
  "em_revisao",
  "publicada",
  "arquivada",
  "encerrada",
] as const;
export type PerguntaStatus = (typeof PERGUNTA_STATUS)[number];

export type Pergunta = {
  id: string;
  user_id: string;
  modelo_id: string | null;
  titulo: string;
  descricao: string | null;
  contexto: string | null;
  tags: string[];
  status: PerguntaStatus;
  visibilidade_publica: boolean;
  slug: string | null;
  publicada_em: string | null;
  arquivada_em: string | null;
  encerrada_em: string | null;
  solicitada_publicacao_em: string | null;
  motivo_rejeicao: string | null;
  created_at: string;
  updated_at: string;
};

const COLS =
  "id, user_id, modelo_id, titulo, descricao, contexto, tags, status, visibilidade_publica, slug, publicada_em, arquivada_em, encerrada_em, solicitada_publicacao_em, motivo_rejeicao, created_at, updated_at";

function publicClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

// ---------- criar / listar / obter (autor) ----------

const criarSchema = z.object({
  titulo: z.string().trim().min(5).max(240),
  descricao: z.string().trim().max(4000).optional().nullable(),
  contexto: z.string().trim().max(4000).optional().nullable(),
  modelo_id: z.string().uuid().optional().nullable(),
  tags: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
});

export const criarPergunta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => criarSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const payload = {
      user_id: userId,
      titulo: data.titulo,
      descricao: data.descricao ?? null,
      contexto: data.contexto ?? null,
      modelo_id: data.modelo_id ?? null,
      tags: data.tags ?? [],
      status: "privada" as PerguntaStatus,
      visibilidade_publica: false,
    };
    const { data: row, error } = await supabase
      .from("perguntas")
      .insert(payload)
      .select(COLS)
      .single();
    if (error) {
      console.error("[criarPergunta] erro", error);
      throw new Error(`Falha ao salvar pergunta: ${error.message}`);
    }
    return row as Pergunta;
  });

export const listarMinhasPerguntas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("perguntas")
      .select(COLS)
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(200);
    if (error) {
      console.error("[listarMinhasPerguntas] erro", error);
      throw new Error(`Falha ao listar perguntas: ${error.message}`);
    }
    return (data ?? []) as Pergunta[];
  });

const obterSchema = z.object({ id: z.string().uuid() });
export const obterPergunta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => obterSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("perguntas")
      .select(COLS)
      .eq("id", data.id)
      .single();
    if (error) {
      console.error("[obterPergunta] erro", error);
      throw new Error(`Falha ao carregar pergunta: ${error.message}`);
    }
    return row as Pergunta;
  });

const atualizarSchema = z.object({
  id: z.string().uuid(),
  titulo: z.string().trim().min(5).max(240).optional(),
  descricao: z.string().trim().max(4000).optional().nullable(),
  contexto: z.string().trim().max(4000).optional().nullable(),
  tags: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
});
export const atualizarPergunta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => atualizarSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { id, ...patch } = data;
    const { data: row, error } = await supabase
      .from("perguntas")
      .update(patch)
      .eq("id", id)
      .select(COLS)
      .single();
    if (error) {
      console.error("[atualizarPergunta] erro", error);
      throw new Error(`Falha ao atualizar pergunta: ${error.message}`);
    }
    return row as Pergunta;
  });

const idSchema = z.object({ id: z.string().uuid() });

export const excluirPergunta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => idSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { error } = await supabase.from("perguntas").delete().eq("id", data.id);
    if (error) {
      console.error("[excluirPergunta] erro", error);
      throw new Error(`Falha ao excluir pergunta: ${error.message}`);
    }
    return { ok: true };
  });

// ---------- transições de estado ----------

export const solicitarPublicacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => idSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("perguntas")
      .update({
        status: "em_revisao",
        solicitada_publicacao_em: new Date().toISOString(),
      })
      .eq("id", data.id)
      .select(COLS)
      .single();
    if (error) throw new Error(`Falha ao solicitar publicação: ${error.message}`);
    return row as Pergunta;
  });

export const arquivarPergunta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => idSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("perguntas")
      .update({
        status: "arquivada",
        visibilidade_publica: false,
        arquivada_em: new Date().toISOString(),
      })
      .eq("id", data.id)
      .select(COLS)
      .single();
    if (error) throw new Error(`Falha ao arquivar pergunta: ${error.message}`);
    return row as Pergunta;
  });

export const reabrirPergunta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => idSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("perguntas")
      .update({ status: "privada", arquivada_em: null })
      .eq("id", data.id)
      .select(COLS)
      .single();
    if (error) throw new Error(`Falha ao reabrir pergunta: ${error.message}`);
    return row as Pergunta;
  });

export const encerrarPergunta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => idSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("perguntas")
      .update({
        status: "encerrada",
        encerrada_em: new Date().toISOString(),
      })
      .eq("id", data.id)
      .select(COLS)
      .single();
    if (error) throw new Error(`Falha ao encerrar pergunta: ${error.message}`);
    return row as Pergunta;
  });

// ---------- moderação (admin) ----------

export const listarPerguntasEmRevisao = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Apenas administradores podem moderar perguntas.");
    const { data, error } = await supabase
      .from("perguntas")
      .select(COLS)
      .eq("status", "em_revisao")
      .order("solicitada_publicacao_em", { ascending: true })
      .limit(200);
    if (error) throw new Error(`Falha ao listar perguntas em revisão: ${error.message}`);
    return (data ?? []) as Pergunta[];
  });

const aprovarSchema = z.object({ id: z.string().uuid() });
export const aprovarPergunta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => aprovarSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Apenas administradores.");
    const { data: existing, error: er0 } = await supabase
      .from("perguntas")
      .select("titulo, slug")
      .eq("id", data.id)
      .single();
    if (er0) throw new Error(er0.message);
    const slug = existing.slug ?? `${slugify(existing.titulo)}-${data.id.slice(0, 8)}`;
    const { data: row, error } = await supabase
      .from("perguntas")
      .update({
        status: "publicada",
        visibilidade_publica: true,
        publicada_em: new Date().toISOString(),
        revisada_em: new Date().toISOString(),
        moderador_id: userId,
        slug,
        motivo_rejeicao: null,
      })
      .eq("id", data.id)
      .select(COLS)
      .single();
    if (error) throw new Error(`Falha ao aprovar: ${error.message}`);
    return row as Pergunta;
  });

const rejeitarSchema = z.object({
  id: z.string().uuid(),
  motivo: z.string().trim().min(5).max(2000),
});
export const rejeitarPergunta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => rejeitarSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Apenas administradores.");
    const { data: row, error } = await supabase
      .from("perguntas")
      .update({
        status: "privada",
        visibilidade_publica: false,
        revisada_em: new Date().toISOString(),
        moderador_id: userId,
        motivo_rejeicao: data.motivo,
      })
      .eq("id", data.id)
      .select(COLS)
      .single();
    if (error) throw new Error(`Falha ao rejeitar: ${error.message}`);
    return row as Pergunta;
  });

export const despublicarPergunta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => idSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Apenas administradores.");
    const { data: row, error } = await supabase
      .from("perguntas")
      .update({ status: "privada", visibilidade_publica: false })
      .eq("id", data.id)
      .select(COLS)
      .single();
    if (error) throw new Error(`Falha ao despublicar: ${error.message}`);
    return row as Pergunta;
  });

// Lista todas as perguntas publicadas, para o admin gerenciar (editar/despublicar).
export const listarPerguntasPublicasAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Apenas administradores.");
    const { data, error } = await supabase
      .from("perguntas")
      .select(COLS)
      .eq("visibilidade_publica", true)
      .order("publicada_em", { ascending: false })
      .limit(500);
    if (error) {
      console.error("[listarPerguntasPublicasAdmin] erro", error);
      throw new Error(`Falha ao listar perguntas publicadas: ${error.message}`);
    }
    return (data ?? []) as Pergunta[];
  });

const editarAdminSchema = z.object({
  id: z.string().uuid(),
  titulo: z.string().trim().min(5).max(240).optional(),
  descricao: z.string().trim().max(4000).optional().nullable(),
  contexto: z.string().trim().max(4000).optional().nullable(),
  tags: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
  slug: z.string().trim().min(3).max(160).regex(/^[a-z0-9-]+$/).optional(),
});
export const editarPerguntaAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => editarAdminSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Apenas administradores.");
    const { id, ...patch } = data;
    const { data: row, error } = await supabase
      .from("perguntas")
      .update(patch)
      .eq("id", id)
      .select(COLS)
      .single();
    if (error) {
      console.error("[editarPerguntaAdmin] erro", error);
      throw new Error(`Falha ao editar pergunta: ${error.message}`);
    }
    return row as Pergunta;
  });

// ---------- páginas públicas ----------

export const listarPerguntasPublicas = createServerFn({ method: "GET" })
  .handler(async () => {
    const supabase = publicClient();
    const { data, error } = await supabase
      .from("perguntas")
      .select(
        "id, titulo, descricao, contexto, tags, status, slug, publicada_em, encerrada_em, updated_at",
      )
      .eq("visibilidade_publica", true)
      .order("publicada_em", { ascending: false })
      .limit(100);
    if (error) throw new Error(`Falha ao listar perguntas públicas: ${error.message}`);
    return data ?? [];
  });

const slugSchema = z.object({ slug: z.string().min(1).max(160) });
export const obterPerguntaPublica = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => slugSchema.parse(data))
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const { data: row, error } = await supabase
      .from("perguntas")
      .select(
        "id, titulo, descricao, contexto, tags, status, slug, publicada_em, encerrada_em, updated_at",
      )
      .eq("slug", data.slug)
      .eq("visibilidade_publica", true)
      .maybeSingle();
    if (error) throw new Error(`Falha ao carregar pergunta: ${error.message}`);
    return row;
  });