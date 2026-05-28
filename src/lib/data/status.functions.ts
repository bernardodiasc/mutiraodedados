import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type StatusFonte = { updatedAt: string | null; count: number };
export type StatusFontesResult = {
  pncp: StatusFonte;
  siconfi: StatusFonte;
  transferegov: StatusFonte;
  camara: StatusFonte;
  senado: StatusFonte;
  contratosPorOrgao: Record<string, StatusFonte>;
};

async function aggOne(table: any): Promise<StatusFonte> {
  const [{ count }, { data }] = await Promise.all([
    supabaseAdmin.from(table).select("*", { count: "exact", head: true }),
    supabaseAdmin.from(table).select("updated_at").order("updated_at", { ascending: false }).limit(1),
  ]);
  return {
    count: count ?? 0,
    updatedAt: (data?.[0] as { updated_at?: string } | undefined)?.updated_at ?? null,
  };
}

export const statusFontes = createServerFn({ method: "GET" }).handler(async (): Promise<StatusFontesResult> => {
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
});