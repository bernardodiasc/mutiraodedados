import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Busca global unificada.
 * Pesquisa CNPJ (14 dígitos numéricos), CPF parcial ou termo livre nas
 * principais tabelas de cache: contratos PNCP, transferências e convênios.
 */

function soDigitos(s: string) {
  return s.replace(/\D+/g, "");
}

// Remove caracteres com significado especial em filtros PostgREST (`.or=`)
// e no padrão LIKE para evitar injeção de condições adicionais no query string.
function sanitizarTermoFiltro(s: string) {
  return s.replace(/[%(),.*]/g, " ").replace(/\s+/g, " ").trim();
}

type ItemBusca = {
  id: string;
  titulo: string;
  subtitulo: string;
  valor: number;
  data: string | null;
  href: string;
};

export type ResultadoBusca = {
  cnpjDetectado: string | null;
  pncp: ItemBusca[];
  licitacoes: ItemBusca[];
  emendas: ItemBusca[];
  convenios: ItemBusca[];
  transferencias: ItemBusca[];
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
      if (!t) return { cnpjDetectado: null, pncp: [], licitacoes: [], emendas: [], convenios: [], transferencias: [] };
      qPncp = qPncp.or(`orgao_nome.ilike.%${t}%,fornecedor_nome.ilike.%${t}%,objeto.ilike.%${t}%`);
    }
    const { data: pncpRows, error: ePncp } = await qPncp;
    if (ePncp) throw new Error(ePncp.message);

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
        valor: Number(r.valor ?? 0),
        data: r.data_abertura,
        href: `/licitacoes/${r.id}`,
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
        valor: Number(r.valor_pago ?? 0),
        data: r.ano ? String(r.ano) : null,
        href: `/emendas/${r.id}`,
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
      let qConv = supabaseAdmin
        .from("cgu_convenios_cache")
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
        subtitulo: [r.orgao_nome, "→", r.convenente_nome, r.uf, r.municipio_nome].filter(Boolean).join(" "),
        valor: Number(r.valor ?? 0),
        data: r.data_inicio_vigencia,
        // Página interna de detalhe (lê cgu_convenios_cache — mesmo cache
        // desta busca), com link para a fonte oficial lá dentro.
        href: `/convenios/${encodeURIComponent(r.id)}`,
      }));

    // --- Transferegov / Convênios ---
    let qTransf = supabaseAdmin
      .from("transferegov_instrumentos_cache")
      .select(
        "id,numero,orgao_concedente_nome,beneficiario_nome,beneficiario_cnpj,uf_beneficiario,municipio_nome,objeto,valor_global,data_assinatura,url_transferegov",
      )
      .order("data_assinatura", { ascending: false, nullsFirst: false })
      .limit(data.limit);

    if (cnpj) {
      qTransf = qTransf.eq("beneficiario_cnpj", cnpj);
    } else {
      const t = sanitizarTermoFiltro(termo);
      qTransf = qTransf.or(
        `beneficiario_nome.ilike.%${t}%,orgao_concedente_nome.ilike.%${t}%,objeto.ilike.%${t}%`,
      );
    }
    const { data: transfRows, error: eTransf } = await qTransf;
    if (eTransf) {
      // tabela pode não ter coluna beneficiario_cnpj em todos os esquemas — degradar para vazio
      return {
        cnpjDetectado: cnpj,
        pncp: (pncpRows ?? []).map((r) => ({
          id: r.id,
          titulo: r.orgao_nome,
          subtitulo: [r.uf, r.municipio_nome, r.fornecedor_nome].filter(Boolean).join(" · "),
          valor: Number(r.valor_global ?? 0),
          data: r.data_assinatura,
          href: r.url_pncp ?? "",
        })),
        licitacoes: mapLic(),
        emendas: mapEme(),
        convenios: mapConv(),
        transferencias: [],
      };
    }

    return {
      cnpjDetectado: cnpj,
      pncp: (pncpRows ?? []).map((r) => ({
        id: r.id,
        titulo: r.orgao_nome,
        subtitulo: [r.uf, r.municipio_nome, r.fornecedor_nome].filter(Boolean).join(" · "),
        valor: Number(r.valor_global ?? 0),
        data: r.data_assinatura,
        href: r.url_pncp ?? "",
      })),
      licitacoes: mapLic(),
      emendas: mapEme(),
      convenios: mapConv(),
      transferencias: (transfRows ?? []).map((r) => ({
        id: r.id,
        titulo: `Convênio ${r.numero}`,
        subtitulo: [
          r.orgao_concedente_nome,
          "→",
          r.beneficiario_nome,
          r.uf_beneficiario,
          r.municipio_nome,
        ].filter(Boolean).join(" "),
        valor: Number(r.valor_global ?? 0),
        data: r.data_assinatura,
        href: r.url_transferegov ?? "",
      })),
    };
  });