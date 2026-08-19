import { createServerFn } from "@tanstack/react-start";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import type { VariavelDef } from "@/lib/kit-investigacao/logic";
import { z } from "zod";

/**
 * Prompts do Kit de investigação: modelos curados (admin) que o usuário copia
 * para a IA dele, vinculados N:N aos mapas via mapa_prompts. RLS garante que o
 * público só vê prompts ativos vinculados a mapa público.
 *
 * `variaveis` é jsonb estruturado (nome + dica + link interno), editável em
 * /admin/prompts — ver [`kit-investigacao/logic.ts`].
 */

export type PromptModelo = {
  id: string;
  titulo: string;
  descricao: string | null;
  prompt_template: string;
  variaveis: VariavelDef[];
  tags: string[];
  ordem: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
};

// Cada variável: nome obrigatório; dica/link opcionais. href só aceita rota
// interna (começa com "/") — nunca link externo.
const variavelSchema = z.object({
  nome: z.string().trim().min(1).max(60),
  dica: z.string().trim().max(300).optional().nullable(),
  href: z
    .string()
    .trim()
    .max(200)
    .regex(/^\//, "O link deve ser uma rota interna (começa com /).")
    .optional()
    .nullable(),
  hrefLabel: z.string().trim().max(60).optional().nullable(),
});

const COLS =
  "id, titulo, descricao, prompt_template, variaveis, tags, ordem, ativo, created_at, updated_at";

function publicClient() {
  return createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

async function ensureAdmin(supabase: SupabaseClient<Database>, userId: string) {
  const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!isAdmin) throw new Error("Apenas administradores.");
}

// ---------- público ----------

const doMapaSchema = z.object({ artigoId: z.string().uuid() });
export const listarPromptsDoMapa = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => doMapaSchema.parse(data))
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const { data: vinculos, error: errV } = await supabase
      .from("mapa_prompts")
      .select("prompt_modelo_id, ordem")
      .eq("artigo_id", data.artigoId)
      .order("ordem", { ascending: true });
    if (errV) throw new Error(`Falha ao listar prompts do mapa: ${errV.message}`);
    const ids = (vinculos ?? []).map((v) => v.prompt_modelo_id);
    if (ids.length === 0) return [] as PromptModelo[];
    const { data: prompts, error } = await supabase
      .from("prompt_modelos")
      .select(COLS)
      .in("id", ids);
    if (error) throw new Error(`Falha ao carregar prompts: ${error.message}`);
    const porId = new Map((prompts ?? []).map((p) => [p.id, p as PromptModelo]));
    return ids.map((id) => porId.get(id)).filter((p): p is PromptModelo => Boolean(p));
  });

// ---------- admin ----------

export const listarTodosPrompts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);
    const { data, error } = await supabase
      .from("prompt_modelos")
      .select(COLS)
      .order("ordem", { ascending: true });
    if (error) throw new Error(`Falha ao listar prompts: ${error.message}`);
    return (data ?? []) as PromptModelo[];
  });

const criarSchema = z.object({
  titulo: z.string().trim().min(5).max(240),
  descricao: z.string().trim().max(2000).optional().nullable(),
  prompt_template: z.string().trim().min(10).max(8000),
  variaveis: z.array(variavelSchema).max(12).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
  ordem: z.number().int().optional(),
  ativo: z.boolean().optional(),
});

export const criarPrompt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => criarSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);
    const payload = {
      titulo: data.titulo,
      descricao: data.descricao ?? null,
      prompt_template: data.prompt_template,
      variaveis: data.variaveis ?? [],
      tags: data.tags ?? [],
      ordem: data.ordem ?? 0,
      ativo: data.ativo ?? true,
    };
    const { data: row, error } = await supabase
      .from("prompt_modelos")
      .insert(payload)
      .select(COLS)
      .single();
    if (error) throw new Error(`Falha ao criar prompt: ${error.message}`);
    return row as PromptModelo;
  });

const atualizarSchema = criarSchema.partial().extend({ id: z.string().uuid() });
export const atualizarPrompt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => atualizarSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);
    const { id, ...patch } = data;
    const { data: row, error } = await supabase
      .from("prompt_modelos")
      .update(patch)
      .eq("id", id)
      .select(COLS)
      .single();
    if (error) throw new Error(`Falha ao atualizar prompt: ${error.message}`);
    return row as PromptModelo;
  });

const idSchema = z.object({ id: z.string().uuid() });
export const excluirPrompt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => idSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);
    const { error } = await supabase.from("prompt_modelos").delete().eq("id", data.id);
    if (error) throw new Error(`Falha ao excluir prompt: ${error.message}`);
    return { ok: true };
  });

export type MapaPromptVinculo = {
  artigo_id: string;
  prompt_modelo_id: string;
  ordem: number;
};

/** Admin — todos os vínculos mapa↔prompt (para montar a tela de curadoria). */
export const listarVinculosAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);
    const { data, error } = await supabase
      .from("mapa_prompts")
      .select("artigo_id, prompt_modelo_id, ordem")
      .order("ordem", { ascending: true });
    if (error) throw new Error(`Falha ao listar vínculos: ${error.message}`);
    return (data ?? []) as MapaPromptVinculo[];
  });

const vincularSchema = z.object({
  artigo_id: z.string().uuid(),
  prompt_modelo_id: z.string().uuid(),
  ordem: z.number().int().optional(),
});
/** Vincula (ou reordena, se já vinculado) um prompt a um mapa. */
export const vincularPrompt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => vincularSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);
    const { error } = await supabase.from("mapa_prompts").upsert(
      {
        artigo_id: data.artigo_id,
        prompt_modelo_id: data.prompt_modelo_id,
        ordem: data.ordem ?? 0,
      },
      { onConflict: "artigo_id,prompt_modelo_id" },
    );
    if (error) throw new Error(`Falha ao vincular prompt: ${error.message}`);
    return { ok: true };
  });

const desvincularSchema = z.object({
  artigo_id: z.string().uuid(),
  prompt_modelo_id: z.string().uuid(),
});
export const desvincularPrompt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => desvincularSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);
    const { error } = await supabase
      .from("mapa_prompts")
      .delete()
      .eq("artigo_id", data.artigo_id)
      .eq("prompt_modelo_id", data.prompt_modelo_id);
    if (error) throw new Error(`Falha ao desvincular prompt: ${error.message}`);
    return { ok: true };
  });

/** Admin — reordena a lista geral de prompts (ordem padrão/admin, campo `ordem`). */
const reordenarSchema = z.object({ ids: z.array(z.string().uuid()).min(1).max(2000) });
export const reordenarPrompts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => reordenarSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);
    const resultados = await Promise.all(
      data.ids.map((id, i) => supabase.from("prompt_modelos").update({ ordem: i }).eq("id", id)),
    );
    const falha = resultados.find((r) => r.error);
    if (falha?.error) throw new Error(`Falha ao reordenar prompts: ${falha.error.message}`);
    return { ok: true };
  });

/** Admin — reordena os prompts vinculados a um mapa (ordem pública no Kit). */
const reordenarDoMapaSchema = z.object({
  artigo_id: z.string().uuid(),
  prompt_ids: z.array(z.string().uuid()).min(1).max(2000),
});
export const reordenarPromptsDoMapa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => reordenarDoMapaSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);
    const resultados = await Promise.all(
      data.prompt_ids.map((pid, i) =>
        supabase
          .from("mapa_prompts")
          .update({ ordem: i })
          .eq("artigo_id", data.artigo_id)
          .eq("prompt_modelo_id", pid),
      ),
    );
    const falha = resultados.find((r) => r.error);
    if (falha?.error) throw new Error(`Falha ao reordenar prompts do mapa: ${falha.error.message}`);
    return { ok: true };
  });
