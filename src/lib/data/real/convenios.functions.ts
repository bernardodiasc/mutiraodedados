import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sanitizarTextoPublico } from "@/lib/sanitize";
import { regrasCguConvenios, type CguConvenioLike } from "@/lib/data/qa";
import { parseValorPortal } from "@/lib/data/real/portal-client";
import {
  ensureAdmin,
  isoToBR,
  montarVarreduraKey,
  parseDatePortal,
  varrerPaginado,
} from "@/lib/data/real/sweep";
import { linkConsultaConvenioPortal } from "@/lib/links-oficiais";

/**
 * Ingest do endpoint /convenios do Portal da Transparência (CGU).
 *
 * Entidade-tópico "Convênios" (eixo tema). Varredura por janela de
 * dataReferencia (o endpoint filtra por mês de referência). Mesmo endpoint que
 * `transferegov/ingest.functions.ts`, mas em tabela própria (cgu_convenios_cache)
 * por decisão de projeto, para isolar os pipelines dos dois eixos.
 */

type PortalConvenio = {
  id?: number | string;
  dataReferencia?: string;
  dimConvenio?: { numero?: string; objeto?: string; codigo?: string };
  situacao?: string;
  convenente?: { nome?: string; cnpjFormatado?: string };
  municipioConvenente?: {
    codigoIBGE?: string;
    nomeIBGE?: string;
    uf?: { sigla?: string; nome?: string };
  };
  orgao?: { nome?: string; codigoSIAFI?: string; cnpj?: string };
  tipoInstrumento?: { descricao?: string };
  valor?: unknown;
  valorLiberado?: unknown;
  valorContrapartida?: unknown;
  dataInicioVigencia?: string;
  dataFinalVigencia?: string;
  dataFimVigencia?: string;
  dataPublicacao?: string;
};

type ConvenioRow = {
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
  ano: number;
  mes_referencia: number | null;
  url_oficial: string | null;
  updated_at: string;
};

/** Sigla da UF de 2 letras (a API troca sigla/nome — pega o que tem 2 letras). */
function ufDe(uf: { sigla?: string; nome?: string } | undefined): string | null {
  for (const cand of [uf?.nome, uf?.sigla]) {
    const s = (cand ?? "").trim();
    if (/^[A-Za-z]{2}$/.test(s)) return s.toUpperCase();
  }
  return null;
}

function mapearConvenio(raw: PortalConvenio): ConvenioRow {
  const ref = parseDatePortal(raw.dataReferencia) || parseDatePortal(raw.dataInicioVigencia);
  const ano = ref ? Number(ref.slice(0, 4)) : new Date().getFullYear();
  const numero = raw.dimConvenio?.numero || null;
  const id = String(raw.id ?? numero ?? Math.random().toString(36).slice(2));
  return {
    id,
    numero,
    codigo_siconv: raw.dimConvenio?.codigo || null,
    objeto: sanitizarTextoPublico((raw.dimConvenio?.objeto ?? "").slice(0, 240)) || null,
    orgao_cod: raw.orgao?.codigoSIAFI || null,
    orgao_nome: raw.orgao?.nome || null,
    orgao_cnpj: raw.orgao?.cnpj || null,
    convenente_nome: raw.convenente?.nome || null,
    convenente_cnpj: raw.convenente?.cnpjFormatado || null,
    uf: ufDe(raw.municipioConvenente?.uf),
    municipio_ibge: raw.municipioConvenente?.codigoIBGE || null,
    municipio_nome: raw.municipioConvenente?.nomeIBGE || null,
    situacao: raw.situacao || null,
    tipo_instrumento: raw.tipoInstrumento?.descricao || null,
    valor: parseValorPortal(raw.valor),
    valor_liberado: parseValorPortal(raw.valorLiberado),
    valor_contrapartida: parseValorPortal(raw.valorContrapartida),
    data_inicio_vigencia: parseDatePortal(raw.dataInicioVigencia) || null,
    data_fim_vigencia: parseDatePortal(raw.dataFinalVigencia ?? raw.dataFimVigencia) || null,
    data_publicacao: parseDatePortal(raw.dataPublicacao) || null,
    ano,
    mes_referencia: ref ? Number(ref.slice(5, 7)) : null,
    url_oficial: linkConsultaConvenioPortal(numero),
    updated_at: new Date().toISOString(),
  };
}

export const importConvenios = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        dataInicial: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        dataFinal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        maxPaginas: z.number().int().min(1).max(5000).default(5000),
        delayMs: z.number().int().min(0).max(10000).default(500),
        orcamentoMs: z.number().int().min(10000).max(230000).default(180000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);

    const TAM_PAGINA = 15;
    const varreduraKey = montarVarreduraKey("convenios", "geral", data.dataInicial, data.dataFinal);

    const r = await varrerPaginado<PortalConvenio, ConvenioRow>({
      entidade: "convenios",
      fonte: "cgu_convenios",
      endpoint: "/convenios",
      orgaoCodLog: "",
      escopo: "convênios",
      userId: context.userId,
      varreduraKey,
      tamPagina: TAM_PAGINA,
      maxPaginas: data.maxPaginas,
      delayMs: data.delayMs,
      orcamentoMs: data.orcamentoMs,
      montarParams: (pagina) => ({
        dataInicial: isoToBR(data.dataInicial),
        dataFinal: isoToBR(data.dataFinal),
        pagina: String(pagina),
      }),
      mapPagina: (list, _pagina, push) => {
        const rows = list.map((raw) => mapearConvenio(raw));
        for (const f of regrasCguConvenios(rows as CguConvenioLike[])) push.finding(f);
        return rows;
      },
      upsertBatch: async (rows) => {
        const erros: string[] = [];
        for (let i = 0; i < rows.length; i += 200) {
          const chunk = rows.slice(i, i + 200);
          const { error } = await supabaseAdmin.from("cgu_convenios_cache").upsert(chunk);
          if (error) erros.push(`db: ${error.message}`);
        }
        return erros;
      },
      rowDateIso: (row) => row.data_inicio_vigencia,
    });

    return {
      meta: {
        totalBruto: r.totalAcumulado,
        importados: r.totalAcumulado,
        erros: [...r.erros, ...r.avisos],
        fonte: "Portal da Transparência (CGU) — Convênios",
        consultadoEm: new Date().toISOString(),
        varredura: {
          ultimaPagina: r.ultimaPagina,
          completa: r.completa,
          haMais: r.haMais,
          totalAcumulado: r.totalAcumulado,
          orcamentoEsgotado: r.orcamentoEsgotado,
        },
      },
    };
  });
