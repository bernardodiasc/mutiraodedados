import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { formatarCnpj, soDigitos } from "@/lib/cnpj";

/**
 * Busca global unificada.
 * Pesquisa CNPJ (14 dígitos numéricos), CPF parcial ou termo livre nas
 * principais tabelas do acervo: contratos (CGU e PNCP), licitações, emendas,
 * convênios, fornecedores e candidatos.
 */

// Remove caracteres com significado especial em filtros PostgREST (`.or=`)
// e no padrão LIKE para evitar injeção de condições adicionais no query string.
function sanitizarTermoFiltro(s: string) {
  return s
    .replace(/[%(),.*]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type ItemBusca = {
  id: string;
  titulo: string;
  subtitulo: string;
  /** null quando não faz sentido exibir valor (fornecedor, candidato). */
  valor: number | null;
  data: string | null;
  href: string;
  /** true quando o href sai da plataforma (portal oficial); false = rota interna. */
  externo: boolean;
};

export type ResultadoBusca = {
  cnpjDetectado: string | null;
  contratos: ItemBusca[];
  pncp: ItemBusca[];
  licitacoes: ItemBusca[];
  emendas: ItemBusca[];
  convenios: ItemBusca[];
  fornecedores: ItemBusca[];
  candidatos: ItemBusca[];
};

export const buscaGlobal = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        termo: z.string().min(2).max(120),
        limit: z.number().int().min(1).max(100).default(30),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<ResultadoBusca> => {
    const termo = data.termo.trim();
    const digitos = soDigitos(termo);
    const cnpj = digitos.length === 14 ? digitos : null;

    // --- PNCP contratos ---
    let qPncp = supabaseAdmin
      .from("pncp_contratos_cache")
      .select(
        "id,orgao_nome,orgao_cnpj,uf,municipio_nome,objeto,fornecedor_nome,fornecedor_cnpj_cpf,valor_global,data_assinatura,url_pncp",
      )
      .order("data_assinatura", { ascending: false, nullsFirst: false })
      .limit(data.limit);

    if (cnpj) {
      qPncp = qPncp.or(`orgao_cnpj.eq.${cnpj},fornecedor_cnpj_cpf.eq.${cnpj}`);
    } else {
      const t = sanitizarTermoFiltro(termo);
      if (!t)
        return {
          cnpjDetectado: null,
          contratos: [],
          pncp: [],
          licitacoes: [],
          emendas: [],
          convenios: [],
          fornecedores: [],
          candidatos: [],
        };
      qPncp = qPncp.or(`orgao_nome.ilike.%${t}%,fornecedor_nome.ilike.%${t}%,objeto.ilike.%${t}%`);
    }
    const { data: pncpRows, error: ePncp } = await qPncp;
    if (ePncp) throw new Error(ePncp.message);

    // --- CGU contratos (contratos_cache guarda o CNPJ FORMATADO) ---
    let cguRows: Array<{
      id: string;
      numero: string | null;
      objeto: string | null;
      modalidade: string | null;
      valor: number | null;
      data_assinatura: string | null;
      fornecedor_cnpj: string | null;
    }> = [];
    {
      let qCgu = supabaseAdmin
        .from("contratos_cache")
        .select("id,numero,objeto,modalidade,valor,data_assinatura,fornecedor_cnpj")
        .order("data_assinatura", { ascending: false, nullsFirst: false })
        .limit(data.limit);
      if (cnpj) {
        qCgu = qCgu.eq("fornecedor_cnpj", formatarCnpj(cnpj));
      } else {
        const t = sanitizarTermoFiltro(termo);
        qCgu = qCgu.or(`objeto.ilike.%${t}%,numero.ilike.%${t}%`);
      }
      const { data: rows, error } = await qCgu;
      if (!error) cguRows = rows ?? [];
    }
    const mapCgu = (): ItemBusca[] =>
      cguRows.map((r) => ({
        id: r.id,
        titulo: `Contrato ${r.numero ?? r.id}`,
        subtitulo: [r.modalidade, r.objeto ?? undefined].filter(Boolean).join(" · ").slice(0, 160),
        valor: r.valor == null ? null : Number(r.valor),
        data: r.data_assinatura,
        href: `/contratos/${encodeURIComponent(r.id)}`,
        externo: false,
      }));

    // --- Fornecedores (cadastro derivado dos contratos CGU) ---
    let fornRows: Array<{ cnpj: string; nome: string | null }> = [];
    {
      let qForn = supabaseAdmin.from("fornecedores_cache").select("cnpj,nome").limit(data.limit);
      if (cnpj) {
        qForn = qForn.eq("cnpj", formatarCnpj(cnpj));
      } else {
        const t = sanitizarTermoFiltro(termo);
        qForn = qForn.ilike("nome", `%${t}%`);
      }
      const { data: rows, error } = await qForn;
      if (!error) fornRows = rows ?? [];
    }
    const mapForn = (): ItemBusca[] =>
      fornRows.map((r) => ({
        id: r.cnpj,
        titulo: r.nome ?? r.cnpj,
        subtitulo: r.cnpj,
        valor: null,
        data: null,
        href: `/fornecedores/${encodeURIComponent(r.cnpj)}`,
        externo: false,
      }));

    // --- Candidatos (TSE) — só por nome; CNPJ não identifica candidatura ---
    let candRows: Array<{
      sq_candidato: string;
      nome_urna: string | null;
      nome_completo: string | null;
      cargo_nome: string | null;
      partido_sigla: string | null;
      uf: string | null;
      ano_eleicao: number;
    }> = [];
    if (!cnpj) {
      const t = sanitizarTermoFiltro(termo);
      const { data: rows, error } = await supabaseAdmin
        .from("tse_candidatos_cache")
        .select("sq_candidato,nome_urna,nome_completo,cargo_nome,partido_sigla,uf,ano_eleicao")
        .or(`nome_urna.ilike.%${t}%,nome_completo.ilike.%${t}%`)
        .order("ano_eleicao", { ascending: false })
        .limit(data.limit);
      if (!error) candRows = rows ?? [];
    }
    const mapCand = (): ItemBusca[] =>
      candRows.map((r) => ({
        id: r.sq_candidato,
        titulo: r.nome_urna ?? r.nome_completo ?? r.sq_candidato,
        subtitulo: [r.cargo_nome, r.partido_sigla, r.uf].filter(Boolean).join(" · "),
        valor: null,
        data: String(r.ano_eleicao),
        href: `/eleicoes/candidatos/${encodeURIComponent(r.sq_candidato)}`,
        externo: false,
      }));

    // --- CGU licitações ---
    // CGU é por órgão (não por fornecedor): por CNPJ casamos o órgão; por termo,
    // objeto/número/unidade gestora. href aponta para o detalhe interno.
    let licRows: Array<{
      id: string;
      numero: string | null;
      unidade_gestora: string | null;
      uf: string | null;
      municipio_nome: string | null;
      objeto: string | null;
      valor: number | null;
      data_abertura: string | null;
    }> = [];
    {
      let qLic = supabaseAdmin
        .from("cgu_licitacoes_cache")
        .select("id,numero,unidade_gestora,uf,municipio_nome,objeto,valor,data_abertura")
        .order("data_abertura", { ascending: false, nullsFirst: false })
        .limit(data.limit);
      if (cnpj) {
        qLic = qLic.eq("orgao_cnpj", cnpj);
      } else {
        const t = sanitizarTermoFiltro(termo);
        qLic = qLic.or(
          `objeto.ilike.%${t}%,numero.ilike.%${t}%,numero_processo.ilike.%${t}%,unidade_gestora.ilike.%${t}%`,
        );
      }
      const { data: rows, error } = await qLic;
      if (!error) licRows = rows ?? [];
    }
    const mapLic = (): ItemBusca[] =>
      licRows.map((r) => ({
        id: r.id,
        titulo: `Licitação ${r.numero ?? ""}`.trim(),
        subtitulo: [r.unidade_gestora, r.uf, r.municipio_nome].filter(Boolean).join(" · "),
        valor: r.valor == null ? null : Number(r.valor),
        data: r.data_abertura,
        href: `/licitacoes/${r.id}`,
        externo: false,
      }));

    // --- CGU emendas (por termo: autor/localidade/função/código) ---
    let emeRows: Array<{
      id: string;
      autor: string | null;
      localidade: string | null;
      funcao: string | null;
      valor_pago: number | null;
      ano: number | null;
    }> = [];
    if (!cnpj) {
      const t = sanitizarTermoFiltro(termo);
      const { data: rows, error } = await supabaseAdmin
        .from("cgu_transferegov_emendas_cache")
        .select("id,autor,localidade,funcao,valor_pago,ano")
        .or(`autor.ilike.%${t}%,localidade.ilike.%${t}%,funcao.ilike.%${t}%,id.ilike.%${t}%`)
        .order("valor_pago", { ascending: false, nullsFirst: false })
        .limit(data.limit);
      if (!error) emeRows = rows ?? [];
    }
    const mapEme = (): ItemBusca[] =>
      emeRows.map((r) => ({
        id: r.id,
        titulo: `Emenda · ${r.autor ?? r.id}`,
        subtitulo: [r.localidade, r.funcao].filter(Boolean).join(" · "),
        valor: r.valor_pago == null ? null : Number(r.valor_pago),
        data: r.ano ? String(r.ano) : null,
        href: `/emendas/${r.id}`,
        externo: false,
      }));

    // --- CGU convênios (por CNPJ do convenente/órgão ou termo) ---
    let convRows: Array<{
      id: string;
      numero: string | null;
      orgao_nome: string | null;
      convenente_nome: string | null;
      uf: string | null;
      municipio_nome: string | null;
      valor: number | null;
      data_inicio_vigencia: string | null;
    }> = [];
    {
      // Tabela única de convênios (v0.9.0) — a busca fazia DUAS consultas, uma
      // por "eixo", sobre os mesmos registros, e devolvia grupos duplicados.
      let qConv = supabaseAdmin
        .from("convenios_cache")
        .select("id,numero,orgao_nome,convenente_nome,uf,municipio_nome,valor,data_inicio_vigencia")
        .order("data_inicio_vigencia", { ascending: false, nullsFirst: false })
        .limit(data.limit);
      if (cnpj) {
        qConv = qConv.or(`convenente_cnpj.eq.${cnpj},orgao_cnpj.eq.${cnpj}`);
      } else {
        const t = sanitizarTermoFiltro(termo);
        qConv = qConv.or(
          `objeto.ilike.%${t}%,convenente_nome.ilike.%${t}%,orgao_nome.ilike.%${t}%,numero.ilike.%${t}%`,
        );
      }
      const { data: rows, error } = await qConv;
      if (!error) convRows = rows ?? [];
    }
    const mapConv = (): ItemBusca[] =>
      convRows.map((r) => ({
        id: r.id,
        titulo: `Convênio ${r.numero ?? r.id}`,
        subtitulo: [r.orgao_nome, "→", r.convenente_nome, r.uf, r.municipio_nome]
          .filter(Boolean)
          .join(" "),
        valor: r.valor == null ? null : Number(r.valor),
        data: r.data_inicio_vigencia,
        // Página interna de detalhe (lê a mesma convenios_cache desta busca),
        // com links para as fontes oficiais lá dentro.
        href: `/convenios/${encodeURIComponent(r.id)}`,
        externo: false,
      }));

    return {
      cnpjDetectado: cnpj,
      contratos: mapCgu(),
      fornecedores: mapForn(),
      candidatos: mapCand(),
      pncp: (pncpRows ?? []).map((r) => ({
        id: r.id,
        titulo: r.orgao_nome,
        subtitulo: [r.uf, r.municipio_nome, r.fornecedor_nome].filter(Boolean).join(" · "),
        valor: Number(r.valor_global ?? 0),
        data: r.data_assinatura,
        // Detalhe interno (a página /contratos/$id resolve CGU e PNCP).
        href: `/contratos/${encodeURIComponent(r.id)}`,
        externo: false,
      })),
      licitacoes: mapLic(),
      emendas: mapEme(),
      convenios: mapConv(),
    };
  });
