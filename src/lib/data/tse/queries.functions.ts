import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Leituras públicas da fonte TSE (cache read-only; sem gate de admin —
 * mesmo padrão das demais entidades-tópico em real/queries.functions.ts).
 */

export type EleicaoResumo = {
  ano_eleicao: number;
  cargo_cod: number;
  cargo_nome: string;
  total: number;
  eleitos: number;
  ufs: number;
};

/** Contagens por (ano, cargo) para o hub /eleicoes. */
export const resumoEleicoes = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin.rpc("tse_resumo_eleicoes");
  if (error) throw new Error(`Falha ao carregar o resumo das eleições: ${error.message}`);
  return (data ?? []) as EleicaoResumo[];
});

export type CandidatoListaRow = {
  sq_candidato: string;
  ano_eleicao: number;
  nome_urna: string | null;
  nome_completo: string | null;
  cargo_nome: string | null;
  uf: string | null;
  partido_sigla: string | null;
  numero_candidato: string | null;
  situacao_totalizacao: string | null;
  bens_total_declarado: number | null;
};

const COLUNAS_LISTA =
  "sq_candidato,ano_eleicao,nome_urna,nome_completo,cargo_nome,uf,partido_sigla,numero_candidato,situacao_totalizacao,bens_total_declarado";

export const listarCandidatosTse = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        ano: z.number().int().min(2014).max(2100),
        uf: z.string().length(2).or(z.literal("BR")).optional(),
        cargoCod: z.number().int().optional(),
        situacao: z.string().max(60).optional(),
        q: z.string().max(120).optional(),
        sort: z.enum(["nome", "bens_desc"]).default("nome"),
        limit: z.number().int().min(1).max(200).default(50),
        offset: z.number().int().min(0).max(20000).default(0),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    let q = supabaseAdmin
      .from("tse_candidatos_cache")
      .select(COLUNAS_LISTA, { count: "exact" })
      .eq("ano_eleicao", data.ano);
    if (data.uf) q = q.eq("uf", data.uf);
    if (data.cargoCod != null) q = q.eq("cargo_cod", data.cargoCod);
    if (data.situacao) q = q.ilike("situacao_totalizacao", `${data.situacao}%`);
    if (data.q) q = q.or(`nome_urna.ilike.%${data.q}%,nome_completo.ilike.%${data.q}%`);
    q =
      data.sort === "bens_desc"
        ? q.order("bens_total_declarado", { ascending: false, nullsFirst: false })
        : q.order("nome_urna", { ascending: true, nullsFirst: false });
    const { data: rows, count, error } = await q.range(data.offset, data.offset + data.limit - 1);
    if (error) throw new Error(`Falha ao listar candidatos: ${error.message}`);
    return { rows: (rows ?? []) as CandidatoListaRow[], total: count ?? 0 };
  });

export type CandidatoDetalhe = {
  candidato: {
    sq_candidato: string;
    ano_eleicao: number;
    nr_turno: number;
    cargo_nome: string | null;
    uf: string | null;
    municipio_cod: string | null;
    nome_completo: string | null;
    nome_urna: string | null;
    cpf: string | null;
    partido_sigla: string | null;
    numero_candidato: string | null;
    situacao_candidatura: string | null;
    situacao_totalizacao: string | null;
    ocupacao: string | null;
    grau_instrucao: string | null;
    genero: string | null;
    cor_raca: string | null;
    bens_total_declarado: number | null;
  };
  bens: Array<{
    ordem_bem: number;
    tipo_bem: string | null;
    descricao: string | null;
    valor: number | null;
  }>;
  votosTotais: number;
  topMunicipios: Array<{ municipio_nome: string | null; votos: number }>;
  outrasCandidaturas: Array<{
    ano_eleicao: number;
    cargo_nome: string | null;
    situacao_totalizacao: string | null;
    sq_candidato: string;
  }>;
};

export const obterCandidatoTse = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({ sq: z.string().regex(/^\d+$/), ano: z.number().int().min(2014).max(2100) })
      .parse(input),
  )
  .handler(async ({ data }): Promise<CandidatoDetalhe | null> => {
    const { data: cand, error } = await supabaseAdmin
      .from("tse_candidatos_cache")
      .select(
        "sq_candidato,ano_eleicao,nr_turno,cargo_nome,uf,municipio_cod,nome_completo,nome_urna,cpf,partido_sigla,numero_candidato,situacao_candidatura,situacao_totalizacao,ocupacao,grau_instrucao,genero,cor_raca,bens_total_declarado",
      )
      .eq("sq_candidato", data.sq)
      .eq("ano_eleicao", data.ano)
      .maybeSingle();
    if (error) throw new Error(`Falha ao carregar candidato: ${error.message}`);
    if (!cand) return null;

    const [bens, resultados, outras] = await Promise.all([
      supabaseAdmin
        .from("tse_bens_candidato_cache")
        .select("ordem_bem,tipo_bem,descricao,valor")
        .eq("sq_candidato", data.sq)
        .eq("ano_eleicao", data.ano)
        .order("valor", { ascending: false })
        .limit(100),
      supabaseAdmin
        .from("tse_resultados_cache")
        .select("municipio_nome,votos_nominais")
        .eq("sq_candidato", data.sq)
        .eq("ano_eleicao", data.ano)
        .order("votos_nominais", { ascending: false })
        .limit(1000),
      // Outras candidaturas do MESMO CPF (histórico eleitoral).
      cand.cpf
        ? supabaseAdmin
            .from("tse_candidatos_cache")
            .select("ano_eleicao,cargo_nome,situacao_totalizacao,sq_candidato")
            .eq("cpf", cand.cpf)
            .neq("ano_eleicao", data.ano)
            .order("ano_eleicao", { ascending: false })
            .limit(10)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const votos = (resultados.data ?? []).reduce((s, r) => s + Number(r.votos_nominais ?? 0), 0);
    return {
      candidato: cand,
      bens: bens.data ?? [],
      votosTotais: votos,
      topMunicipios: (resultados.data ?? [])
        .slice(0, 5)
        .map((r) => ({ municipio_nome: r.municipio_nome, votos: Number(r.votos_nominais ?? 0) })),
      outrasCandidaturas: outras.data ?? [],
    };
  });

// ---------------------------------------------------------------------------
// Fase 2 — aba Eleição das fichas de parlamentar e doações do fornecedor
// ---------------------------------------------------------------------------

export type CandidaturaParlamentar = {
  sq_candidato: string;
  ano_eleicao: number;
  cargo_nome: string | null;
  uf: string | null;
  partido_sigla: string | null;
  situacao_totalizacao: string | null;
  bens_total_declarado: number | null;
  match_metodo: string;
  match_confianca: number;
};

export type AgregadoCampanha = {
  documento: string;
  nome: string;
  total: number;
  quantidade: number;
};

export type EleicoesParlamentar = {
  candidaturas: CandidaturaParlamentar[];
  /** Da candidatura mais recente: */
  topDoadores: AgregadoCampanha[];
  topFornecedores: AgregadoCampanha[];
  totalReceitas: number;
  totalDespesas: number;
};

function agregarPorDocumento(
  linhas: Array<{ doc: string | null; nome: string | null; valor: number | null }>,
): AgregadoCampanha[] {
  const mapa = new Map<string, AgregadoCampanha>();
  for (const l of linhas) {
    const doc = l.doc ?? "(não informado)";
    const atual = mapa.get(doc) ?? { documento: doc, nome: l.nome ?? doc, total: 0, quantidade: 0 };
    atual.total += l.valor ?? 0;
    atual.quantidade++;
    mapa.set(doc, atual);
  }
  return [...mapa.values()].sort((a, b) => b.total - a.total).slice(0, 10);
}

/** Histórico eleitoral + contas de campanha de um parlamentar (aba Eleição). */
export const eleicoesDoParlamentar = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        tipo: z.enum(["deputado", "senador"]),
        id: z.string().min(1).max(30),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<EleicoesParlamentar | null> => {
    const { data: vinculos, error } = await supabaseAdmin
      .from("tse_parlamentar_candidato")
      .select("sq_candidato, ano_eleicao, match_metodo, match_confianca")
      .eq("parlamentar_tipo", data.tipo)
      .eq("parlamentar_id", data.id)
      .order("ano_eleicao", { ascending: false });
    if (error) throw new Error(`Falha ao carregar vínculos eleitorais: ${error.message}`);
    if (!vinculos || vinculos.length === 0) return null;

    const ultimos = vinculos.slice(0, 3);
    const { data: cands } = await supabaseAdmin
      .from("tse_candidatos_cache")
      .select(
        "sq_candidato, ano_eleicao, cargo_nome, uf, partido_sigla, situacao_totalizacao, bens_total_declarado",
      )
      .in(
        "sq_candidato",
        ultimos.map((v) => v.sq_candidato),
      );
    const porChave = new Map(
      (cands ?? []).map((c) => [`${c.sq_candidato}|${c.ano_eleicao}`, c] as const),
    );
    const candidaturas: CandidaturaParlamentar[] = ultimos
      .map((v) => {
        const c = porChave.get(`${v.sq_candidato}|${v.ano_eleicao}`);
        if (!c) return null;
        return {
          ...c,
          match_metodo: v.match_metodo,
          match_confianca: Number(v.match_confianca),
        };
      })
      .filter((c): c is CandidaturaParlamentar => c !== null);
    if (candidaturas.length === 0) return null;

    const recente = candidaturas[0];
    const [receitas, despesas] = await Promise.all([
      supabaseAdmin
        .from("tse_receitas_campanha_cache")
        .select("cpf_cnpj_doador, nome_doador, valor")
        .eq("sq_candidato", recente.sq_candidato)
        .eq("ano_eleicao", recente.ano_eleicao)
        .limit(5000),
      supabaseAdmin
        .from("tse_despesas_campanha_cache")
        .select("cnpj_fornecedor, nome_fornecedor, valor")
        .eq("sq_candidato", recente.sq_candidato)
        .eq("ano_eleicao", recente.ano_eleicao)
        .limit(5000),
    ]);

    const linhasReceitas = (receitas.data ?? []).map((r) => ({
      doc: r.cpf_cnpj_doador,
      nome: r.nome_doador,
      valor: r.valor == null ? null : Number(r.valor),
    }));
    const linhasDespesas = (despesas.data ?? []).map((d) => ({
      doc: d.cnpj_fornecedor,
      nome: d.nome_fornecedor,
      valor: d.valor == null ? null : Number(d.valor),
    }));

    return {
      candidaturas,
      topDoadores: agregarPorDocumento(linhasReceitas),
      topFornecedores: agregarPorDocumento(linhasDespesas),
      totalReceitas: linhasReceitas.reduce((s, l) => s + (l.valor ?? 0), 0),
      totalDespesas: linhasDespesas.reduce((s, l) => s + (l.valor ?? 0), 0),
    };
  });

export type DoacaoEleitoral = {
  sq_candidato: string;
  ano_eleicao: number;
  valor: number;
  data: string | null;
  candidato_nome: string | null;
  candidato_partido: string | null;
  candidato_uf: string | null;
  candidato_cargo: string | null;
};

/** Doações eleitorais feitas por um CNPJ (seção da ficha /fornecedores/$cnpj). */
export const doacoesEleitoraisDoCnpj = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ cnpj: z.string().min(8).max(20) }).parse(input))
  .handler(async ({ data }) => {
    const digitos = data.cnpj.replace(/\D/g, "");
    if (digitos.length !== 14) return { doacoes: [] as DoacaoEleitoral[], total: 0 };
    const { data: receitas, error } = await supabaseAdmin
      .from("tse_receitas_campanha_cache")
      .select("sq_candidato, ano_eleicao, valor, data")
      .eq("cpf_cnpj_doador", digitos)
      .order("valor", { ascending: false })
      .limit(200);
    if (error) throw new Error(`Falha ao carregar doações eleitorais: ${error.message}`);
    if (!receitas || receitas.length === 0) return { doacoes: [] as DoacaoEleitoral[], total: 0 };

    const sqs = [...new Set(receitas.map((r) => r.sq_candidato))];
    const { data: cands } = await supabaseAdmin
      .from("tse_candidatos_cache")
      .select("sq_candidato, ano_eleicao, nome_urna, nome_completo, partido_sigla, uf, cargo_nome")
      .in("sq_candidato", sqs);
    const porChave = new Map(
      (cands ?? []).map((c) => [`${c.sq_candidato}|${c.ano_eleicao}`, c] as const),
    );
    const doacoes: DoacaoEleitoral[] = receitas.map((r) => {
      const c = porChave.get(`${r.sq_candidato}|${r.ano_eleicao}`);
      return {
        sq_candidato: r.sq_candidato,
        ano_eleicao: r.ano_eleicao,
        valor: Number(r.valor ?? 0),
        data: r.data,
        candidato_nome: c?.nome_urna ?? c?.nome_completo ?? null,
        candidato_partido: c?.partido_sigla ?? null,
        candidato_uf: c?.uf ?? null,
        candidato_cargo: c?.cargo_nome ?? null,
      };
    });
    return { doacoes, total: doacoes.reduce((s, d) => s + d.valor, 0) };
  });

// ---------------------------------------------------------------------------
// Página pública da fonte (/tse): sinais por tipo e situação
// ---------------------------------------------------------------------------

export type SinaisFonteTse = {
  porTipo: { qualidade: number; lacuna: number; investigativo: number };
  abertos: number;
  resolvidos: number;
};

/** Contagem dos sinais da fonte TSE (qa_findings, fontes tse + tse-cruzamento). */
export const sinaisDaFonteTse = createServerFn({ method: "GET" }).handler(
  async (): Promise<SinaisFonteTse> => {
    const { data, error } = await supabaseAdmin
      .from("qa_findings")
      .select("tipo, status")
      .in("fonte", ["tse", "tse-cruzamento"])
      .limit(100000);
    if (error) throw new Error(`Falha ao contar sinais da fonte TSE: ${error.message}`);
    const porTipo = { qualidade: 0, lacuna: 0, investigativo: 0 };
    let abertos = 0;
    let resolvidos = 0;
    for (const f of data ?? []) {
      if (f.tipo === "lacuna") porTipo.lacuna++;
      else if (f.tipo === "investigativo") porTipo.investigativo++;
      else porTipo.qualidade++;
      if (f.status === "aberto" || f.status === "confirmado" || f.status === "reportado") abertos++;
      else resolvidos++;
    }
    return { porTipo, abertos, resolvidos };
  },
);

export type ResumoPartidoLinha = {
  ano_eleicao: number;
  cargo_nome: string;
  total: number;
  eleitos: number;
  bens_medio: number | null;
};

/** Panorama público de um partido: contagens por (ano, cargo). */
export const resumoPartidoTse = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ sigla: z.string().min(2).max(20) }).parse(input))
  .handler(async ({ data }) => {
    const { data: rows, error } = await supabaseAdmin.rpc("tse_resumo_partido", {
      _sigla: data.sigla,
    });
    if (error) throw new Error(`Falha ao carregar o panorama do partido: ${error.message}`);
    return (rows ?? []) as ResumoPartidoLinha[];
  });
