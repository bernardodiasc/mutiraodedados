import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { agregarPorCategoria, type AgregadoCategoria } from "@/lib/data/tse/categorias-bens";
import { chavesIdentidade, temIdentificador } from "@/lib/data/tse/identidade";

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
        ano: z.number().int().min(1998).max(2100),
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
  bens: BemDeclaradoRow[];
  /** Total de linhas de bens na fonte — `bens` traz só as 100 maiores. */
  bensTotalLinhas: number;
  votosTotais: number;
  topMunicipios: Array<{ municipio_nome: string | null; votos: number }>;
  /** Todas as candidaturas do mesmo CPF, INCLUINDO esta. Desc por ano. */
  historico: CandidaturaHistoricoRow[];
  /** CPF ausente ou sentinela: não dá para ligar a outras candidaturas. */
  historicoIndisponivel: boolean;
  /** Fichas de parlamentar em exercício desta mesma pessoa, se houver. */
  parlamentares: ParlamentarVinculado[];
};

export type ParlamentarVinculado = {
  tipo: "deputado" | "senador";
  id: string;
  nome: string;
  partido: string | null;
  uf: string | null;
  /** Candidatura que gerou o vínculo. */
  anoOrigem: number;
  /** O vínculo veio da candidatura que está aberta na tela? */
  origemEhAtual: boolean;
  /** "cpf" é casamento exato; "nome_uf_partido" pode errar em homônimo. */
  matchMetodo: string | null;
  matchConfianca: number | null;
};

/**
 * A volta da ponte: da candidatura para a ficha de parlamentar.
 *
 * A ida (parlamentar → candidaturas) já existia em `eleicoesDoParlamentar`; sem
 * isto o cruzamento era de mão única e a ficha do candidato não sabia que a
 * mesma pessoa tem mandato no site.
 *
 * Busca por TODAS as candidaturas da pessoa, não só pela que está aberta: o
 * vínculo é gravado por candidatura, e quem abre a de 2018 quer igualmente
 * saber que ela é deputada hoje.
 */
async function parlamentaresDasCandidaturas(
  sqs: string[],
  sqAtual: string,
): Promise<ParlamentarVinculado[]> {
  if (sqs.length === 0) return [];
  const { data: vinculos, error } = await supabaseAdmin
    .from("tse_parlamentar_candidato")
    .select("parlamentar_tipo,parlamentar_id,sq_candidato,ano_eleicao,match_metodo,match_confianca")
    .in("sq_candidato", sqs)
    .order("ano_eleicao", { ascending: false });
  if (error) throw new Error(`Falha ao carregar o vínculo parlamentar: ${error.message}`);
  if (!vinculos || vinculos.length === 0) return [];

  // Uma pessoa pode ter vários vínculos (um por candidatura). Fica um por
  // parlamentar, preferindo o da candidatura ABERTA — dizer "vínculo pela
  // candidatura de 2026" na ficha de 2022, que é a que elegeu, confunde.
  // Sem vínculo na candidatura aberta, cai no mais recente.
  const ordenados = [...vinculos].sort(
    (a, b) =>
      Number(b.sq_candidato === sqAtual) - Number(a.sq_candidato === sqAtual) ||
      b.ano_eleicao - a.ano_eleicao,
  );
  const porParlamentar = new Map<string, (typeof vinculos)[number]>();
  for (const v of ordenados) {
    const chave = `${v.parlamentar_tipo}-${v.parlamentar_id}`;
    if (!porParlamentar.has(chave)) porParlamentar.set(chave, v);
  }
  const unicos = [...porParlamentar.values()];
  const idsDep = unicos
    .filter((v) => v.parlamentar_tipo === "deputado")
    .map((v) => v.parlamentar_id);
  const idsSen = unicos
    .filter((v) => v.parlamentar_tipo === "senador")
    .map((v) => v.parlamentar_id);

  const [deps, sens] = await Promise.all([
    idsDep.length
      ? supabaseAdmin
          .from("camara_deputados_cache")
          .select("id,nome,sigla_partido,sigla_uf")
          .in("id", idsDep.map(Number))
      : Promise.resolve({ data: [], error: null }),
    idsSen.length
      ? supabaseAdmin
          .from("senado_senadores_cache")
          .select("codigo_parlamentar,nome,sigla_partido,sigla_uf")
          .in("codigo_parlamentar", idsSen.map(Number))
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (deps.error) throw new Error(`Falha ao carregar deputados: ${deps.error.message}`);
  if (sens.error) throw new Error(`Falha ao carregar senadores: ${sens.error.message}`);

  const nomeDep = new Map((deps.data ?? []).map((d) => [String(d.id), d]));
  const nomeSen = new Map((sens.data ?? []).map((s) => [String(s.codigo_parlamentar), s]));

  return unicos
    .map((v): ParlamentarVinculado | null => {
      const p =
        v.parlamentar_tipo === "deputado"
          ? nomeDep.get(v.parlamentar_id)
          : nomeSen.get(v.parlamentar_id);
      // Vínculo sem ficha correspondente = roster reimportado desde a ponte.
      // Link para lugar nenhum é pior que seção ausente.
      if (!p) return null;
      return {
        tipo: v.parlamentar_tipo === "senador" ? "senador" : "deputado",
        id: v.parlamentar_id,
        nome: p.nome ?? "(sem nome)",
        partido: p.sigla_partido ?? null,
        uf: p.sigla_uf ?? null,
        anoOrigem: v.ano_eleicao,
        origemEhAtual: v.sq_candidato === sqAtual,
        matchMetodo: v.match_metodo,
        matchConfianca: v.match_confianca == null ? null : Number(v.match_confianca),
      };
    })
    .filter((x): x is ParlamentarVinculado => x !== null);
}

export type BemDeclaradoRow = {
  ordem_bem: number;
  tipo_bem_cod: string | null;
  tipo_bem: string | null;
  descricao: string | null;
  valor: number | null;
};

export type CandidaturaHistoricoRow = {
  sq_candidato: string;
  ano_eleicao: number;
  nr_turno: number;
  cargo_nome: string | null;
  uf: string | null;
  partido_sigla: string | null;
  situacao_totalizacao: string | null;
  bens_total_declarado: number | null;
};

const COLUNAS_HISTORICO =
  "sq_candidato,ano_eleicao,nr_turno,cargo_nome,uf,partido_sigla,situacao_totalizacao,bens_total_declarado";

/** `numeric` do PostgREST pode chegar como string. Nunca coagir null a 0. */
function numeroOuNulo(v: unknown): number | null {
  return v == null ? null : Number(v);
}

const COLUNAS_CANDIDATO =
  "sq_candidato,ano_eleicao,nr_turno,cargo_nome,uf,municipio_cod,nome_completo,nome_urna,cpf,titulo_eleitoral,partido_sigla,numero_candidato,situacao_candidatura,situacao_totalizacao,ocupacao,grau_instrucao,genero,cor_raca,bens_total_declarado";

/**
 * `ano` é opcional: o `sq_candidato` do TSE é único por eleição, então a URL
 * curta `/eleicoes/candidatos/<sq>` já identifica a candidatura. Isso é o que
 * torna verdadeira a URL canônica da rota, que não carrega o ano — com um ano
 * default fixo, toda ficha que não fosse daquele ano abria em "não encontrada"
 * para quem chegasse por link compartilhado ou buscador.
 */
export const obterCandidatoTse = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        sq: z.string().regex(/^\d+$/),
        ano: z.number().int().min(1998).max(2100).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<CandidatoDetalhe | null> => {
    let q = supabaseAdmin
      .from("tse_candidatos_cache")
      .select(COLUNAS_CANDIDATO)
      .eq("sq_candidato", data.sq);
    // Sem ano: a mais recente. O sq não deveria se repetir entre eleições, mas
    // ordenar é mais barato do que confiar nisso e quebrar com `maybeSingle`.
    q =
      data.ano != null
        ? q.eq("ano_eleicao", data.ano)
        : q.order("ano_eleicao", { ascending: false });
    const { data: linhas, error } = await q.limit(1);
    if (error) throw new Error(`Falha ao carregar candidato: ${error.message}`);
    const cand = linhas?.[0];
    if (!cand) return null;
    // A partir daqui o ano é o da linha encontrada, nunca o que veio na URL.
    const ano = cand.ano_eleicao;

    // Título eleitoral é a chave primária, CPF é reforço: o TSE deixou de
    // publicar CPF em 2024. Sem nenhum dos dois, o histórico fica só com esta
    // candidatura — casar por nome ligaria homônimos, e o erro aqui seria
    // atribuir o patrimônio declarado de uma pessoa a outra.
    const chaves = chavesIdentidade(cand);
    const podeLigar = temIdentificador(chaves);
    const filtroIdentidade = [
      chaves.titulo && `titulo_eleitoral.eq.${chaves.titulo}`,
      chaves.cpf && `cpf.eq.${chaves.cpf}`,
    ]
      .filter(Boolean)
      .join(",");

    const [bens, resultados, historicoQuery] = await Promise.all([
      supabaseAdmin
        .from("tse_bens_candidato_cache")
        .select("ordem_bem,tipo_bem_cod,tipo_bem,descricao,valor", { count: "exact" })
        .eq("sq_candidato", data.sq)
        .eq("ano_eleicao", ano)
        .order("valor", { ascending: false })
        .limit(100),
      supabaseAdmin
        .from("tse_resultados_cache")
        .select("municipio_nome,votos_nominais")
        .eq("sq_candidato", data.sq)
        .eq("ano_eleicao", ano)
        .order("votos_nominais", { ascending: false })
        .limit(1000),
      // Todas as candidaturas da MESMA PESSOA, esta inclusive. Limite de 40 dá
      // folga sobre as ~11 eleições possíveis e ainda protege de identificador
      // corrompido compartilhado por muitas linhas.
      podeLigar
        ? supabaseAdmin
            .from("tse_candidatos_cache")
            .select(COLUNAS_HISTORICO)
            .or(filtroIdentidade)
            .order("ano_eleicao", { ascending: false })
            .limit(40)
        : Promise.resolve({ data: null, error: null }),
    ]);

    // Sem isto, uma query quebrada vira "nenhum bem declarado" na tela — a
    // ficha afirmaria ao leitor um fato que a fonte nunca disse. Melhor a
    // mensagem de erro, que a View já sabe mostrar.
    for (const [rotulo, r] of [
      ["os bens declarados", bens],
      ["a votação", resultados],
      ["o histórico de candidaturas", historicoQuery],
    ] as const) {
      if (r.error) throw new Error(`Falha ao carregar ${rotulo}: ${r.error.message}`);
    }

    const votos = (resultados.data ?? []).reduce((s, r) => s + Number(r.votos_nominais ?? 0), 0);
    const linhasHistorico = (historicoQuery.data ?? []) as CandidaturaHistoricoRow[];
    const historico = linhasHistorico.length > 0 ? linhasHistorico : [candidaturaAtual(cand)];

    // A volta da ponte usa todos os sqs da pessoa, não só o aberto.
    const parlamentares = await parlamentaresDasCandidaturas(
      historico.map((h) => h.sq_candidato),
      cand.sq_candidato,
    );

    // CPF e título ficam no servidor: servem para ligar as candidaturas, não
    // para serem exibidos, e não há razão para despachá-los ao navegador.
    const { cpf: _cpf, titulo_eleitoral: _titulo, ...candidatoPublico } = cand;

    return {
      candidato: candidatoPublico,
      bens: (bens.data ?? []).map((b) => ({ ...b, valor: numeroOuNulo(b.valor) })),
      bensTotalLinhas: bens.count ?? bens.data?.length ?? 0,
      votosTotais: votos,
      topMunicipios: (resultados.data ?? [])
        .slice(0, 5)
        .map((r) => ({ municipio_nome: r.municipio_nome, votos: Number(r.votos_nominais ?? 0) })),
      historico: historico.map((h) => ({
        ...h,
        bens_total_declarado: numeroOuNulo(h.bens_total_declarado),
      })),
      historicoIndisponivel: !podeLigar,
      parlamentares,
    };
  });

/** A própria candidatura como linha de histórico, quando não há CPF para buscar. */
function candidaturaAtual(c: CandidatoDetalhe["candidato"]): CandidaturaHistoricoRow {
  return {
    sq_candidato: c.sq_candidato,
    ano_eleicao: c.ano_eleicao,
    nr_turno: c.nr_turno,
    cargo_nome: c.cargo_nome,
    uf: c.uf,
    partido_sigla: c.partido_sigla,
    situacao_totalizacao: c.situacao_totalizacao,
    bens_total_declarado: c.bens_total_declarado,
  };
}

// ---------------------------------------------------------------------------
// Comparação patrimonial entre duas candidaturas
// ---------------------------------------------------------------------------

export type LadoComparacao = {
  sq: string;
  ano: number;
  cargo: string | null;
  uf: string | null;
  partido: string | null;
  /** Agregado do cache. null = não declarou ou bens ainda não importados. */
  totalDeclarado: number | null;
  /** Soma das linhas de bens efetivamente encontradas. */
  totalLinhas: number;
  quantidadeBens: number;
  /** Agregado sobre TODAS as linhas lidas, não só as 100 exibidas. */
  categorias: AgregadoCategoria[];
  bens: BemDeclaradoRow[];
  truncado: boolean;
};

export type ComparacaoBens = { a: LadoComparacao; b: LadoComparacao };

/** Teto de linhas lidas por lado. Acima disso o agregado avisa que truncou. */
const LIMITE_BENS_COMPARACAO = 2000;
/** Quantos bens vão para a lista lado a lado. */
const LIMITE_BENS_EXIBIDOS = 100;

async function carregarLado(sq: string, ano: number): Promise<LadoComparacao> {
  const [cabecalho, linhas] = await Promise.all([
    supabaseAdmin
      .from("tse_candidatos_cache")
      .select("cargo_nome,uf,partido_sigla,bens_total_declarado")
      .eq("sq_candidato", sq)
      .eq("ano_eleicao", ano)
      .maybeSingle(),
    supabaseAdmin
      .from("tse_bens_candidato_cache")
      .select("ordem_bem,tipo_bem_cod,tipo_bem,descricao,valor")
      .eq("sq_candidato", sq)
      .eq("ano_eleicao", ano)
      .order("valor", { ascending: false })
      .limit(LIMITE_BENS_COMPARACAO),
  ]);
  if (cabecalho.error) {
    throw new Error(`Falha ao carregar a candidatura ${ano}: ${cabecalho.error.message}`);
  }
  if (linhas.error) {
    throw new Error(`Falha ao carregar os bens de ${ano}: ${linhas.error.message}`);
  }

  const bens: BemDeclaradoRow[] = (linhas.data ?? []).map((b) => ({
    ...b,
    valor: numeroOuNulo(b.valor),
  }));
  return {
    sq,
    ano,
    cargo: cabecalho.data?.cargo_nome ?? null,
    uf: cabecalho.data?.uf ?? null,
    partido: cabecalho.data?.partido_sigla ?? null,
    totalDeclarado: numeroOuNulo(cabecalho.data?.bens_total_declarado),
    totalLinhas: bens.reduce((s, b) => s + (b.valor ?? 0), 0),
    quantidadeBens: bens.length,
    // Agrega antes de cortar: o total por categoria nunca pode refletir só as
    // 100 maiores enquanto a lista avisa que está truncada.
    categorias: agregarPorCategoria(bens),
    bens: bens.slice(0, LIMITE_BENS_EXIBIDOS),
    truncado: bens.length >= LIMITE_BENS_COMPARACAO,
  };
}

/**
 * Bens de duas candidaturas, agregados por categoria, para comparação.
 *
 * Fica fora de `obterCandidatoTse` de propósito: os bens de todas as
 * candidaturas inflariam o payload inicial de uma seção abaixo da dobra, e com
 * fn separada o React Query cacheia por par — trocar o ano no seletor não
 * refaz a ficha inteira.
 *
 * Não checa se as duas candidaturas são da mesma pessoa. As tabelas são de
 * leitura pública, então não há o que vazar; mas a UI só oferece pares vindos
 * do histórico, que já veio filtrado por CPF.
 */
export const compararBensTse = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        sqA: z.string().regex(/^\d+$/),
        anoA: z.number().int().min(1998).max(2100),
        sqB: z.string().regex(/^\d+$/),
        anoB: z.number().int().min(1998).max(2100),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<ComparacaoBens> => {
    const [a, b] = await Promise.all([
      carregarLado(data.sqA, data.anoA),
      carregarLado(data.sqB, data.anoB),
    ]);
    return { a, b };
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
