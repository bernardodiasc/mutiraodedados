import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sanitizarTextoPublico } from "@/lib/sanitize";
import { regrasPncp, flagQA } from "@/lib/data/qa";
import { ehStatusTransitorio, fetchComRetry } from "@/lib/data/http-retry";

/**
 * PNCP — Portal Nacional de Contratações Públicas
 * API pública sem chave: https://pncp.gov.br/api/consulta/
 * Cobre União + Estados + Municípios desde 2021 (Lei 14.133).
 */
const BASE = "https://pncp.gov.br/api/consulta";
const UA = "MutiraoDeDados/1.0 (+https://mutiraodedados.com.br)";

async function pncpGet<T = unknown>(
  path: string,
  params: Record<string, string | number>,
): Promise<T> {
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();
  const url = `${BASE}${path}?${qs}`;
  // Retry pela política única do projeto — o PNCP devolve 503 transitório
  // com frequência, e a carga histórica depende de atravessar isso.
  let res: Response;
  try {
    res = await fetchComRetry(url, { headers: { accept: "application/json", "user-agent": UA } });
  } catch (e) {
    throw new Error(`TRANSIENT: PNCP indisponível (rede): ${(e as Error).message}`);
  }
  if (res.ok) return (await res.json()) as T;
  const body = await res.text().catch(() => "");
  const snippet = body
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  throw new Error(
    ehStatusTransitorio(res.status)
      ? `TRANSIENT: PNCP ${res.status} (serviço indisponível${snippet ? ` — ${snippet}` : ""})`
      : `PNCP API ${res.status}: ${snippet}`,
  );
}

async function ensureAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error("Falha ao verificar permissão.");
  if (data?.role !== "admin") throw new Error("Acesso restrito: somente administradores.");
}

function fmtDate(d?: string | null): string {
  if (!d) return "";
  return d.replace(/-/g, "");
}

type ContratoPNCP = {
  numeroControlePNCP?: string;
  anoContrato?: number;
  numeroContratoEmpenho?: string;
  objetoContrato?: string;
  orgaoEntidade?: {
    cnpj?: string;
    razaoSocial?: string;
    poderId?: string;
    esferaId?: string;
  };
  unidadeOrgao?: {
    ufSigla?: string;
    municipioNome?: string;
    codigoIbge?: string | number;
    codigoUnidade?: string;
  };
  tipoPessoa?: string;
  niFornecedor?: string;
  nomeRazaoSocialFornecedor?: string;
  valorInicial?: number;
  valorGlobal?: number;
  dataAssinatura?: string;
  dataVigenciaInicio?: string;
  dataVigenciaFim?: string;
  modalidadeNome?: string;
  situacaoContratoNome?: string;
};

function esferaLabel(id?: string): string | null {
  switch (id) {
    case "F":
      return "federal";
    case "E":
      return "estadual";
    case "M":
      return "municipal";
    case "D":
      return "distrital";
    default:
      return null;
  }
}
function poderLabel(id?: string): string | null {
  switch (id) {
    case "E":
      return "executivo";
    case "L":
      return "legislativo";
    case "J":
      return "judiciario";
    default:
      return null;
  }
}

/**
 * Importa contratos publicados em um intervalo de datas no PNCP.
 * Endpoint: /v1/contratos/publicacao
 * Limite: 500 registros por página, 30 req/min.
 */
export const importarContratosPNCP = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        dataInicial: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        dataFinal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        uf: z.string().length(2).optional(),
        cnpjOrgao: z.string().optional(),
        maxPaginas: z.number().int().min(1).max(2000).default(2000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);

    const di = fmtDate(data.dataInicial);
    const df = fmtDate(data.dataFinal);
    let total = 0;
    let pagina = 1;
    const erros: string[] = [];

    while (pagina <= data.maxPaginas) {
      const params: Record<string, string | number> = {
        dataInicial: di,
        dataFinal: df,
        pagina,
        tamanhoPagina: 500,
      };
      if (data.cnpjOrgao) params.cnpjOrgao = data.cnpjOrgao;
      // Nota: PNCP não aceita filtro de UF nesse endpoint — filtro aplicado client-side.

      const json = await pncpGet<{
        data?: ContratoPNCP[];
        totalPaginas?: number;
        totalRegistros?: number;
      }>("/v1/contratos/publicacao", params);
      const lista = json.data ?? [];
      if (lista.length === 0) break;

      const filtrados = data.uf
        ? lista.filter((c) => c.unidadeOrgao?.ufSigla?.toUpperCase() === data.uf!.toUpperCase())
        : lista;

      const rows = filtrados
        .map((c) => {
          const ncp = c.numeroControlePNCP;
          if (!ncp) return null;
          return {
            id: ncp,
            numero_controle_pncp: ncp,
            ano: Number(c.anoContrato ?? new Date(data.dataInicial).getFullYear()),
            orgao_cnpj: c.orgaoEntidade?.cnpj ?? "",
            orgao_nome:
              sanitizarTextoPublico((c.orgaoEntidade?.razaoSocial ?? "").slice(0, 240)) ||
              "Sem nome",
            esfera: esferaLabel(c.orgaoEntidade?.esferaId),
            poder: poderLabel(c.orgaoEntidade?.poderId),
            uf: c.unidadeOrgao?.ufSigla ?? null,
            municipio_ibge: c.unidadeOrgao?.codigoIbge ? String(c.unidadeOrgao.codigoIbge) : null,
            municipio_nome: c.unidadeOrgao?.municipioNome ?? null,
            numero_contrato: c.numeroContratoEmpenho ?? null,
            objeto: sanitizarTextoPublico((c.objetoContrato ?? "").slice(0, 1000)) || null,
            modalidade: c.modalidadeNome ?? null,
            situacao: c.situacaoContratoNome ?? null,
            fornecedor_cnpj_cpf: c.niFornecedor ?? null,
            fornecedor_nome:
              sanitizarTextoPublico((c.nomeRazaoSocialFornecedor ?? "").slice(0, 240)) || null,
            valor_inicial: Number(c.valorInicial ?? 0),
            valor_global: Number(c.valorGlobal ?? 0),
            data_assinatura: c.dataAssinatura?.slice(0, 10) || null,
            data_vigencia_inicio: c.dataVigenciaInicio?.slice(0, 10) || null,
            data_vigencia_fim: c.dataVigenciaFim?.slice(0, 10) || null,
            url_pncp: `https://pncp.gov.br/app/contratos/${ncp}`,
            updated_at: new Date().toISOString(),
          };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);

      for (let i = 0; i < rows.length; i += 200) {
        const { error } = await supabaseAdmin
          .from("pncp_contratos_cache")
          .upsert(rows.slice(i, i + 200));
        if (error) throw new Error(`db: ${error.message}`);
      }
      total += rows.length;
      try {
        await flagQA(
          regrasPncp(
            rows.map((r) => ({
              id: r.id,
              valor_global: r.valor_global,
              valor_inicial: r.valor_inicial,
            })),
          ),
        );
      } catch (e) {
        // Não interrompe a ingestão, mas o erro de QA fica visível no retorno.
        erros.push(`qa p${pagina}: ${(e as Error).message}`);
      }

      const totalPag = json.totalPaginas ?? 1;
      if (pagina >= totalPag) break;
      pagina += 1;
    }

    return { importados: total, paginas: pagina, erros };
  });
