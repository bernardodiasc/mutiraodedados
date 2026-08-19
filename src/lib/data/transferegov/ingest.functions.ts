import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sanitizarTextoPublico } from "@/lib/sanitize";
import { regrasTransferegov, flagQA } from "@/lib/data/qa";
import { parseValorPortal, portalGet } from "@/lib/data/real/portal-client";

/**
 * Transferegov / Convênios — usa o endpoint /convenios do Portal da
 * Transparência (CGU). Toda a parte de HTTP, parser de valor e
 * verificação-por-detalhe vive em `portal-client.ts`, compartilhada
 * com o ingest de contratos. Aqui ficam só os shapes de convênio e o
 * mapeamento → linhas do cache.
 */

async function ensureAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error("Falha ao verificar permissão.");
  if (data?.role !== "admin") throw new Error("Acesso restrito.");
}

function brDate(iso: string): string {
  // YYYY-MM-DD -> DD/MM/YYYY
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
function isoDate(br?: string | null): string | null {
  if (!br) return null;
  const m = br.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

type Convenio = {
  id?: number | string;
  numero?: string;
  numeroOriginal?: string;
  objeto?: string;
  situacao?: string;
  modalidade?: string;
  valor?: number;
  valorLiberado?: number;
  valorContrapartida?: number;
  dataInicioVigencia?: string;
  dataFinalVigencia?: string;
  dataFimVigencia?: string;
  dataAssinatura?: string;
  dataPublicacao?: string;
  dataReferencia?: string;
  dimConvenio?: { numero?: string; objeto?: string; codigo?: string };
  tipoInstrumento?: { descricao?: string };
  convenente?: {
    nome?: string;
    cnpj?: string;
    cnpjFormatado?: string;
    codigoIBGE?: string | number;
    municipio?: { nomeIBGE?: string; codigoIBGE?: string | number; uf?: { sigla?: string } };
  };
  municipioConvenente?: {
    nomeIBGE?: string;
    codigoIBGE?: string | number;
    uf?: { sigla?: string; nome?: string };
  };
  unidadeGestora?: {
    nome?: string;
    descricaoPoder?: string;
    orgaoVinculado?: { nome?: string; cnpj?: string; codigoSIAFI?: string };
  };
};

function esferaFromIbge(ibge?: string | null): string | null {
  if (!ibge) return null;
  if (ibge.length === 2) return "estadual";
  if (ibge.length === 7) return "municipal";
  return null;
}

/**
 * Importa convênios e contratos de repasse de um intervalo.
 * dataInicial / dataFinal em ISO YYYY-MM-DD.
 * Filtros: uf, codigoIbgeMunicipio.
 */
export const importarConveniosTransferegov = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        dataInicial: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        dataFinal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        codigoIbgeMunicipio: z.string().optional(),
        codigoUF: z.string().optional(),
        maxPaginas: z.number().int().min(1).max(2000).default(2000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);

    let total = 0;
    const erros: string[] = [];
    for (let pagina = 1; pagina <= data.maxPaginas; pagina++) {
      const params: Record<string, string> = {
        dataInicial: brDate(data.dataInicial),
        dataFinal: brDate(data.dataFinal),
        pagina: String(pagina),
      };
      if (data.codigoIbgeMunicipio) params.codigoIBGE = data.codigoIbgeMunicipio;
      if (data.codigoUF) params.codigoUFConvenente = data.codigoUF;

      const json = (await portalGet("/convenios", params)) as Convenio[];
      if (!Array.isArray(json) || json.length === 0) break;

      const rows = json
        .map((c) => {
          const numero = c.numero ?? c.numeroOriginal ?? c.dimConvenio?.numero ?? null;
          const id = c.id ? String(c.id) : numero ? `num-${numero}` : null;
          if (!id) return null;
          const muni = c.municipioConvenente ?? c.convenente?.municipio;
          const ibge = muni?.codigoIBGE
            ? String(muni.codigoIBGE)
            : c.convenente?.codigoIBGE
            ? String(c.convenente.codigoIBGE)
            : null;
          // No Portal CGU não há "uf" como sigla pura; "uf.nome" traz a sigla
          // ("RS") enquanto "uf.sigla" traz o nome longo. Pegamos a sigla curta.
          const ufSigla =
            (muni?.uf as { sigla?: string; nome?: string } | undefined)?.nome ??
            (muni?.uf as { sigla?: string } | undefined)?.sigla ??
            null;
          // CNPJ vem formatado ("00.378.257/0001-81"); preferimos o cru.
          const cnpjBenef =
            c.convenente?.cnpj ??
            (c.convenente?.cnpjFormatado ?? "").replace(/\D/g, "") ??
            null;
          const dataAssin =
            isoDate(c.dataAssinatura) ??
            isoDate(c.dataPublicacao) ??
            (c.dataReferencia && /^\d{4}-\d{2}-\d{2}/.test(c.dataReferencia)
              ? c.dataReferencia.slice(0, 10)
              : null) ??
            (c.dataInicioVigencia && /^\d{4}-\d{2}-\d{2}/.test(c.dataInicioVigencia)
              ? c.dataInicioVigencia.slice(0, 10)
              : isoDate(c.dataInicioVigencia));
          return {
            id,
            numero: numero ?? id,
            codigo_siconv: c.dimConvenio?.codigo ?? null,
            modalidade: c.modalidade ?? c.tipoInstrumento?.descricao ?? null,
            situacao: c.situacao ?? null,
            objeto:
              sanitizarTextoPublico(((c.objeto ?? c.dimConvenio?.objeto) ?? "").slice(0, 1000)) ||
              null,
            orgao_concedente_nome: c.unidadeGestora?.orgaoVinculado?.nome ?? c.unidadeGestora?.nome ?? null,
            orgao_concedente_cnpj: c.unidadeGestora?.orgaoVinculado?.cnpj ?? null,
            beneficiario_nome: sanitizarTextoPublico((c.convenente?.nome ?? "").slice(0, 240)) || null,
            beneficiario_cnpj: cnpjBenef || null,
            esfera_beneficiario: esferaFromIbge(ibge),
            uf_beneficiario: ufSigla,
            municipio_ibge: ibge,
            municipio_nome: muni?.nomeIBGE ?? null,
            valor_global: parseValorPortal(c.valor ?? 0),
            valor_repasse: parseValorPortal(c.valorLiberado ?? 0),
            valor_contrapartida: parseValorPortal(c.valorContrapartida ?? 0),
            data_inicio_vigencia:
              isoDate(c.dataInicioVigencia) ??
              (c.dataInicioVigencia && /^\d{4}-\d{2}-\d{2}/.test(c.dataInicioVigencia)
                ? c.dataInicioVigencia.slice(0, 10)
                : null),
            data_fim_vigencia:
              isoDate(c.dataFinalVigencia ?? c.dataFimVigencia) ??
              ((c.dataFinalVigencia ?? c.dataFimVigencia) &&
              /^\d{4}-\d{2}-\d{2}/.test(c.dataFinalVigencia ?? c.dataFimVigencia ?? "")
                ? (c.dataFinalVigencia ?? c.dataFimVigencia ?? "").slice(0, 10)
                : null),
            data_assinatura: dataAssin,
            url_transferegov: c.id
              ? (c.dimConvenio?.codigo
                  ? `https://discricionarias.transferegov.sistema.gov.br/voluntarias/ConsultarProposta/ResultadoDaConsultaDeConvenioSelecionarConvenio.do?sequencialConvenio=${encodeURIComponent(c.dimConvenio.codigo)}`
                  : `https://portaldatransparencia.gov.br/convenios/${c.id}`)
              : null,
            updated_at: new Date().toISOString(),
          };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);

      // Valores são gravados exatamente como vieram da listagem do Portal.
      // Não consultamos /convenios/id pra "corrigir" — discrepâncias são
      // sinalizadas como findings de QA pra revisão manual, não auto-fix.
      const rowsFinais = rows;

      for (let i = 0; i < rowsFinais.length; i += 200) {
        const { error } = await supabaseAdmin
          .from("transferegov_instrumentos_cache")
          .upsert(rowsFinais.slice(i, i + 200));
        if (error) throw new Error(`db: ${error.message}`);
      }
      total += rowsFinais.length;
      try {
        await flagQA(
          regrasTransferegov(
            rowsFinais.map((r) => ({
              id: r.id,
              valor_repasse: r.valor_repasse,
              valor_global: r.valor_global,
            })),
          ),
        );
      } catch (e) {
        // Não interrompe a ingestão, mas o erro de QA fica visível no retorno.
        erros.push(`qa p${pagina}: ${(e as Error).message}`);
      }
      if (json.length < 15) break; // página padrão do Portal
    }

    return { importados: total, erros };
  });