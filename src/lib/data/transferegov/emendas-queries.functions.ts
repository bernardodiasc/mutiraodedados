import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type EmendaModalidade = "especial" | "finalidade_definida";

export type EmendaRow = {
  id: string;
  modalidade: EmendaModalidade;
  ano: number;
  numero_emenda: string | null;
  codigo_emenda: string | null;
  autor_emenda: string | null;
  beneficiario_nome: string | null;
  beneficiario_cnpj: string | null;
  uf: string | null;
  municipio_ibge: string | null;
  municipio_nome: string | null;
  valor: number;
  valor_pago: number;
  data_referencia: string | null;
  funcao: string | null;
  subfuncao: string | null;
  finalidade: string | null;
};

const COLS =
  "id,modalidade,ano,numero_emenda,codigo_emenda,autor_emenda,beneficiario_nome,beneficiario_cnpj,uf,municipio_ibge,municipio_nome,valor,valor_pago,data_referencia,funcao,subfuncao,finalidade";

export const listarEmendas = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        modalidade: z.enum(["especial", "finalidade_definida"]),
        uf: z.string().length(2).optional(),
        ano: z.number().int().min(2020).max(2100).optional(),
        q: z.string().max(120).optional(),
        valorMin: z.number().min(0).optional(),
        sort: z.enum(["data_desc", "valor_desc", "pago_desc"]).default("data_desc"),
        limit: z.number().int().min(1).max(200).default(50),
        offset: z.number().int().min(0).max(20000).default(0),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    let q = (supabaseAdmin.from as (t: string) => any)("transferegov_emendas_cache")
      .select(COLS)
      .eq("modalidade", data.modalidade);
    if (data.sort === "valor_desc") q = q.order("valor", { ascending: false, nullsFirst: false });
    else if (data.sort === "pago_desc") q = q.order("valor_pago", { ascending: false, nullsFirst: false });
    else q = q.order("data_referencia", { ascending: false, nullsFirst: false });
    q = q.range(data.offset, data.offset + data.limit - 1);
    if (data.uf) q = q.eq("uf", data.uf.toUpperCase());
    if (data.ano) q = q.eq("ano", data.ano);
    if (data.valorMin != null) q = q.gte("valor", data.valorMin);
    if (data.q)
      q = q.or(
        `beneficiario_nome.ilike.%${data.q}%,autor_emenda.ilike.%${data.q}%,finalidade.ilike.%${data.q}%,municipio_nome.ilike.%${data.q}%,numero_emenda.ilike.%${data.q}%`,
      );
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { emendas: (rows ?? []) as EmendaRow[] };
  });

export const obterEmenda = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().min(1).max(200) }).parse(input))
  .handler(async ({ data }) => {
    const { data: row, error } = await (supabaseAdmin.from as (t: string) => any)(
      "transferegov_emendas_cache",
    )
      .select(COLS)
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { emenda: (row ?? null) as EmendaRow | null };
  });