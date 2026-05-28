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

export type ResultadoBusca = {
  cnpjDetectado: string | null;
  pncp: Array<{
    id: string;
    titulo: string;
    subtitulo: string;
    valor: number;
    data: string | null;
    href: string;
  }>;
  transferencias: Array<{
    id: string;
    titulo: string;
    subtitulo: string;
    valor: number;
    data: string | null;
    href: string;
  }>;
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
      if (!t) return { cnpjDetectado: null, pncp: [], transferencias: [] };
      qPncp = qPncp.or(`orgao_nome.ilike.%${t}%,fornecedor_nome.ilike.%${t}%,objeto.ilike.%${t}%`);
    }
    const { data: pncpRows, error: ePncp } = await qPncp;
    if (ePncp) throw new Error(ePncp.message);

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