/**
 * Server functions (admin) para rodar os sinais da fonte TSE — lacunas
 * (pós-importação) e investigativos (cruzamentos, re-execução em lote).
 * O gatilho pós-importação de contratos usa o mesmo runner em lote:
 * `doador_virou_fornecedor` é idempotente (flagQA por chave).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const anoSchema = z.object({ ano: z.number().int().min(1998).max(2100) });

export const rodarSinaisInvestigativosTse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => anoSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { ensureAdmin } = await import("@/lib/data/tse/ingest.server");
    await ensureAdmin(context.userId);
    const { rodarDoadorVirouFornecedor, rodarEvolucaoPatrimonial, rodarFornecedorConcentrado } =
      await import("@/lib/data/tse/sinais.server");
    const resultados = [
      await rodarDoadorVirouFornecedor(),
      await rodarEvolucaoPatrimonial(),
      await rodarFornecedorConcentrado(data.ano),
    ];
    return { resultados };
  });

export const rodarLacunasTse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    anoSchema.extend({ ativarCandidatoSemBens: z.boolean().optional() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const { ensureAdmin } = await import("@/lib/data/tse/ingest.server");
    await ensureAdmin(context.userId);
    const {
      rodarCandidatosSemBens,
      rodarEleitosSemContas,
      rodarParlamentarSemMatch,
      rodarSerieHistorica,
    } = await import("@/lib/data/tse/sinais.server");
    const resultados = [
      await rodarEleitosSemContas(data.ano),
      // Ativa por padrão (decisão de produto); o flag vira desligamento pontual.
      await rodarCandidatosSemBens(data.ano, data.ativarCandidatoSemBens ?? true),
      await rodarSerieHistorica(),
      await rodarParlamentarSemMatch(),
    ];
    return { resultados };
  });

/** Gatilho incremental pós-importação de contratos/emendas: só o cruzamento
 * doador↔fornecedor (idempotente; barato o bastante para rodar a cada lote). */
export const rodarDoadorVirouFornecedorFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { ensureAdmin } = await import("@/lib/data/tse/ingest.server");
    await ensureAdmin(context.userId);
    const { rodarDoadorVirouFornecedor } = await import("@/lib/data/tse/sinais.server");
    return rodarDoadorVirouFornecedor();
  });
