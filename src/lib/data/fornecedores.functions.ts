import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { formatarCnpj, soDigitos } from "@/lib/cnpj";
import { ATE_RE } from "@/lib/listagem/logic";

/**
 * Leituras públicas de fornecedores. A ficha agrega TODAS as presenças do
 * CNPJ no acervo — contratos CGU, contratos PNCP, notas de cota parlamentar
 * (CEAP/CEAPS) e doações de campanha — para nunca dar 404 quando o CNPJ
 * existe em alguma fonte (ficha "degradada" em vez de beco sem saída).
 */

export type ContratoDoFornecedor = {
  id: string;
  orgao_cod: string;
  orgao_sigla: string | null;
  orgao_nome: string | null;
  numero: string | null;
  objeto: string | null;
  modalidade: string | null;
  valor: number | null;
  ano: number;
  data_assinatura: string | null;
};

export type FichaFornecedor = {
  cadastro: { cnpj: string; nome: string } | null;
  contratos: ContratoDoFornecedor[];
  /** Count real — `contratos` traz no máximo 1000 linhas. */
  totalContratos: number;
  pncp: { total: number };
  ceapCamara: { total: number };
  ceapSenado: { total: number };
  doacoes: { total: number };
};

const LIMITE_CONTRATOS = 1000;

/**
 * Lista de fornecedores (porta de entrada da ficha). O cadastro vem dos
 * contratos CGU; a busca aceita trecho do nome ou CNPJ (qualquer formato).
 * O corte `ate` usa `created_at` (entrada do CNPJ no cadastro), não
 * `updated_at`, que o import reescreve a cada rodada.
 */
export const listarFornecedores = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        q: z.string().max(120).optional(),
        ordem: z.enum(["nome-asc", "nome-desc"]).default("nome-asc"),
        ate: z.string().regex(ATE_RE).optional(),
        limit: z.number().int().min(1).max(500).default(100),
        offset: z.number().int().min(0).max(100000).default(0),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    let q = supabaseAdmin
      .from("fornecedores_cache")
      .select("cnpj,nome", { count: "exact" })
      .order("nome", { ascending: data.ordem !== "nome-desc", nullsFirst: false })
      .range(data.offset, data.offset + data.limit - 1);
    if (data.q) {
      const digitos = soDigitos(data.q);
      if (digitos.length === 14) q = q.eq("cnpj", formatarCnpj(digitos));
      else q = q.ilike("nome", `%${data.q.replace(/[%(),.*]/g, " ").trim()}%`);
    }
    if (data.ate) q = q.lte("created_at", data.ate);
    const { data: rows, error, count } = await q;
    if (error) throw new Error(error.message);
    return {
      fornecedores: (rows ?? []) as Array<{ cnpj: string; nome: string }>,
      total: count ?? 0,
      corteSugerido: new Date().toISOString(),
    };
  });

export const obterFornecedor = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ cnpj: z.string().min(11).max(20) }).parse(input))
  .handler(async ({ data }): Promise<FichaFornecedor> => {
    const digitos = soDigitos(data.cnpj);
    const formatado = formatarCnpj(digitos);

    const [cad, contr, pncp, ceapC, ceapS, doa] = await Promise.all([
      // fornecedores_cache e contratos_cache guardam o CNPJ FORMATADO.
      supabaseAdmin
        .from("fornecedores_cache")
        .select("cnpj,nome")
        .eq("cnpj", formatado)
        .maybeSingle(),
      supabaseAdmin
        .from("contratos_cache")
        .select("id,orgao_cod,numero,objeto,modalidade,valor,ano,data_assinatura", {
          count: "exact",
        })
        .eq("fornecedor_cnpj", formatado)
        .order("data_assinatura", { ascending: false, nullsFirst: false })
        .limit(LIMITE_CONTRATOS),
      supabaseAdmin
        .from("pncp_contratos_cache")
        .select("id", { count: "exact", head: true })
        .eq("fornecedor_cnpj_cpf", digitos),
      // CEAP/CEAPS guardam o CNPJ como a origem publica — consulta nas duas formas.
      supabaseAdmin
        .from("camara_despesas_cache")
        .select("id", { count: "exact", head: true })
        .in("fornecedor_cnpj", [digitos, formatado]),
      supabaseAdmin
        .from("senado_despesas_cache")
        .select("id", { count: "exact", head: true })
        .in("fornecedor_cnpj", [digitos, formatado]),
      supabaseAdmin
        .from("tse_receitas_campanha_cache")
        .select("id", { count: "exact", head: true })
        .eq("cpf_cnpj_doador", digitos),
    ]);

    if (contr.error) throw new Error(contr.error.message);

    // Sem cadastro CGU, o nome pode vir do PNCP (ficha degradada com nome real).
    let nomeAlternativo: string | null = null;
    if (!cad.data && (pncp.count ?? 0) > 0) {
      const { data: umPncp } = await supabaseAdmin
        .from("pncp_contratos_cache")
        .select("fornecedor_nome")
        .eq("fornecedor_cnpj_cpf", digitos)
        .not("fornecedor_nome", "is", null)
        .limit(1)
        .maybeSingle();
      nomeAlternativo = umPncp?.fornecedor_nome ?? null;
    }

    // Nomes/siglas dos órgãos numa só consulta.
    const linhas = contr.data ?? [];
    const cods = [...new Set(linhas.map((c) => c.orgao_cod).filter(Boolean))];
    const orgaoPorCod = new Map<string, { sigla: string | null; nome: string | null }>();
    if (cods.length > 0) {
      const { data: orgs } = await supabaseAdmin
        .from("orgaos_cache")
        .select("cod,sigla,nome")
        .in("cod", cods);
      for (const o of orgs ?? []) orgaoPorCod.set(o.cod, { sigla: o.sigla, nome: o.nome });
    }

    return {
      cadastro: cad.data
        ? { cnpj: cad.data.cnpj, nome: cad.data.nome }
        : nomeAlternativo
          ? { cnpj: formatado, nome: nomeAlternativo }
          : null,
      contratos: linhas.map(
        (c): ContratoDoFornecedor => ({
          id: c.id,
          orgao_cod: c.orgao_cod,
          orgao_sigla: orgaoPorCod.get(c.orgao_cod)?.sigla ?? null,
          orgao_nome: orgaoPorCod.get(c.orgao_cod)?.nome ?? null,
          numero: c.numero,
          objeto: c.objeto,
          modalidade: c.modalidade,
          valor: c.valor == null ? null : Number(c.valor),
          ano: c.ano,
          data_assinatura: c.data_assinatura,
        }),
      ),
      totalContratos: contr.count ?? 0,
      pncp: { total: pncp.count ?? 0 },
      ceapCamara: { total: ceapC.count ?? 0 },
      ceapSenado: { total: ceapS.count ?? 0 },
      doacoes: { total: doa.count ?? 0 },
    };
  });
