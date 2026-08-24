import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Vínculos da página do órgão com as demais fontes indexadas por `orgao_cod`.
 * Licitações e convênios sempre tiveram índice por órgão no banco — esta fn
 * leva o vínculo à UI (SecaoVinculos), com total real e amostra recente.
 */

export type VinculoOrgaoLicitacao = {
  id: string;
  numero: string | null;
  objeto: string | null;
  valor: number;
  data_abertura: string | null;
};

export type VinculoOrgaoConvenio = {
  id: string;
  numero: string | null;
  objeto: string | null;
  convenente_nome: string | null;
  uf: string | null;
  valor: number;
  data_inicio_vigencia: string | null;
};

export const vinculosDoOrgao = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ orgaoCod: z.string().min(1).max(20) }).parse(input))
  .handler(async ({ data }) => {
    const [lic, conv] = await Promise.all([
      supabaseAdmin
        .from("cgu_licitacoes_cache")
        .select("id,numero,objeto,valor,data_abertura", { count: "exact" })
        .eq("orgao_cod", data.orgaoCod)
        .order("data_abertura", { ascending: false, nullsFirst: false })
        .limit(10),
      supabaseAdmin
        .from("convenios_cache")
        .select("id,numero,objeto,convenente_nome,uf,valor,data_inicio_vigencia", {
          count: "exact",
        })
        .eq("orgao_cod", data.orgaoCod)
        .order("data_inicio_vigencia", { ascending: false, nullsFirst: false })
        .limit(10),
    ]);

    if (lic.error) throw new Error(lic.error.message);
    if (conv.error) throw new Error(conv.error.message);

    return {
      licitacoes: (lic.data ?? []) as VinculoOrgaoLicitacao[],
      totalLicitacoes: lic.count ?? 0,
      convenios: (conv.data ?? []) as VinculoOrgaoConvenio[],
      totalConvenios: conv.count ?? 0,
    };
  });
