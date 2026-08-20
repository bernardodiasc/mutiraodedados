import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type TransferenciaRow = {
  id: string;
  numero: string;
  codigo_siconv: string | null;
  modalidade: string | null;
  situacao: string | null;
  objeto: string | null;
  orgao_concedente_nome: string | null;
  beneficiario_nome: string | null;
  uf_beneficiario: string | null;
  municipio_nome: string | null;
  valor_global: number;
  valor_repasse: number;
  data_assinatura: string | null;
  url_transferegov: string | null;
};

export const listarTransferencias = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        uf: z.string().length(2).optional(),
        municipioIbge: z.string().optional(),
        situacao: z.string().optional(),
        modalidade: z.string().optional(),
        ano: z.number().int().min(2000).max(2100).optional(),
        valorMin: z.number().min(0).optional(),
        sort: z.enum(["data_desc", "valor_desc", "repasse_desc"]).default("data_desc"),
        q: z.string().max(120).optional(),
        limit: z.number().int().min(1).max(200).default(50),
        offset: z.number().int().min(0).max(20000).default(0),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    let q = supabaseAdmin.from("transferegov_instrumentos_cache").select(
      // `codigo_siconv` monta a ficha no Transferegov; o Portal sai do id/número.
      "id,numero,codigo_siconv,modalidade,situacao,objeto,orgao_concedente_nome,beneficiario_nome,uf_beneficiario,municipio_nome,valor_global,valor_repasse,data_assinatura,url_transferegov",
    );
    if (data.sort === "valor_desc")
      q = q.order("valor_global", { ascending: false, nullsFirst: false });
    else if (data.sort === "repasse_desc")
      q = q.order("valor_repasse", { ascending: false, nullsFirst: false });
    else q = q.order("data_assinatura", { ascending: false, nullsFirst: false });
    q = q.range(data.offset, data.offset + data.limit - 1);

    if (data.uf) q = q.eq("uf_beneficiario", data.uf.toUpperCase());
    if (data.municipioIbge) q = q.eq("municipio_ibge", data.municipioIbge);
    if (data.situacao) q = q.ilike("situacao", `%${data.situacao}%`);
    if (data.modalidade) q = q.ilike("modalidade", `%${data.modalidade}%`);
    if (data.ano) {
      q = q.gte("data_assinatura", `${data.ano}-01-01`).lte("data_assinatura", `${data.ano}-12-31`);
    }
    if (data.valorMin != null) q = q.gte("valor_global", data.valorMin);
    if (data.q)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- `.or()` não aparece no tipo do builder após os filtros encadeados
      q = (q as any).or(
        `objeto.ilike.%${data.q}%,beneficiario_nome.ilike.%${data.q}%,orgao_concedente_nome.ilike.%${data.q}%,numero.ilike.%${data.q}%`,
      );

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { transferencias: (rows ?? []) as TransferenciaRow[] };
  });

export type InstrumentoDetalhe = TransferenciaRow & {
  esfera_beneficiario: string | null;
  beneficiario_cnpj: string | null;
  orgao_concedente_cnpj: string | null;
  valor_contrapartida: number | null;
  data_inicio_vigencia: string | null;
  data_fim_vigencia: string | null;
  municipio_ibge: string | null;
  codigo_siconv: string | null;
};

export const obterInstrumento = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().min(1).max(200) }).parse(input))
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("transferegov_instrumentos_cache")
      .select(
        "id,numero,codigo_siconv,modalidade,situacao,objeto,orgao_concedente_nome,orgao_concedente_cnpj,beneficiario_nome,beneficiario_cnpj,esfera_beneficiario,uf_beneficiario,municipio_ibge,municipio_nome,valor_global,valor_repasse,valor_contrapartida,data_assinatura,data_inicio_vigencia,data_fim_vigencia,url_transferegov",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { instrumento: (row ?? null) as InstrumentoDetalhe | null };
  });
