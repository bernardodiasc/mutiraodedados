import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// Tipos polimórficos que o caderno reconhece. Lista aberta — basta adicionar
// novos valores quando uma página passar a oferecer "Salvar no caderno".
export const TIPOS_ENTIDADE = [
  "pergunta",
  "orgao",
  "contrato",
  "fornecedor",
  "anomalia",
  "parlamentar",
  "convenio",
  "votacao",
  "lacuna",
  "artigo",
  "mapa",
  "tutorial",
] as const;

export type EntidadeTipo = (typeof TIPOS_ENTIDADE)[number];

export type ItemSalvo = {
  id: string;
  user_id: string;
  entidade_tipo: string;
  entidade_id: string;
  titulo: string;
  url: string | null;
  contexto: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
};

const salvarSchema = z.object({
  entidade_tipo: z.enum(TIPOS_ENTIDADE),
  entidade_id: z.string().trim().min(1).max(200),
  titulo: z.string().trim().min(1).max(300),
  url: z.string().trim().max(500).optional().nullable(),
  contexto: z.string().trim().max(2000).optional().nullable(),
  tags: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
});

export const salvarItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => salvarSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const payload = {
      user_id: userId,
      entidade_tipo: data.entidade_tipo,
      entidade_id: data.entidade_id,
      titulo: data.titulo,
      url: data.url ?? null,
      contexto: data.contexto ?? null,
      tags: data.tags ?? [],
    };
    const { data: row, error } = await supabase
      .from("itens_salvos")
      .upsert(payload, { onConflict: "user_id,entidade_tipo,entidade_id" })
      .select("id, user_id, entidade_tipo, entidade_id, titulo, url, contexto, tags, created_at, updated_at")
      .single();
    if (error) {
      console.error("[salvarItem] erro", error);
      throw new Error(`Falha ao salvar item: ${error.message}`);
    }
    return row as ItemSalvo;
  });

export const listarMeusItens = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("itens_salvos")
      .select("id, user_id, entidade_tipo, entidade_id, titulo, url, contexto, tags, created_at, updated_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) {
      console.error("[listarMeusItens] erro", error);
      throw new Error(`Falha ao listar itens: ${error.message}`);
    }
    return (data ?? []) as ItemSalvo[];
  });

const verificarSchema = z.object({
  entidade_tipo: z.enum(TIPOS_ENTIDADE),
  entidade_id: z.string().trim().min(1).max(200),
});

export const verificarItemSalvo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => verificarSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("itens_salvos")
      .select("id")
      .eq("user_id", userId)
      .eq("entidade_tipo", data.entidade_tipo)
      .eq("entidade_id", data.entidade_id)
      .maybeSingle();
    if (error) {
      console.error("[verificarItemSalvo] erro", error);
      throw new Error(`Falha ao verificar item: ${error.message}`);
    }
    return { salvo: Boolean(row), id: row?.id ?? null };
  });

const excluirSchema = z.object({ id: z.string().uuid() });

export const excluirItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => excluirSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { error } = await supabase.from("itens_salvos").delete().eq("id", data.id);
    if (error) {
      console.error("[excluirItem] erro", error);
      throw new Error(`Falha ao excluir item: ${error.message}`);
    }
    return { ok: true };
  });