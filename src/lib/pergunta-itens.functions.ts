import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";

export const PERGUNTA_ITEM_TIPOS = [
  "contrato",
  "orgao",
  "fornecedor",
  "lacuna",
  "finding",
  "link",
  "anotacao",
  "convenio",
  "parlamentar",
  "votacao",
  "anomalia",
] as const;
export type PerguntaItemTipo = (typeof PERGUNTA_ITEM_TIPOS)[number];

export type PerguntaItem = {
  id: string;
  pergunta_id: string;
  user_id: string;
  tipo: PerguntaItemTipo;
  ref_id: string | null;
  titulo: string;
  url: string | null;
  nota: string | null;
  ordem: number;
  created_at: string;
};

const COLS = "id, pergunta_id, user_id, tipo, ref_id, titulo, url, nota, ordem, created_at";

function publicClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

const perguntaSchema = z.object({ pergunta_id: z.string().uuid() });

export const listarItensDaPergunta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => perguntaSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("pergunta_itens")
      .select(COLS)
      .eq("pergunta_id", data.pergunta_id)
      .order("ordem", { ascending: true })
      .limit(500);
    if (error) throw new Error(`Falha ao listar itens: ${error.message}`);
    return (rows ?? []) as PerguntaItem[];
  });

export const listarItensPublicos = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => perguntaSchema.parse(data))
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const { data: rows, error } = await supabase
      .from("pergunta_itens")
      .select(COLS)
      .eq("pergunta_id", data.pergunta_id)
      .order("ordem", { ascending: true })
      .limit(500);
    if (error) throw new Error(`Falha ao listar itens: ${error.message}`);
    return (rows ?? []) as PerguntaItem[];
  });

const adicionarSchema = z.object({
  pergunta_id: z.string().uuid(),
  tipo: z.enum(PERGUNTA_ITEM_TIPOS),
  ref_id: z.string().trim().max(200).optional().nullable(),
  titulo: z.string().trim().min(1).max(300),
  url: z.string().trim().max(500).optional().nullable(),
  nota: z.string().trim().max(2000).optional().nullable(),
  ordem: z.number().int().optional(),
});

export const adicionarItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => adicionarSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const payload = {
      pergunta_id: data.pergunta_id,
      user_id: userId,
      tipo: data.tipo,
      ref_id: data.ref_id ?? null,
      titulo: data.titulo,
      url: data.url ?? null,
      nota: data.nota ?? null,
      ordem: data.ordem ?? 0,
    };
    const { data: row, error } = await supabase
      .from("pergunta_itens")
      .insert(payload)
      .select(COLS)
      .single();
    if (error) throw new Error(`Falha ao adicionar item: ${error.message}`);
    return row as PerguntaItem;
  });

const idSchema = z.object({ id: z.string().uuid() });
export const removerItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => idSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { error } = await supabase.from("pergunta_itens").delete().eq("id", data.id);
    if (error) throw new Error(`Falha ao remover item: ${error.message}`);
    return { ok: true };
  });

// ---------- multi-pasta: salvar mesmo item em várias perguntas ----------

const refSchema = z.object({
  tipo: z.enum(PERGUNTA_ITEM_TIPOS),
  ref_id: z.string().trim().min(1).max(200),
});

export const listarPerguntasContendoItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => refSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("pergunta_itens")
      .select("id, pergunta_id")
      .eq("user_id", userId)
      .eq("tipo", data.tipo)
      .eq("ref_id", data.ref_id);
    if (error) throw new Error(`Falha ao verificar pastas: ${error.message}`);
    return (rows ?? []) as Array<{ id: string; pergunta_id: string }>;
  });

const toggleSchema = z.object({
  pergunta_id: z.string().uuid(),
  tipo: z.enum(PERGUNTA_ITEM_TIPOS),
  ref_id: z.string().trim().min(1).max(200),
  titulo: z.string().trim().min(1).max(300),
  url: z.string().trim().max(500).optional().nullable(),
});

export const toggleItemEmPergunta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => toggleSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: existing, error: er0 } = await supabase
      .from("pergunta_itens")
      .select("id")
      .eq("pergunta_id", data.pergunta_id)
      .eq("tipo", data.tipo)
      .eq("ref_id", data.ref_id)
      .maybeSingle();
    if (er0) throw new Error(`Falha ao consultar item: ${er0.message}`);
    if (existing) {
      const { error } = await supabase
        .from("pergunta_itens")
        .delete()
        .eq("id", existing.id);
      if (error) throw new Error(`Falha ao remover item: ${error.message}`);
      return { added: false };
    }
    const { error } = await supabase.from("pergunta_itens").insert({
      pergunta_id: data.pergunta_id,
      user_id: userId,
      tipo: data.tipo,
      ref_id: data.ref_id,
      titulo: data.titulo,
      url: data.url ?? null,
      ordem: 0,
    });
    if (error) throw new Error(`Falha ao adicionar item: ${error.message}`);
    return { added: true };
  });