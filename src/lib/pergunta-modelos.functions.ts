import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

export type PerguntaModelo = {
  id: string;
  titulo: string;
  descricao: string | null;
  contexto: string | null;
  tags: string[];
  ordem: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
};

const COLS = "id, titulo, descricao, contexto, tags, ordem, ativo, created_at, updated_at";

// Leitura pública via service role (server-side), filtrando ativo=true. Evita a
// policy RLS de pergunta_modelos, que chama public.has_role(...) — função cujo
// EXECUTE foi revogado do anon (migração 20260629001626), o que quebrava o
// caminho anônimo com "permission denied for function has_role".
export const listarModelosAtivos = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data, error } = await supabaseAdmin
      .from("pergunta_modelos")
      .select(COLS)
      .eq("ativo", true)
      .order("ordem", { ascending: true })
      .limit(200);
    if (error) throw new Error(`Falha ao listar modelos: ${error.message}`);
    return (data ?? []) as PerguntaModelo[];
  });

const obterSchema = z.object({ id: z.string().uuid() });
export const obterModelo = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => obterSchema.parse(data))
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("pergunta_modelos")
      .select(COLS)
      .eq("id", data.id)
      .eq("ativo", true)
      .maybeSingle();
    if (error) throw new Error(`Falha ao carregar modelo: ${error.message}`);
    return row as PerguntaModelo | null;
  });

// ---------- admin ----------

export const listarTodosModelos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Apenas administradores.");
    const { data, error } = await supabase
      .from("pergunta_modelos")
      .select(COLS)
      .order("ordem", { ascending: true });
    if (error) throw new Error(`Falha ao listar modelos: ${error.message}`);
    return (data ?? []) as PerguntaModelo[];
  });

const criarSchema = z.object({
  titulo: z.string().trim().min(5).max(240),
  descricao: z.string().trim().max(2000).optional().nullable(),
  contexto: z.string().trim().max(4000).optional().nullable(),
  tags: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
  ordem: z.number().int().optional(),
  ativo: z.boolean().optional(),
});

export const criarModelo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => criarSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Apenas administradores.");
    const payload = {
      titulo: data.titulo,
      descricao: data.descricao ?? null,
      contexto: data.contexto ?? null,
      tags: data.tags ?? [],
      ordem: data.ordem ?? 0,
      ativo: data.ativo ?? true,
    };
    const { data: row, error } = await supabase
      .from("pergunta_modelos")
      .insert(payload)
      .select(COLS)
      .single();
    if (error) throw new Error(`Falha ao criar modelo: ${error.message}`);
    return row as PerguntaModelo;
  });

const atualizarSchema = z.object({
  id: z.string().uuid(),
  titulo: z.string().trim().min(5).max(240).optional(),
  descricao: z.string().trim().max(2000).optional().nullable(),
  contexto: z.string().trim().max(4000).optional().nullable(),
  tags: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
  ordem: z.number().int().optional(),
  ativo: z.boolean().optional(),
});
export const atualizarModelo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => atualizarSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Apenas administradores.");
    const { id, ...patch } = data;
    const { data: row, error } = await supabase
      .from("pergunta_modelos")
      .update(patch)
      .eq("id", id)
      .select(COLS)
      .single();
    if (error) throw new Error(`Falha ao atualizar modelo: ${error.message}`);
    return row as PerguntaModelo;
  });

const idSchema = z.object({ id: z.string().uuid() });
export const excluirModelo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => idSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Apenas administradores.");
    const { error } = await supabase.from("pergunta_modelos").delete().eq("id", data.id);
    if (error) throw new Error(`Falha ao excluir modelo: ${error.message}`);
    return { ok: true };
  });

const reordenarSchema = z.object({ ids: z.array(z.string().uuid()).min(1).max(2000) });
export const reordenarModelos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => reordenarSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Apenas administradores.");
    const resultados = await Promise.all(
      data.ids.map((id, i) => supabase.from("pergunta_modelos").update({ ordem: i }).eq("id", id)),
    );
    const falha = resultados.find((r) => r.error);
    if (falha?.error) throw new Error(`Falha ao reordenar modelos: ${falha.error.message}`);
    return { ok: true };
  });