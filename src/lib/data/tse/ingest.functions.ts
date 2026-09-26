/**
 * Server functions de importação da fonte TSE (admin-only).
 *
 * Cada chamada processa UM chunk (tipo de arquivo, ano, UF) — restrição de
 * tempo do Worker; a UI dispara em loop com auto-continue (padrão
 * AdminImportContainer). Código admin (supabaseAdmin) só é carregado dentro
 * dos handlers via `await import` (import protection).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  TSE_ANOS_ELEICAO,
  TSE_TIPOS_ARQUIVO,
  TSE_UFS,
  anoInicioTipo,
  combinacaoValida,
  origemDisponivel,
} from "@/lib/data/tse/client-ckan";
import { dentroDaJanelaAnual } from "@/lib/data/janelas";

/**
 * Ano de eleição coberto pela fonte e dentro da janela de disponibilidade.
 * Anual, não mensal: a eleição em curso é importável desde o dia em que o TSE
 * começa a publicar o registro das candidaturas.
 */
export const anoEleicaoTseSchema = z
  .number()
  .refine((a) => (TSE_ANOS_ELEICAO as readonly number[]).includes(a), {
    message: `Ano deve ser uma eleição coberta pela fonte (${TSE_ANOS_ELEICAO.join(", ")}).`,
  })
  .refine((a) => dentroDaJanelaAnual("tse", a), {
    message: "Fora da janela da fonte TSE (1998 até o ano corrente).",
  });

const chunkSchema = z.object({
  ano: anoEleicaoTseSchema,
  uf: z.enum(TSE_UFS),
  reprocessar: z.boolean().optional(),
});

/**
 * Um arquivo do TSE — tipo × ano × UF —, como o modo nomeado de
 * `/api/cron-importar` o recebe. Recusa a combinação que o TSE não publica
 * (bens antes de 2006, contas antes de 2012, votação e contas da eleição em
 * curso, "BR" em eleição municipal).
 */
export const arquivoTseSchema = z
  .object({ tipo: z.enum(TSE_TIPOS_ARQUIVO), ano: anoEleicaoTseSchema, uf: z.enum(TSE_UFS) })
  .superRefine((p, ctx) => {
    if (combinacaoValida(p.tipo, p.ano, p.uf)) return;
    const motivo = !origemDisponivel(p.tipo, p.ano)
      ? p.ano < anoInicioTipo(p.tipo)
        ? `o TSE só publica ${p.tipo} a partir de ${anoInicioTipo(p.tipo)}`
        : `o TSE ainda não publicou ${p.tipo} de ${p.ano}`
      : `"BR" não existe em eleição municipal (${p.ano})`;
    ctx.addIssue({ code: "custom", message: motivo });
  });

type TseSyncTipo = "candidatos" | "bens" | "resultados" | "receitas" | "despesas";

/**
 * Corpo compartilhado dos 5 handlers de importação. Cada server function abaixo
 * é definida INLINE no topo do módulo (não por factory) — o compilador do
 * TanStack Start precisa enxergar cada `createServerFn().handler()`
 * estaticamente para separar o código de servidor do bundle do cliente. Server
 * function criada dentro de uma factory não é extraída e o handler (com
 * `supabaseAdmin`) vaza para o cliente, onde `process.env` não existe.
 */
async function executarSyncTse(
  tipo: TseSyncTipo,
  userId: string,
  data: z.infer<typeof chunkSchema>,
) {
  const { ensureAdmin, sincronizarArquivoTse } = await import("@/lib/data/tse/ingest.server");
  await ensureAdmin(userId);
  return sincronizarArquivoTse({
    tipo,
    ano: data.ano,
    uf: data.uf,
    userId,
    reprocessar: data.reprocessar,
  });
}

/** Catálogo eleitoral: candidatos por (ano, UF). */
export const sincronizarTseCandidatos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => chunkSchema.parse(data))
  .handler(async ({ context, data }) => executarSyncTse("candidatos", context.userId, data));

/** Bens declarados por (ano, UF) — também agrega bens_total_declarado na ficha. */
export const sincronizarTseBens = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => chunkSchema.parse(data))
  .handler(async ({ context, data }) => executarSyncTse("bens", context.userId, data));

/** Resultados por município (zonas agregadas) por (ano, UF). */
export const sincronizarTseResultados = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => chunkSchema.parse(data))
  .handler(async ({ context, data }) => executarSyncTse("resultados", context.userId, data));

/** Receitas de campanha por (ano, UF) — arquivos grandes; retomável. */
export const sincronizarTseReceitas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => chunkSchema.parse(data))
  .handler(async ({ context, data }) => executarSyncTse("receitas", context.userId, data));

/** Despesas (contratadas) de campanha por (ano, UF) — retomável. */
export const sincronizarTseDespesas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => chunkSchema.parse(data))
  .handler(async ({ context, data }) => executarSyncTse("despesas", context.userId, data));

/** Progresso das varreduras TSE (chave tipo#ano#UF) — alimenta a aba TSE do admin. */
export const listarProgressoTse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { ensureAdmin, progressoTse } = await import("@/lib/data/tse/ingest.server");
    await ensureAdmin(context.userId);
    return progressoTse();
  });
