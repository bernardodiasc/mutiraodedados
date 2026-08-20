import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";

export const LACUNA_TIPOS = [
  "transparencia",
  "avaliacao",
  "mensuracao",
  "documental",
  "institucional",
  "metodologica",
] as const;
export type LacunaTipo = (typeof LACUNA_TIPOS)[number];

export const LACUNA_CICLOS = ["nasce", "qualificada", "evolui", "conecta", "encerra"] as const;
export type LacunaCiclo = (typeof LACUNA_CICLOS)[number];

export type Lacuna = {
  id: string;
  titulo: string;
  descricao: string;
  tipo: LacunaTipo;
  ciclo: LacunaCiclo;
  entidade_tipo: string | null;
  entidade_id: string | null;
  origem_qa_finding_id: string | null;
  tags: string[];
  publicada: boolean;
  resolvida_em: string | null;
  created_at: string;
  updated_at: string;
};

const COLS =
  "id, titulo, descricao, tipo, ciclo, entidade_tipo, entidade_id, origem_qa_finding_id, tags, publicada, resolvida_em, created_at, updated_at";

function publicClient() {
  return createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

const listarSchema = z
  .object({
    tipo: z.enum(LACUNA_TIPOS).optional(),
    ciclo: z.enum(LACUNA_CICLOS).optional(),
    limit: z.number().int().min(1).max(200).optional(),
  })
  .optional();

export const listarLacunasPublicas = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => listarSchema.parse(data))
  .handler(async ({ data }) => {
    const supabase = publicClient();
    let q = supabase
      .from("lacunas")
      .select(COLS)
      .eq("publicada", true)
      .order("created_at", { ascending: false })
      .limit(data?.limit ?? 100);
    if (data?.tipo) q = q.eq("tipo", data.tipo);
    if (data?.ciclo) q = q.eq("ciclo", data.ciclo);
    const { data: rows, error } = await q;
    if (error) {
      console.error("[listarLacunasPublicas] erro", error);
      throw new Error(`Falha ao listar lacunas: ${error.message}`);
    }
    return (rows ?? []) as Lacuna[];
  });

const criarSchema = z.object({
  titulo: z.string().trim().min(4).max(240),
  descricao: z.string().trim().min(10).max(4000),
  tipo: z.enum(LACUNA_TIPOS),
  ciclo: z.enum(LACUNA_CICLOS).optional(),
  entidade_tipo: z.string().trim().max(40).optional().nullable(),
  entidade_id: z.string().trim().max(200).optional().nullable(),
  origem_qa_finding_id: z.string().uuid().optional().nullable(),
  tags: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
  publicada: z.boolean().optional(),
});

export const criarLacuna = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => criarSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Apenas administradores podem criar lacunas.");
    const payload = {
      titulo: data.titulo,
      descricao: data.descricao,
      tipo: data.tipo,
      ciclo: data.ciclo ?? "nasce",
      entidade_tipo: data.entidade_tipo ?? null,
      entidade_id: data.entidade_id ?? null,
      origem_qa_finding_id: data.origem_qa_finding_id ?? null,
      tags: data.tags ?? [],
      publicada: data.publicada ?? true,
      criada_por: userId,
    };
    const { data: row, error } = await supabase
      .from("lacunas")
      .insert(payload)
      .select(COLS)
      .single();
    if (error) {
      console.error("[criarLacuna] erro", error);
      throw new Error(`Falha ao criar lacuna: ${error.message}`);
    }
    return row as Lacuna;
  });

const atualizarSchema = z.object({
  id: z.string().uuid(),
  titulo: z.string().trim().min(4).max(240).optional(),
  descricao: z.string().trim().min(10).max(4000).optional(),
  tipo: z.enum(LACUNA_TIPOS).optional(),
  ciclo: z.enum(LACUNA_CICLOS).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
  publicada: z.boolean().optional(),
  resolvida_em: z.string().datetime().optional().nullable(),
});

export const atualizarLacuna = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => atualizarSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Apenas administradores podem atualizar lacunas.");
    const { id, ...patch } = data;
    const { data: row, error } = await supabase
      .from("lacunas")
      .update(patch)
      .eq("id", id)
      .select(COLS)
      .single();
    if (error) {
      console.error("[atualizarLacuna] erro", error);
      throw new Error(`Falha ao atualizar lacuna: ${error.message}`);
    }
    return row as Lacuna;
  });

const converterSchema = z.object({
  finding_id: z.string().uuid(),
  tipo: z.enum(LACUNA_TIPOS),
  titulo: z.string().trim().min(4).max(240),
  descricao: z.string().trim().min(10).max(4000),
  publicada: z.boolean().optional(),
});

/**
 * Converte um finding de qualidade em uma Lacuna candidata.
 * Admin valida o tipo, título e descrição (linguagem cidadã).
 */
export const converterFindingEmLacuna = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => converterSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Apenas administradores podem converter findings.");
    const { data: finding, error: fErr } = await supabase
      .from("qa_findings")
      .select("id, entidade_tipo, entidade_id, fonte")
      .eq("id", data.finding_id)
      .maybeSingle();
    if (fErr) throw new Error(`Falha ao ler finding: ${fErr.message}`);
    const payload = {
      titulo: data.titulo,
      descricao: data.descricao,
      tipo: data.tipo,
      ciclo: "qualificada" as const,
      entidade_tipo: finding?.entidade_tipo ?? null,
      entidade_id: finding?.entidade_id ?? null,
      origem_qa_finding_id: data.finding_id,
      tags: finding?.fonte ? [finding.fonte] : [],
      publicada: data.publicada ?? true,
      criada_por: userId,
    };
    const { data: row, error } = await supabase
      .from("lacunas")
      .insert(payload)
      .select(COLS)
      .single();
    if (error) {
      console.error("[converterFindingEmLacuna] erro", error);
      throw new Error(`Falha ao converter finding: ${error.message}`);
    }
    return row as Lacuna;
  });

const listarAdminSchema = z
  .object({
    tipo: z.enum(LACUNA_TIPOS).optional(),
    ciclo: z.enum(LACUNA_CICLOS).optional(),
    publicada: z.boolean().optional(),
    limit: z.number().int().min(1).max(500).optional(),
  })
  .optional();

/**
 * Listagem completa para `/admin/lacunas` — inclui as não publicadas, que a
 * listagem pública nunca devolve. Service role após checagem de admin, como
 * nas demais listagens administrativas.
 */
export const listarLacunasAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => listarAdminSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Apenas administradores podem listar todas as lacunas.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("lacunas")
      .select(COLS)
      .order("created_at", { ascending: false })
      .limit(data?.limit ?? 200);
    if (data?.tipo) q = q.eq("tipo", data.tipo);
    if (data?.ciclo) q = q.eq("ciclo", data.ciclo);
    if (data?.publicada !== undefined) q = q.eq("publicada", data.publicada);
    const { data: rows, error } = await q;
    if (error) throw new Error(`Falha ao listar lacunas: ${error.message}`);
    return (rows ?? []) as Lacuna[];
  });
