import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type ContratoPNCPRow = {
  id: string;
  numero_controle_pncp: string;
  orgao_nome: string;
  orgao_cnpj: string;
  esfera: string | null;
  uf: string | null;
  municipio_nome: string | null;
  objeto: string | null;
  fornecedor_nome: string | null;
  fornecedor_cnpj_cpf: string | null;
  valor_global: number;
  data_assinatura: string | null;
  url_pncp: string | null;
};

export const listarContratosPNCP = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        uf: z.string().length(2).optional(),
        cnpjOrgao: z.string().optional(),
        municipioIbge: z.string().optional(),
        esfera: z.enum(["federal", "estadual", "municipal", "distrital"]).optional(),
        q: z.string().max(120).optional(),
        limit: z.number().int().min(1).max(200).default(50),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    let q = supabaseAdmin
      .from("pncp_contratos_cache")
      .select(
        "id,numero_controle_pncp,orgao_nome,orgao_cnpj,esfera,uf,municipio_nome,objeto,fornecedor_nome,fornecedor_cnpj_cpf,valor_global,data_assinatura,url_pncp",
      )
      .order("data_assinatura", { ascending: false, nullsFirst: false })
      .limit(data.limit);

    if (data.uf) q = q.eq("uf", data.uf.toUpperCase());
    if (data.cnpjOrgao) q = q.eq("orgao_cnpj", data.cnpjOrgao);
    if (data.municipioIbge) q = q.eq("municipio_ibge", data.municipioIbge);
    if (data.esfera) q = q.eq("esfera", data.esfera);
    if (data.q) q = q.ilike("objeto", `%${data.q}%`);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { contratos: (rows ?? []) as ContratoPNCPRow[] };
  });

export const statsContratosPNCP = createServerFn({ method: "GET" }).handler(async () => {
  const { count } = await supabaseAdmin
    .from("pncp_contratos_cache")
    .select("id", { count: "exact", head: true });
  return { total: count ?? 0 };
});
