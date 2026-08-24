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
        // CNPJ/CPF do fornecedor (só dígitos na tabela).
        fornecedor: z.string().max(20).optional(),
        ordem: z.enum(["data-desc", "data-asc", "valor-desc", "valor-asc"]).default("data-desc"),
        ate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        q: z.string().max(120).optional(),
        limit: z.number().int().min(1).max(500).default(100),
        offset: z.number().int().min(0).max(100000).default(0),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const coluna = data.ordem.startsWith("valor") ? "valor_global" : "data_assinatura";
    let q = supabaseAdmin
      .from("pncp_contratos_cache")
      .select(
        "id,numero_controle_pncp,orgao_nome,orgao_cnpj,esfera,uf,municipio_nome,objeto,fornecedor_nome,fornecedor_cnpj_cpf,valor_global,data_assinatura,url_pncp",
        { count: "exact" },
      )
      .order(coluna, { ascending: data.ordem.endsWith("-asc"), nullsFirst: false })
      .range(data.offset, data.offset + data.limit - 1);

    // Corte de estabilidade pela data de domínio (ver src/lib/listagem).
    if (data.ate) q = q.lte("data_assinatura", data.ate);
    if (data.uf) q = q.eq("uf", data.uf.toUpperCase());
    if (data.cnpjOrgao) q = q.eq("orgao_cnpj", data.cnpjOrgao);
    if (data.municipioIbge) q = q.eq("municipio_ibge", data.municipioIbge);
    if (data.esfera) q = q.eq("esfera", data.esfera);
    if (data.fornecedor) q = q.eq("fornecedor_cnpj_cpf", data.fornecedor.replace(/\D+/g, ""));
    if (data.q) q = q.ilike("objeto", `%${data.q}%`);

    const { data: rows, error, count } = await q;
    if (error) throw new Error(error.message);
    return {
      contratos: (rows ?? []) as ContratoPNCPRow[],
      total: count ?? 0,
      corteSugerido: new Date().toISOString().slice(0, 10),
    };
  });

/**
 * Detalhe de um contrato do PNCP — registros da lista têm página própria em
 * /contratos/$id, que tenta a base CGU e cai aqui (mesma página, duas fontes).
 */
export const getContratoPncpPorId = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ id: z.string().min(1).max(200) }).parse(input))
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("pncp_contratos_cache")
      .select(
        "id,numero_controle_pncp,orgao_nome,orgao_cnpj,esfera,uf,municipio_nome,objeto,fornecedor_nome,fornecedor_cnpj_cpf,valor_global,data_assinatura,url_pncp",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { contrato: (row ?? null) as ContratoPNCPRow | null };
  });

export const statsContratosPNCP = createServerFn({ method: "GET" }).handler(async () => {
  const { count } = await supabaseAdmin
    .from("pncp_contratos_cache")
    .select("id", { count: "exact", head: true });
  return { total: count ?? 0 };
});
