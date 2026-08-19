/**
 * Server functions da ponte parlamentar↔candidato e da revalidação via API
 * DivulgaCandContas (admin-only). Import protection: código admin carregado
 * dentro dos handlers via `await import`.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Vincula parlamentares em exercício às suas candidaturas no cache TSE. */
export const sincronizarPonteParlamentarFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        casa: z.enum(["camara", "senado"]),
        offset: z.number().int().min(0).default(0),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { ensureAdmin } = await import("@/lib/data/tse/ingest.server");
    await ensureAdmin(context.userId);
    const { sincronizarPonteParlamentar } = await import("@/lib/data/tse/ponte.server");
    return sincronizarPonteParlamentar(data.casa, data.offset);
  });

/** Revalida uma candidatura contra a API DivulgaCandContas (dados frescos). */
export const revalidarCandidatoViaApi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        sq: z.string().regex(/^\d+$/),
        ano: z.number().int().min(1998).max(2100),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { ensureAdmin } = await import("@/lib/data/tse/ingest.server");
    await ensureAdmin(context.userId);
    const { revalidarCandidatoTse } = await import("@/lib/data/tse/revalidacao.server");
    return revalidarCandidatoTse(data.sq, data.ano);
  });
