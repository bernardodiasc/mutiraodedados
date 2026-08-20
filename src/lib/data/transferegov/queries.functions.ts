import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Consultas do ângulo POR ENTE sobre a tabela única `convenios_cache`
 * (v0.9.0). Antes liam `transferegov_instrumentos_cache`, uma segunda tabela
 * com os mesmos registros do mesmo endpoint — fundida por ser duplicação.
 * Os nomes de campo seguem os canônicos da tabela (valor, valor_liberado,
 * convenente_*), e a ordenação por data usa vigência com assinatura junto —
 * a listagem do Portal frequentemente vem sem `dataAssinatura`.
 */

export type TransferenciaRow = {
  id: string;
  numero: string | null;
  codigo_siconv: string | null;
  tipo_instrumento: string | null;
  situacao: string | null;
  objeto: string | null;
  orgao_nome: string | null;
  convenente_nome: string | null;
  uf: string | null;
  municipio_nome: string | null;
  valor: number | null;
  valor_liberado: number | null;
  data_assinatura: string | null;
  data_inicio_vigencia: string | null;
};

const COLS_LISTA =
  "id,numero,codigo_siconv,tipo_instrumento,situacao,objeto,orgao_nome,convenente_nome,uf,municipio_nome,valor,valor_liberado,data_assinatura,data_inicio_vigencia";

export const listarTransferencias = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        uf: z.string().length(2).optional(),
        municipioIbge: z
          .string()
          .regex(/^\d{7}$/)
          .optional(),
        situacao: z.string().max(60).optional(),
        modalidade: z.string().max(60).optional(),
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
    let q = supabaseAdmin.from("convenios_cache").select(COLS_LISTA);
    if (data.sort === "valor_desc") q = q.order("valor", { ascending: false, nullsFirst: false });
    else if (data.sort === "repasse_desc")
      q = q.order("valor_liberado", { ascending: false, nullsFirst: false });
    else
      q = q
        .order("data_inicio_vigencia", { ascending: false, nullsFirst: false })
        .order("data_assinatura", { ascending: false, nullsFirst: false });
    q = q.range(data.offset, data.offset + data.limit - 1);

    if (data.uf) q = q.eq("uf", data.uf.toUpperCase());
    if (data.municipioIbge) q = q.eq("municipio_ibge", data.municipioIbge);
    if (data.situacao) q = q.ilike("situacao", `%${data.situacao}%`);
    if (data.modalidade) q = q.ilike("tipo_instrumento", `%${data.modalidade}%`);
    if (data.ano) {
      // Ano fiscal do acervo: referência do Portal (cobre itens sem assinatura).
      q = q.eq("ano", data.ano);
    }
    if (data.valorMin != null) q = q.gte("valor", data.valorMin);
    if (data.q)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- `.or()` não aparece no tipo do builder após os filtros encadeados
      q = (q as any).or(
        `objeto.ilike.%${data.q}%,convenente_nome.ilike.%${data.q}%,orgao_nome.ilike.%${data.q}%,numero.ilike.%${data.q}%`,
      );

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { transferencias: (rows ?? []) as TransferenciaRow[] };
  });

export type InstrumentoDetalhe = TransferenciaRow & {
  esfera_convenente: string | null;
  convenente_cnpj: string | null;
  orgao_cnpj: string | null;
  valor_contrapartida: number | null;
  data_fim_vigencia: string | null;
  municipio_ibge: string | null;
};

export const obterInstrumento = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().min(1).max(200) }).parse(input))
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("convenios_cache")
      .select(
        `${COLS_LISTA},esfera_convenente,convenente_cnpj,orgao_cnpj,valor_contrapartida,data_fim_vigencia,municipio_ibge`,
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { instrumento: (row ?? null) as InstrumentoDetalhe | null };
  });
