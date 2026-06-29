import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
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

function publicClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

export const listarModelosAtivos = createServerFn({ method: "GET" })
  .handler(async () => {
    const supabase = publicClient();
    const { data, error } = await supabase
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
    const supabase = publicClient();
    const { data: row, error } = await supabase
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