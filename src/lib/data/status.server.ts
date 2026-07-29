/**
 * Lógica server-only do status das fontes — usa `supabaseAdmin` (bypass de RLS).
 *
 * Vive num módulo `*.server.ts` carregado via `await import` de dentro dos
 * handlers em `status.functions.ts`. Assim nenhum símbolo de escopo de módulo
 * que sobrevive ao tree-shaking do cliente referencia `client.server` — o que
 * evita o vazamento do env-check para o bundle do cliente (ver
 * `docs/padroes/debug-problemas.ia.md` #3 e #5). `codigosComDados` é exportada
 * para reuso server-side direto (sem round-trip de RPC).
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { StatusFonte, StatusFontesResult } from "./status.functions";

/** Caches com coluna `updated_at` — as únicas contadas por `aggOne`. */
type TabelaComUpdatedAt =
  | "pncp_contratos_cache"
  | "siconfi_relatorios_cache"
  | "transferegov_instrumentos_cache"
  | "camara_deputados_cache"
  | "senado_senadores_cache";

async function aggOne(table: TabelaComUpdatedAt): Promise<StatusFonte> {
  const [{ count }, { data }] = await Promise.all([
    supabaseAdmin.from(table).select("*", { count: "exact", head: true }),
    supabaseAdmin
      .from(table)
      .select("updated_at")
      .order("updated_at", { ascending: false })
      .limit(1),
  ]);
  return {
    count: count ?? 0,
    updatedAt: (data?.[0] as { updated_at?: string } | undefined)?.updated_at ?? null,
  };
}

/**
 * Códigos SIAFI de órgão que aparecem em documentos já ingeridos (contratos ∪
 * licitações ∪ convênios). Fonte da lista pública dinâmica de `/orgaos` e do
 * conjunto que a sonda de atividade (`verificarAtividadeOrgaos`) verifica.
 */
export async function codigosComDados(): Promise<string[]> {
  const [contratos, licitacoes, convenios] = await Promise.all([
    supabaseAdmin.from("contratos_cache").select("orgao_cod").limit(50000),
    supabaseAdmin.from("cgu_licitacoes_cache").select("orgao_cod").limit(50000),
    supabaseAdmin.from("cgu_convenios_cache").select("orgao_cod").limit(50000),
  ]);
  const set = new Set<string>();
  for (const r of [
    ...(contratos.data ?? []),
    ...(licitacoes.data ?? []),
    ...(convenios.data ?? []),
  ]) {
    const cod = (r as { orgao_cod: string | null }).orgao_cod;
    if (cod) set.add(cod);
  }
  return [...set].sort();
}

export async function coletarStatusFontes(): Promise<StatusFontesResult> {
  const [pncp, siconfi, transferegov, camara, senado, contratos] = await Promise.all([
    aggOne("pncp_contratos_cache"),
    aggOne("siconfi_relatorios_cache"),
    aggOne("transferegov_instrumentos_cache"),
    aggOne("camara_deputados_cache"),
    aggOne("senado_senadores_cache"),
    supabaseAdmin
      .from("contratos_cache")
      .select("orgao_cod, updated_at")
      .order("updated_at", { ascending: false })
      .limit(10000),
  ]);

  const contratosPorOrgao: Record<string, StatusFonte> = {};
  for (const row of (contratos.data ?? []) as Array<{ orgao_cod: string; updated_at: string }>) {
    const cur = contratosPorOrgao[row.orgao_cod];
    if (!cur) {
      contratosPorOrgao[row.orgao_cod] = { updatedAt: row.updated_at, count: 1 };
    } else {
      cur.count += 1;
      if (!cur.updatedAt || row.updated_at > cur.updatedAt) cur.updatedAt = row.updated_at;
    }
  }

  return { pncp, siconfi, transferegov, camara, senado, contratosPorOrgao };
}
