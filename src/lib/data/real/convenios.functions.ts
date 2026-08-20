import { createServerFn } from "@tanstack/react-start";
import {
  mapearConvenioCache,
  type ConvenioCacheRow,
  type PortalConvenioRaw,
} from "@/lib/data/real/convenio-row";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { regrasCguConvenios, type CguConvenioLike } from "@/lib/data/qa";
import { ensureAdmin, isoToBR, montarVarreduraKey, varrerPaginado } from "@/lib/data/real/sweep";

/**
 * Ingest do endpoint /convenios do Portal da Transparência (CGU).
 *
 * Varredura por janela de dataReferencia (o endpoint filtra por mês de
 * referência). Desde a v0.9.0 grava na MESMA `convenios_cache` que o ingest
 * por ente (`transferegov/ingest.functions.ts`), via mapeador compartilhado —
 * as duas "tabelas por eixo" guardavam o mesmo registro do mesmo endpoint e
 * divergiam em silêncio.
 */

export const importConvenios = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        dataInicial: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        dataFinal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        maxPaginas: z.number().int().min(1).max(5000).default(5000),
        delayMs: z.number().int().min(0).max(10000).default(800),
        orcamentoMs: z.number().int().min(10000).max(230000).default(180000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);

    const TAM_PAGINA = 15;
    const varreduraKey = montarVarreduraKey("convenios", "geral", data.dataInicial, data.dataFinal);

    const r = await varrerPaginado<PortalConvenioRaw, ConvenioCacheRow>({
      entidade: "convenios",
      fonte: "cgu_convenios",
      endpoint: "/convenios",
      orgaoCodLog: "",
      escopo: "convênios",
      userId: context.userId,
      varreduraKey,
      tamPagina: TAM_PAGINA,
      maxPaginas: data.maxPaginas,
      delayMs: data.delayMs,
      orcamentoMs: data.orcamentoMs,
      montarParams: (pagina) => ({
        dataInicial: isoToBR(data.dataInicial),
        dataFinal: isoToBR(data.dataFinal),
        pagina: String(pagina),
      }),
      mapPagina: (list, _pagina, push) => {
        const rows = list
          .map((raw) => mapearConvenioCache(raw))
          .filter((r): r is ConvenioCacheRow => r !== null);
        for (const f of regrasCguConvenios(rows as CguConvenioLike[])) push.finding(f);
        return rows;
      },
      upsertBatch: async (rows) => {
        const erros: string[] = [];
        for (let i = 0; i < rows.length; i += 200) {
          const chunk = rows.slice(i, i + 200);
          const { error } = await supabaseAdmin.from("convenios_cache").upsert(chunk);
          if (error) erros.push(`db: ${error.message}`);
        }
        return erros;
      },
      rowDateIso: (row) => row.data_inicio_vigencia,
    });

    return {
      meta: {
        totalBruto: r.totalAcumulado,
        importados: r.totalAcumulado,
        erros: [...r.erros, ...r.avisos],
        fonte: "Portal da Transparência (CGU) — Convênios",
        consultadoEm: new Date().toISOString(),
        varredura: {
          ultimaPagina: r.ultimaPagina,
          completa: r.completa,
          haMais: r.haMais,
          totalAcumulado: r.totalAcumulado,
          orcamentoEsgotado: r.orcamentoEsgotado,
        },
      },
    };
  });
