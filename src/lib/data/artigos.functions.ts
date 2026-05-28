import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

export type ArtigoCategoria = "mapa" | "tutorial" | "nota";
export type ArtigoDificuldade = "iniciante" | "intermediario" | "avancado";

export type Artigo = {
  id: string;
  slug: string;
  titulo: string;
  resumo: string | null;
  conteudo_md: string;
  categoria: ArtigoCategoria;
  capa_url: string | null;
  dificuldade: ArtigoDificuldade | null;
  tempo_estimado_min: number | null;
  fontes_usadas: string[];
  notas_internas: string | null;
  publico: boolean;
  publicado_em: string | null;
  autor_id: string | null;
  created_at: string;
  updated_at: string;
};

const COLS_PUBLICO =
  "id,slug,titulo,resumo,conteudo_md,categoria,capa_url,dificuldade,tempo_estimado_min,fontes_usadas,publico,publicado_em,created_at,updated_at";

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

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const SalvarSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().min(1).max(160).regex(slugRegex, "Slug deve usar apenas letras minúsculas, números e hífens"),
  titulo: z.string().min(1).max(300),
  resumo: z.string().max(600).nullable().optional(),
  conteudo_md: z.string().max(100_000).default(""),
  categoria: z.enum(["mapa", "tutorial", "nota"]),
  capa_url: z.string().url().max(500).nullable().optional(),
  dificuldade: z.enum(["iniciante", "intermediario", "avancado"]).nullable().optional(),
  tempo_estimado_min: z.number().int().min(0).max(1000).nullable().optional(),
  fontes_usadas: z.array(z.string().min(1).max(120)).max(20).default([]),
  notas_internas: z.string().max(8000).nullable().optional(),
  publico: z.boolean().default(false),
  publicado_em: z.string().datetime().nullable().optional(),
});

/** Público — lista artigos publicados de uma categoria. */
export const listarArtigosPublicos = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ categoria: z.enum(["mapa", "tutorial", "nota"]).optional() }).parse(d ?? {}),
  )
  .handler(async ({ data }) => {
    let q = supabaseAdmin
      .from("artigos")
      .select(COLS_PUBLICO)
      .eq("publico", true)
      .not("publicado_em", "is", null)
      .lte("publicado_em", new Date().toISOString())
      .order("publicado_em", { ascending: false });
    if (data.categoria) q = q.eq("categoria", data.categoria);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({ ...r, notas_internas: null, autor_id: null })) as Artigo[];
  });

/** Público — busca um artigo publicado por slug. */
export const obterArtigoPublico = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ slug: z.string().min(1).max(160) }).parse(d))
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("artigos")
      .select(COLS_PUBLICO)
      .eq("slug", data.slug)
      .eq("publico", true)
      .not("publicado_em", "is", null)
      .lte("publicado_em", new Date().toISOString())
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return null;
    return { ...row, notas_internas: null, autor_id: null } as Artigo;
  });

/** Admin — lista todos os artigos. */
export const listarArtigos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("artigos")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as Artigo[];
  });

/** Admin — obtém um artigo (qualquer estado) por id. */
export const obterArtigo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);
    const { data: row, error } = await supabaseAdmin
      .from("artigos")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (row ?? null) as Artigo | null;
  });

export const salvarArtigo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SalvarSchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);
    const payload = {
      slug: data.slug,
      titulo: data.titulo,
      resumo: data.resumo ?? null,
      conteudo_md: data.conteudo_md ?? "",
      categoria: data.categoria,
      capa_url: data.capa_url ?? null,
      dificuldade: data.dificuldade ?? null,
      tempo_estimado_min: data.tempo_estimado_min ?? null,
      fontes_usadas: data.fontes_usadas ?? [],
      notas_internas: data.notas_internas ?? null,
      publico: data.publico,
      // Se marcado público e sem data, registra "agora" automaticamente.
      publicado_em: data.publico
        ? (data.publicado_em ?? new Date().toISOString())
        : (data.publicado_em ?? null),
    };
    if (data.id) {
      const { error } = await supabaseAdmin
        .from("artigos")
        .update(payload)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: row, error } = await supabaseAdmin
      .from("artigos")
      .insert({ ...payload, autor_id: context.userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row.id as string };
  });

export const excluirArtigo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);
    const { error } = await supabaseAdmin.from("artigos").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });