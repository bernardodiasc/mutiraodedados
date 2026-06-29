import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type Anotacao = {
  id: string;
  user_id: string;
  titulo: string | null;
  conteudo_md: string;
  entidade_tipo: string | null;
  entidade_id: string | null;
  pergunta_id: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
};

const COLS =
  "id, user_id, titulo, conteudo_md, entidade_tipo, entidade_id, pergunta_id, tags, created_at, updated_at";

const criarSchema = z.object({
  titulo: z.string().trim().max(200).optional().nullable(),
  conteudo_md: z.string().max(20000).optional(),
  entidade_tipo: z.string().trim().max(40).optional().nullable(),
  entidade_id: z.string().trim().max(200).optional().nullable(),
  pergunta_id: z.string().uuid().optional().nullable(),
  tags: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
});

export const criarAnotacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => criarSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const payload = {
      user_id: userId,
      titulo: data.titulo ?? null,
      conteudo_md: data.conteudo_md ?? "",
      entidade_tipo: data.entidade_tipo ?? null,
      entidade_id: data.entidade_id ?? null,
      pergunta_id: data.pergunta_id ?? null,
      tags: data.tags ?? [],
    };
    const { data: row, error } = await supabase
      .from("anotacoes")
      .insert(payload)
      .select(COLS)
      .single();
    if (error) {
      console.error("[criarAnotacao] erro", error);
      throw new Error(`Falha ao criar anotação: ${error.message}`);
    }
    return row as Anotacao;
  });

const atualizarSchema = z.object({
  id: z.string().uuid(),
  titulo: z.string().trim().max(200).optional().nullable(),
  conteudo_md: z.string().max(20000).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
});

export const atualizarAnotacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => atualizarSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const patch: {
      titulo?: string | null;
      conteudo_md?: string;
      tags?: string[];
    } = {};
    if (data.titulo !== undefined) patch.titulo = data.titulo;
    if (data.conteudo_md !== undefined) patch.conteudo_md = data.conteudo_md;
    if (data.tags !== undefined) patch.tags = data.tags;
    const { data: row, error } = await supabase
      .from("anotacoes")
      .update(patch)
      .eq("id", data.id)
      .select(COLS)
      .single();
    if (error) {
      console.error("[atualizarAnotacao] erro", error);
      throw new Error(`Falha ao atualizar anotação: ${error.message}`);
    }
    return row as Anotacao;
  });

export const listarMinhasAnotacoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("anotacoes")
      .select(COLS)
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(200);
    if (error) {
      console.error("[listarMinhasAnotacoes] erro", error);
      throw new Error(`Falha ao listar anotações: ${error.message}`);
    }
    return (data ?? []) as Anotacao[];
  });

const excluirSchema = z.object({ id: z.string().uuid() });

export const excluirAnotacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => excluirSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { error } = await supabase.from("anotacoes").delete().eq("id", data.id);
    if (error) {
      console.error("[excluirAnotacao] erro", error);
      throw new Error(`Falha ao excluir anotação: ${error.message}`);
    }
    return { ok: true };
  });