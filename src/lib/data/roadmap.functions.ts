import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

export type RoadmapStatus = "planejado" | "em_andamento" | "concluido";
export type RoadmapItem = {
  id: string;
  titulo: string;
  descricao: string | null;
  status: RoadmapStatus;
  ordem: number;
  publico: boolean;
  notas: string | null;
  concluido_em: string | null;
  created_at: string;
  updated_at: string;
};

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

/** Público — todos os itens marcados como públicos (página /roadmap). */
export const listarRoadmapPublico = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("roadmap_itens")
    .select("id,titulo,descricao,status,ordem,publico,concluido_em,created_at,updated_at")
    .eq("publico", true)
    .order("ordem", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({ ...r, notas: null })) as RoadmapItem[];
});

/** Admin — todos os itens (públicos e internos). */
export const listarRoadmap = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("roadmap_itens")
      .select("*")
      .order("ordem", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as RoadmapItem[];
  });

const SalvarSchema = z.object({
  id: z.string().uuid().optional(),
  titulo: z.string().min(1).max(300),
  descricao: z.string().max(2000).nullable().optional(),
  status: z.enum(["planejado", "em_andamento", "concluido"]),
  ordem: z.number().int().min(0).max(100000).default(0),
  publico: z.boolean().default(true),
  notas: z.string().max(4000).nullable().optional(),
  concluido_em: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
});

export const salvarItemRoadmap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SalvarSchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);
    const payload = {
      titulo: data.titulo,
      descricao: data.descricao ?? null,
      status: data.status,
      ordem: data.ordem,
      publico: data.publico,
      notas: data.notas ?? null,
      concluido_em:
        data.status === "concluido"
          ? (data.concluido_em ?? new Date().toISOString().slice(0, 10))
          : null,
    };
    if (data.id) {
      const { error } = await supabaseAdmin.from("roadmap_itens").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: row, error } = await supabaseAdmin
      .from("roadmap_itens")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row.id as string };
  });

export const excluirItemRoadmap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);
    const { error } = await supabaseAdmin.from("roadmap_itens").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Admin — reordena itens: grava `ordem` = posição no array recebido. */
export const reordenarRoadmap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ ids: z.array(z.string().uuid()).min(1).max(2000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);
    const resultados = await Promise.all(
      data.ids.map((id, i) =>
        supabaseAdmin.from("roadmap_itens").update({ ordem: i }).eq("id", id),
      ),
    );
    const falha = resultados.find((r) => r.error);
    if (falha?.error) throw new Error(falha.error.message);
    return { ok: true };
  });
