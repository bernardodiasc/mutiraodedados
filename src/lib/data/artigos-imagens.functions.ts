import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

export type ImagemGaleria = {
  id: string;
  storage_path: string;
  url: string;
  nome_original: string;
  mime: string;
  tamanho_bytes: number;
  largura: number | null;
  altura: number | null;
  legenda: string | null;
  autor_id: string | null;
  created_at: string;
  updated_at: string;
};

const MIMES_OK = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
const MAX_BYTES = 5 * 1024 * 1024;

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

export const listarImagensGaleria = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        q: z.string().max(200).optional(),
        limit: z.number().int().min(1).max(200).default(60),
        offset: z.number().int().min(0).max(10_000).default(0),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);
    let q = supabaseAdmin
      .from("artigos_imagens")
      .select("*")
      .order("created_at", { ascending: false })
      .range(data.offset, data.offset + data.limit - 1);
    if (data.q && data.q.trim()) {
      // remove caracteres estruturais da sintaxe de filtros PostgREST (`.or=`)
      // para impedir injeção de condições adicionais via termo de busca
      const limpo = data.q
        .replace(/[%(),.*]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (limpo) {
        const termo = `%${limpo}%`;
        q = q.or(`nome_original.ilike.${termo},legenda.ilike.${termo}`);
      }
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as ImagemGaleria[];
  });

export const registrarImagemGaleria = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        storage_path: z.string().min(1).max(500),
        url: z.string().url().max(1000),
        nome_original: z.string().min(1).max(255),
        mime: z.enum(MIMES_OK),
        tamanho_bytes: z.number().int().min(1).max(MAX_BYTES),
        largura: z.number().int().min(1).max(20000).nullable().optional(),
        altura: z.number().int().min(1).max(20000).nullable().optional(),
        legenda: z.string().max(500).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);
    const { data: row, error } = await supabaseAdmin
      .from("artigos_imagens")
      .insert({
        storage_path: data.storage_path,
        url: data.url,
        nome_original: data.nome_original,
        mime: data.mime,
        tamanho_bytes: data.tamanho_bytes,
        largura: data.largura ?? null,
        altura: data.altura ?? null,
        legenda: data.legenda ?? null,
        autor_id: context.userId,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as ImagemGaleria;
  });

export const atualizarLegendaImagem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), legenda: z.string().max(500).nullable() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("artigos_imagens")
      .update({ legenda: data.legenda })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const excluirImagemGaleria = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);
    const { data: row, error: erroLoad } = await supabaseAdmin
      .from("artigos_imagens")
      .select("storage_path")
      .eq("id", data.id)
      .maybeSingle();
    if (erroLoad) throw new Error(erroLoad.message);
    if (!row) return { ok: true };
    const { error: erroStorage } = await supabaseAdmin.storage
      .from("artigos-imagens")
      .remove([row.storage_path]);
    if (erroStorage) throw new Error(erroStorage.message);
    const { error: erroDel } = await supabaseAdmin
      .from("artigos_imagens")
      .delete()
      .eq("id", data.id);
    if (erroDel) throw new Error(erroDel.message);
    return { ok: true };
  });

export const LIMITES_GALERIA = {
  MAX_BYTES,
  MIMES_OK: MIMES_OK as readonly string[],
};
