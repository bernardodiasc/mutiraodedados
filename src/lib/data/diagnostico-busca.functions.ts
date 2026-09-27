import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { CATALOGO_COBERTURA, limiarDefasagemDias } from "@/lib/data/cobertura-catalogo";
import { ensureAdmin } from "@/lib/data/real/sweep";
import {
  COLECOES_DO_INDICE,
  linhaDiagnostico,
  type LinhaDiagnostico,
  type MedidasColecao,
} from "@/lib/diagnostico-busca/logic";

/**
 * Diagnóstico de busca por coleção (aba "Busca" do /admin/dados): conciliação
 * cache × publicáveis × índice, defasagem da importação e "reindexar recorte".
 *
 * Cada contagem é uma chamada própria com orçamento de tempo: estourou, a
 * medida fica null ("indisponível") e as outras seguem. O banco corta em 8 s
 * de qualquer jeito (tempo-limite da service_role).
 */

const ORCAMENTO_MEDIDA_MS = 6000;

const MEDIDAS = ["cache", "publicaveis", "indice"] as const;

async function medir(colecao: string, medida: (typeof MEDIDAS)[number]): Promise<number | null> {
  const { data, error } = await supabaseAdmin
    .rpc("busca_diagnostico", { p_colecao: colecao, p_medida: medida })
    .abortSignal(AbortSignal.timeout(ORCAMENTO_MEDIDA_MS));
  if (error) {
    console.error(`[diagnóstico de busca] ${colecao} ${medida}:`, error.message);
    return null;
  }
  return Number(data);
}

/** Conferência aprovada mais recente de uma fonte do Histórico, ou null. */
async function ultimaAprovada(fonte: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("importacoes")
    .select("consultado_em")
    .eq("fonte", fonte)
    .eq("conferencia->>estado", "aprovada")
    .order("consultado_em", { ascending: false })
    .limit(1);
  if (error) throw new Error(`Falha ao ler o Histórico de ${fonte}: ${error.message}`);
  return data?.[0]?.consultado_em ?? null;
}

export const diagnosticoBusca = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<LinhaDiagnostico[]> => {
    await ensureAdmin(context.userId);
    const agora = new Date();
    const comIndice = CATALOGO_COBERTURA.filter((e) => e.indice.length > 0);
    const ultimas = new Map(
      await Promise.all(
        comIndice.map(async (e) => [e.id, await ultimaAprovada(e.fonteHistorico ?? e.id)] as const),
      ),
    );
    return Promise.all(
      COLECOES_DO_INDICE.map(async (colecao) => {
        const [cache, publicaveis, indice] = await Promise.all(
          MEDIDAS.map((m) => medir(colecao, m)),
        );
        const medidas: MedidasColecao = { cache, publicaveis, indice };
        const fontes = comIndice
          .filter((e) => e.indice.includes(colecao))
          .map((e) => ({
            titulo: e.titulo,
            ultima: ultimas.get(e.id) ?? null,
            limiarDias: limiarDefasagemDias(e),
          }));
        return linhaDiagnostico({ colecao, medidas, fontes }, agora);
      }),
    );
  });

const reindexarSchema = z.object({
  colecao: z.enum(COLECOES_DO_INDICE as [string, ...string[]]),
  /** Ausente: a coleção inteira. */
  ids: z.array(z.string().trim().min(1).max(200)).min(1).max(1000).optional(),
});

/**
 * Reindexa um recorte: a coleção inteira ou uma lista de ids de origem. Grava
 * o que a projeção devolve e apaga do índice o que ela não devolve mais.
 * Coleção grande pode passar do tempo-limite do banco; nesse caso, o recorte
 * por ids ou a reconstrução pelo SQL (`busca_reconstruir`).
 */
export const reindexarBusca = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => reindexarSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ alteradas: number }> => {
    await ensureAdmin(context.userId);
    const { data: n, error } = await supabaseAdmin.rpc("busca_indexar", {
      p_colecao: data.colecao,
      p_ids: data.ids ?? (null as unknown as string[]),
      p_forcar: false,
    });
    if (error) {
      console.error("[reindexar busca]", data.colecao, error);
      throw new Error(
        error.code === "57014"
          ? "A coleção inteira passou do tempo-limite do banco. Reindexe por ids ou reconstrua pelo SQL (busca_reconstruir)."
          : `Não foi possível reindexar: ${error.message}`,
      );
    }
    return { alteradas: Number(n) };
  });
