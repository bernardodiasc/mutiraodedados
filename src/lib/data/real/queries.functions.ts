import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { formatarCnpj } from "@/lib/cnpj";

/**
 * Leituras públicas das entidades-tópico da CGU (além de contratos, que tem
 * `getContratoPorId` em portal.functions.ts). Sem gate de admin: cache público
 * read-only.
 *
 * Contrato de listagem (kit src/lib/listagem): filtros + `ordem`
 * ("campo-direcao") + `ate` (corte de estabilidade) + limit/offset; resposta
 * com `total` real (count com os mesmos filtros) e `corteSugerido`. O corte é
 * aplicado sobre a DATA DE DOMÍNIO da lista (assinatura, abertura, vigência,
 * ano) — assim registros importados depois, que são mais novos, não deslocam
 * páginas já compartilhadas. Registros sem a data ficam fora quando há corte
 * (determinístico).
 */

const hojeISO = () => new Date().toISOString().slice(0, 10);

const ateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional();

function ordenar<Q extends { order: (c: string, o: object) => Q }>(
  q: Q,
  ordem: string,
  colunas: Record<string, string>,
  padrao: string,
): Q {
  const [campo, dir] = ordem.includes("-")
    ? [ordem.slice(0, ordem.lastIndexOf("-")), ordem.slice(ordem.lastIndexOf("-") + 1)]
    : [ordem, "desc"];
  const coluna = colunas[campo] ?? colunas[padrao];
  return q.order(coluna, { ascending: dir === "asc", nullsFirst: false });
}

export type LicitacaoRow = {
  id: string;
  orgao_cod: string;
  orgao_cnpj: string | null;
  unidade_gestora: string | null;
  ano: number;
  uf: string | null;
  municipio_ibge: string | null;
  municipio_nome: string | null;
  numero: string | null;
  numero_processo: string | null;
  objeto: string | null;
  modalidade: string | null;
  situacao: string | null;
  valor: number;
  data_abertura: string | null;
  data_publicacao: string | null;
  data_resultado: string | null;
  url_oficial: string | null;
};

const COLUNAS_LICITACAO =
  "id,orgao_cod,orgao_cnpj,unidade_gestora,ano,uf,municipio_ibge,municipio_nome,numero,numero_processo,objeto,modalidade,situacao,valor,data_abertura,data_publicacao,data_resultado,url_oficial";

export const listarLicitacoes = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        uf: z.string().length(2).optional(),
        orgaoCod: z.string().optional(),
        municipioIbge: z.string().optional(),
        modalidade: z.string().optional(),
        situacao: z.string().optional(),
        ano: z.number().int().min(2000).max(2100).optional(),
        valorMin: z.number().min(0).optional(),
        ordem: z.enum(["data-desc", "data-asc", "valor-desc", "valor-asc"]).default("data-desc"),
        ate: ateSchema,
        q: z.string().max(120).optional(),
        limit: z.number().int().min(1).max(500).default(100),
        offset: z.number().int().min(0).max(100000).default(0),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    let q = supabaseAdmin
      .from("cgu_licitacoes_cache")
      .select(COLUNAS_LICITACAO, { count: "exact" });
    q = ordenar(q, data.ordem, { data: "data_abertura", valor: "valor" }, "data");
    q = q.range(data.offset, data.offset + data.limit - 1);

    if (data.ate) q = q.lte("data_abertura", data.ate);
    if (data.uf) q = q.eq("uf", data.uf.toUpperCase());
    if (data.orgaoCod) q = q.eq("orgao_cod", data.orgaoCod);
    if (data.municipioIbge) q = q.eq("municipio_ibge", data.municipioIbge);
    if (data.modalidade) q = q.ilike("modalidade", `%${data.modalidade}%`);
    if (data.situacao) q = q.ilike("situacao", `%${data.situacao}%`);
    if (data.ano) {
      q = q.gte("data_abertura", `${data.ano}-01-01`).lte("data_abertura", `${data.ano}-12-31`);
    }
    if (data.valorMin != null) q = q.gte("valor", data.valorMin);
    if (data.q)
      q = (q as { or: (f: string) => typeof q }).or(
        `objeto.ilike.%${data.q}%,numero.ilike.%${data.q}%,numero_processo.ilike.%${data.q}%,unidade_gestora.ilike.%${data.q}%`,
      );

    const { data: rows, error, count } = await q;
    if (error) throw new Error(error.message);
    return {
      licitacoes: (rows ?? []) as LicitacaoRow[],
      total: count ?? 0,
      corteSugerido: hojeISO(),
    };
  });

export const getLicitacaoPorId = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ id: z.string().min(1).max(200) }).parse(input))
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("cgu_licitacoes_cache")
      .select(COLUNAS_LICITACAO)
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { licitacao: (row ?? null) as LicitacaoRow | null };
  });

// ===================== Emendas =====================

export type EmendaRow = {
  id: string;
  ano: number;
  tipo_emenda: string | null;
  autor: string | null;
  numero_emenda: string | null;
  localidade: string | null;
  uf: string | null;
  funcao: string | null;
  subfuncao: string | null;
  valor_empenhado: number;
  valor_liquidado: number;
  valor_pago: number;
  valor_resto_inscrito: number;
  valor_resto_pago: number;
  valor_resto_cancelado: number;
  // Detalhe de execução das EC 105 Especiais (Transferegov), null nas demais.
  planos_acao_count: number | null;
  valor_custeio: number | null;
  valor_investimento: number | null;
  beneficiario_nome: string | null;
  beneficiario_cnpj: string | null;
  plano_acao_situacao: string | null;
  areas_politicas: string | null;
  url_oficial: string | null;
};

const COLUNAS_EMENDA =
  "id,ano,tipo_emenda,autor,numero_emenda,localidade,uf,funcao,subfuncao,valor_empenhado,valor_liquidado,valor_pago,valor_resto_inscrito,valor_resto_pago,valor_resto_cancelado,planos_acao_count,valor_custeio,valor_investimento,beneficiario_nome,beneficiario_cnpj,plano_acao_situacao,areas_politicas,url_oficial";

export const listarEmendasCgu = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        uf: z.string().length(2).optional(),
        ano: z.number().int().min(2000).max(2100).optional(),
        funcao: z.string().optional(),
        tipoEmenda: z.string().optional(),
        autor: z.string().max(120).optional(),
        valorMin: z.number().min(0).optional(),
        ordem: z
          .enum(["ano-desc", "ano-asc", "pago-desc", "pago-asc", "empenhado-desc", "empenhado-asc"])
          .default("ano-desc"),
        ate: ateSchema,
        q: z.string().max(120).optional(),
        limit: z.number().int().min(1).max(500).default(100),
        offset: z.number().int().min(0).max(100000).default(0),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    let q = supabaseAdmin
      .from("cgu_transferegov_emendas_cache")
      .select(COLUNAS_EMENDA, { count: "exact" });
    q = ordenar(
      q,
      data.ordem,
      { ano: "ano", pago: "valor_pago", empenhado: "valor_empenhado" },
      "ano",
    );
    // Desempate estável dentro do mesmo ano.
    if (data.ordem.startsWith("ano")) q = q.order("valor_pago", { ascending: false });
    q = q.range(data.offset, data.offset + data.limit - 1);

    // Emendas têm granularidade anual — o corte vale por ano.
    if (data.ate) q = q.lte("ano", Number(data.ate.slice(0, 4)));
    if (data.uf) q = q.eq("uf", data.uf.toUpperCase());
    if (data.ano) q = q.eq("ano", data.ano);
    if (data.funcao) q = q.ilike("funcao", `%${data.funcao}%`);
    if (data.tipoEmenda) q = q.ilike("tipo_emenda", `%${data.tipoEmenda}%`);
    if (data.autor) q = q.ilike("autor", `%${data.autor}%`);
    if (data.valorMin != null) q = q.gte("valor_pago", data.valorMin);
    if (data.q)
      q = (q as { or: (f: string) => typeof q }).or(
        `autor.ilike.%${data.q}%,localidade.ilike.%${data.q}%,funcao.ilike.%${data.q}%,id.ilike.%${data.q}%`,
      );

    const { data: rows, error, count } = await q;
    if (error) throw new Error(error.message);
    return {
      emendas: (rows ?? []) as EmendaRow[],
      total: count ?? 0,
      corteSugerido: hojeISO(),
    };
  });

export const getEmendaPorId = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ id: z.string().min(1).max(200) }).parse(input))
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("cgu_transferegov_emendas_cache")
      .select(COLUNAS_EMENDA)
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { emenda: (row ?? null) as EmendaRow | null };
  });

// ===================== Convênios =====================

export type ConvenioRow = {
  id: string;
  numero: string | null;
  codigo_siconv: string | null;
  objeto: string | null;
  orgao_cod: string | null;
  orgao_nome: string | null;
  orgao_cnpj: string | null;
  convenente_nome: string | null;
  convenente_cnpj: string | null;
  uf: string | null;
  municipio_ibge: string | null;
  municipio_nome: string | null;
  situacao: string | null;
  tipo_instrumento: string | null;
  valor: number;
  valor_liberado: number;
  valor_contrapartida: number;
  data_inicio_vigencia: string | null;
  data_fim_vigencia: string | null;
  data_publicacao: string | null;
  url_oficial: string | null;
  situacao_origem: string | null;
  valor_empenhado: number | null;
  valor_desembolsado: number | null;
  atualizado_origem_em: string | null;
};

const COLUNAS_CONVENIO =
  "id,fonte,numero,codigo_siconv,objeto,orgao_cod,orgao_nome,orgao_cnpj,convenente_nome,convenente_cnpj,esfera_convenente,uf,municipio_ibge,municipio_nome,situacao,tipo_instrumento,valor,valor_liberado,valor_contrapartida,data_assinatura,data_inicio_vigencia,data_fim_vigencia,data_publicacao,url_oficial,situacao_origem,valor_empenhado,valor_desembolsado,atualizado_origem_em";

export const listarConveniosCgu = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        uf: z.string().length(2).optional(),
        municipioIbge: z.string().optional(),
        ano: z.number().int().min(2000).max(2100).optional(),
        situacao: z.string().optional(),
        convenente: z.string().max(120).optional(),
        valorMin: z.number().min(0).optional(),
        ordem: z.enum(["data-desc", "data-asc", "valor-desc", "valor-asc"]).default("data-desc"),
        ate: ateSchema,
        q: z.string().max(120).optional(),
        limit: z.number().int().min(1).max(500).default(100),
        offset: z.number().int().min(0).max(100000).default(0),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    let q = supabaseAdmin.from("convenios_cache").select(COLUNAS_CONVENIO, { count: "exact" });
    q = ordenar(q, data.ordem, { data: "data_inicio_vigencia", valor: "valor" }, "data");
    q = q.range(data.offset, data.offset + data.limit - 1);

    if (data.ate) q = q.lte("data_inicio_vigencia", data.ate);
    if (data.uf) q = q.eq("uf", data.uf.toUpperCase());
    if (data.municipioIbge) q = q.eq("municipio_ibge", data.municipioIbge);
    if (data.ano) q = q.eq("ano", data.ano);
    if (data.situacao) q = q.ilike("situacao", `%${data.situacao}%`);
    if (data.valorMin != null) q = q.gte("valor", data.valorMin);
    if (data.convenente) {
      // Aceita CNPJ (dígitos na tabela) ou trecho do nome do convenente.
      const digitos = data.convenente.replace(/\D+/g, "");
      if (digitos.length === 14) q = q.eq("convenente_cnpj", digitos);
      else q = q.ilike("convenente_nome", `%${data.convenente}%`);
    }
    if (data.q)
      q = (q as { or: (f: string) => typeof q }).or(
        `objeto.ilike.%${data.q}%,convenente_nome.ilike.%${data.q}%,orgao_nome.ilike.%${data.q}%,numero.ilike.%${data.q}%`,
      );

    const { data: rows, error, count } = await q;
    if (error) throw new Error(error.message);
    return {
      convenios: (rows ?? []) as ConvenioRow[],
      total: count ?? 0,
      corteSugerido: hojeISO(),
    };
  });

export const getConvenioCguPorId = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ id: z.string().min(1).max(200) }).parse(input))
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("convenios_cache")
      .select(COLUNAS_CONVENIO)
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { convenio: (row ?? null) as ConvenioRow | null };
  });

// ===================== Contratos (índice-tópico) =====================

export type ContratoListaRow = {
  id: string;
  orgao_cod: string;
  numero: string | null;
  objeto: string | null;
  modalidade: string | null;
  valor: number;
  ano: number;
  data_assinatura: string | null;
  fornecedor_cnpj: string;
  fornecedor_nome: string | null;
};

/**
 * Lista de contratos (contratos_cache) para a página-tópico /contratos. Junta o
 * nome do fornecedor (fornecedores_cache) numa segunda consulta — evita depender
 * de FK embed. Antes só existia listagem por órgão em /orgaos.
 */
export const listarContratos = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        orgaoCod: z.string().optional(),
        // CNPJ do fornecedor (aceita formatado ou só dígitos) — habilita o
        // "ver todos os contratos deste fornecedor" a partir da ficha.
        fornecedor: z.string().max(20).optional(),
        ano: z.number().int().min(2000).max(2100).optional(),
        modalidade: z.string().optional(),
        valorMin: z.number().min(0).optional(),
        ordem: z.enum(["data-desc", "data-asc", "valor-desc", "valor-asc"]).default("data-desc"),
        ate: ateSchema,
        q: z.string().max(120).optional(),
        limit: z.number().int().min(1).max(500).default(100),
        offset: z.number().int().min(0).max(100000).default(0),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    let q = supabaseAdmin
      .from("contratos_cache")
      .select("id,orgao_cod,numero,objeto,modalidade,valor,ano,data_assinatura,fornecedor_cnpj", {
        count: "exact",
      });
    q = ordenar(q, data.ordem, { data: "data_assinatura", valor: "valor" }, "data");
    q = q.range(data.offset, data.offset + data.limit - 1);
    if (data.ate) q = q.lte("data_assinatura", data.ate);
    if (data.orgaoCod) q = q.eq("orgao_cod", data.orgaoCod);
    if (data.fornecedor) {
      // contratos_cache guarda o CNPJ formatado (00.000.000/0001-91).
      q = q.eq("fornecedor_cnpj", formatarCnpj(data.fornecedor));
    }
    if (data.ano) q = q.eq("ano", data.ano);
    if (data.modalidade) q = q.ilike("modalidade", `%${data.modalidade}%`);
    if (data.valorMin != null) q = q.gte("valor", data.valorMin);
    if (data.q)
      q = (q as { or: (f: string) => typeof q }).or(
        `objeto.ilike.%${data.q}%,numero.ilike.%${data.q}%`,
      );

    const { data: rows, error, count } = await q;
    if (error) throw new Error(error.message);
    const lista = rows ?? [];

    // Nomes dos fornecedores numa só consulta.
    const cnpjs = [...new Set(lista.map((r) => r.fornecedor_cnpj).filter(Boolean))];
    const nomePorCnpj = new Map<string, string>();
    if (cnpjs.length > 0) {
      const { data: forn } = await supabaseAdmin
        .from("fornecedores_cache")
        .select("cnpj,nome")
        .in("cnpj", cnpjs);
      for (const f of forn ?? []) nomePorCnpj.set(f.cnpj, f.nome);
    }

    return {
      contratos: lista.map(
        (r): ContratoListaRow => ({
          id: r.id,
          orgao_cod: r.orgao_cod,
          numero: r.numero,
          objeto: r.objeto,
          modalidade: r.modalidade,
          valor: Number(r.valor ?? 0),
          ano: r.ano,
          data_assinatura: r.data_assinatura,
          fornecedor_cnpj: r.fornecedor_cnpj,
          fornecedor_nome: nomePorCnpj.get(r.fornecedor_cnpj) ?? null,
        }),
      ),
      total: count ?? 0,
      corteSugerido: hojeISO(),
    };
  });
