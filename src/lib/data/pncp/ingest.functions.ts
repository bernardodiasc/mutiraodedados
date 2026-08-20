import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sanitizarTextoPublico } from "@/lib/sanitize";
import { regrasPncp, flagQA } from "@/lib/data/qa";
import { rodarComOrcamento } from "@/lib/data/runner";
import { checkpointImportacao } from "@/lib/data/checkpoint.server";
import { reacaoAoErro, reacaoAoErroDeLista } from "@/lib/data/erro-origem";
import { registrarRodadaImportacao } from "@/lib/data/historico.server";
import { anoMesDaJanela } from "@/lib/data/historico-rodada";
import {
  chaveVarreduraJanela,
  JANELA_ORCAMENTO_MS,
  JANELA_TETO_SUBREQUISICOES,
} from "@/lib/data/janela-varredura";
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
  tipoContrato?: { id?: number; nome?: string };
  categoriaProcesso?: { id?: number; nome?: string };
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
 * Endpoint: /v1/contratos (o /v1/contratos/publicacao usado até a v0.6.0
 * não existe — devolvia 404 e toda importação de PNCP voltava vazia)
 * Limite: 500 registros por página, 30 req/min.
 */
/** Núcleo chamável sem browser (v0.11.0) — usado pela casca autenticada e pelo agendador. */
export async function rodadaContratosPNCP(
  data: {
    dataInicial: string;
    dataFinal: string;
    uf?: string;
    municipioIbge?: string;
    cnpjOrgao?: string;
    maxPaginas: number;
  },
  userId: string | null,
) {
  const di = fmtDate(data.dataInicial);
  const df = fmtDate(data.dataFinal);
  const erros: string[] = [];

  // Um passo = uma página. Antes o laço ia até 2000 páginas numa chamada só,
  // sem orçamento nem retomada, e um erro de banco derrubava a rodada
  // inteira — o que na prática obrigava a UI a limitar a 3 páginas.
  const inicioRodada = Date.now();
  const rodada = await rodarComOrcamento({
    chave: chaveVarreduraJanela("pncp", data.dataInicial, data.dataFinal, {
      uf: data.uf,
      ibge: data.municipioIbge,
      cnpj: data.cnpjOrgao,
    }),
    checkpoint: checkpointImportacao,
    orcamentoMs: JANELA_ORCAMENTO_MS,
    orcamentoCusto: JANELA_TETO_SUBREQUISICOES,
    maxPassos: data.maxPaginas,
    passo: async (pagina) => {
      const params: Record<string, string | number> = {
        dataInicial: di,
        dataFinal: df,
        pagina,
        tamanhoPagina: 500,
      };
      if (data.cnpjOrgao) params.cnpjOrgao = data.cnpjOrgao;
      // Nota: PNCP não aceita filtro de UF nesse endpoint — filtro aplicado client-side.

      let custo = 0;
      let json: { data?: ContratoPNCP[]; totalPaginas?: number; totalRegistros?: number };
      try {
        json = await pncpGet<{
          data?: ContratoPNCP[];
          totalPaginas?: number;
          totalRegistros?: number;
        }>("/v1/contratos", params);
        custo++;
      } catch (e) {
        // A página É a lista desta rodada: passageiro refaz, definitivo
        // encerra — se a página 1 dá 404, as 2000 seguintes também dão.
        const r = reacaoAoErroDeLista(e);
        return {
          processados: 0,
          fim: r.fim,
          custo: 1,
          interromper: r.interromper,
          erros: [`p${pagina}: ${(e as Error).message}`],
        };
      }

      const lista = json.data ?? [];
      if (lista.length === 0) return { processados: 0, fim: true, custo };

      // O endpoint não aceita filtro geográfico, então recortamos aqui pelo
      // ente escolhido — UF pela sigla, município pelo código IBGE.
      const filtrados = lista.filter((c) => {
        if (data.municipioIbge && String(c.unidadeOrgao?.codigoIbge ?? "") !== data.municipioIbge)
          return false;
        if (data.uf && c.unidadeOrgao?.ufSigla?.toUpperCase() !== data.uf.toUpperCase())
          return false;
        return true;
      });

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
            // A API de contratos do PNCP não expõe modalidade de licitação
            // (isso é da COMPRA, ligada por numeroControlePncpCompra) nem
            // status do contrato. O que ela dá é o tipo do instrumento e a
            // categoria do processo — é o que gravamos, em vez de null.
            modalidade: c.tipoContrato?.nome ?? null,
            situacao: c.categoriaProcesso?.nome ?? null,
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
        custo++;
        // Falha de banco passageira refaz o item; definitiva registra e
        // segue, para um erro permanente não travar a varredura.
        if (error) {
          return {
            processados: 0,
            fim: false,
            custo,
            interromper: reacaoAoErro(error).interromper,
            erros: [`db p${pagina}: ${error.message}`],
          };
        }
      }

      const errosPasso: string[] = [];
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
        errosPasso.push(`qa p${pagina}: ${(e as Error).message}`);
      }

      const totalPag = json.totalPaginas ?? 1;
      return { processados: rows.length, fim: pagina >= totalPag, custo, erros: errosPasso };
    },
  });

  erros.push(...rodada.erros);

  // Linha de rodada no Histórico — inclui consulta vazia e motivo de parada.
  const avisoHistorico = await registrarRodadaImportacao(
    {
      fonte: "pncp",
      ...anoMesDaJanela(data.dataInicial, data.dataFinal),
      endpoint: `GET ${BASE}/v1/contratos?dataInicial=${di}&dataFinal=${df}`,
      unidade: "páginas",
      userId: userId,
      duracaoMs: Date.now() - inicioRodada,
    },
    rodada,
  );
  if (avisoHistorico) erros.push(avisoHistorico);

  return {
    importados: rodada.processados,
    paginas: rodada.cursorFinal,
    erros,
    varredura: {
      haMais: !rodada.concluido,
      cursor: rodada.cursorFinal,
      totalAcumulado: rodada.totalAcumulado,
      orcamentoEsgotado: rodada.orcamentoEsgotado,
      custoEsgotado: rodada.custoEsgotado,
    },
  };
}

export const importarContratosPNCP = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        dataInicial: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        dataFinal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        uf: z.string().length(2).optional(),
        /** Código IBGE de 7 dígitos — filtra pelo município da unidade. */
        municipioIbge: z
          .string()
          .regex(/^\d{7}$/)
          .optional(),
        cnpjOrgao: z.string().optional(),
        maxPaginas: z.number().int().min(1).max(2000).default(2000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);
    return rodadaContratosPNCP(data, context.userId);
  });
