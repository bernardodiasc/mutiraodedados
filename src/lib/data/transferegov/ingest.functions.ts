import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { regrasTransferegov, flagQA } from "@/lib/data/qa";
import { rodarComOrcamento } from "@/lib/data/runner";
import { checkpointImportacao } from "@/lib/data/checkpoint.server";
import { reacaoAoErro, reacaoAoErroDeLista } from "@/lib/data/erro-origem";
import { registrarRodadaImportacao } from "@/lib/data/historico.server";
import { anoMesDaJanela, type OrigemRodada } from "@/lib/data/historico-rodada";
import {
  chaveVarreduraJanela,
  JANELA_ORCAMENTO_MS,
  JANELA_TETO_SUBREQUISICOES_COM_COTA,
} from "@/lib/data/janela-varredura";
import { portalGet } from "@/lib/data/real/portal-client";
import { mapearConvenioCache, type PortalConvenioRaw } from "@/lib/data/real/convenio-row";

/**
 * Convênios pelo ângulo do ente beneficiário — usa o endpoint /convenios do
 * Portal da Transparência (CGU). NÃO é a API do Transferegov: o módulo
 * Discricionárias e Legais, onde convênios e contratos de repasse vivem, só
 * publica CSV (API prevista entre nov/2026 e fev/2027). Cuidado: o módulo
 * "Gestão de Parcerias" TEM API e o nome engana — ele cobre fundo a fundo,
 * renúncia fiscal e contrato de gestão, e a palavra "convênio" não aparece no
 * spec dele. Tabela de módulos em docs/fontes/transferegov.md. Toda a parte de HTTP, parser de valor e
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

/**
 * Parâmetros da importação — fonte única da validação: a casca autenticada e
 * o modo nomeado de `/api/cron-importar` usam este mesmo schema.
 * dataInicial / dataFinal em ISO YYYY-MM-DD; filtros opcionais pelo ente
 * (código IBGE do município ou da UF).
 */
export const importarConveniosPorEnteSchema = z.object({
  dataInicial: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dataFinal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  codigoIbgeMunicipio: z.string().optional(),
  codigoUF: z.string().optional(),
  maxPaginas: z.number().int().min(1).max(2000).default(2000),
});

export type ParamsConveniosPorEnte = z.infer<typeof importarConveniosPorEnteSchema>;

/** Chave de varredura da janela e do ente — a mesma para painel e ferramenta. */
export const chaveVarreduraConveniosPorEnte = (p: {
  dataInicial: string;
  dataFinal: string;
  codigoIbgeMunicipio?: string;
  codigoUF?: string;
}) =>
  chaveVarreduraJanela("transferegov", p.dataInicial, p.dataFinal, {
    ibge: p.codigoIbgeMunicipio,
    uf: p.codigoUF,
  });

/**
 * `importacoes.escopo` da rodada. Sem ente é "" — a linha única da matriz de
 * cobertura. Com ente, a rodada ganha escopo próprio (`municipio:<ibge>`,
 * `uf:<código>`): a importação de um município não cobre o mês do país
 * inteiro, e a conferência de um ente não pode aprovar a janela de todos.
 */
export function escopoDoEnte(p: { codigoIbgeMunicipio?: string; codigoUF?: string }): string {
  if (p.codigoIbgeMunicipio) return `municipio:${p.codigoIbgeMunicipio}`;
  if (p.codigoUF) return `uf:${p.codigoUF}`;
  return "";
}

/**
 * Núcleo chamável sem sessão: UMA rodada de convênios e contratos de repasse
 * de uma janela, opcionalmente de um ente. Usado pela casca autenticada e
 * pelo modo nomeado.
 */
export async function rodadaConveniosPorEnte(
  data: ParamsConveniosPorEnte,
  userId: string | null,
  origem: OrigemRodada = {},
) {
  const erros: string[] = [];

  // Um passo = uma página. Antes o laço ia até 2000 páginas numa chamada só,
  // sem orçamento nem retomada, e um erro de banco derrubava a rodada
  // inteira — o que na prática obrigava a UI a limitar a 3 páginas.
  const inicioRodada = Date.now();
  const rodada = await rodarComOrcamento({
    chave: chaveVarreduraConveniosPorEnte(data),
    checkpoint: checkpointImportacao,
    orcamentoMs: JANELA_ORCAMENTO_MS,
    orcamentoCusto: JANELA_TETO_SUBREQUISICOES_COM_COTA,
    maxPassos: data.maxPaginas,
    passo: async (pagina) => {
      const params: Record<string, string> = {
        dataInicial: brDate(data.dataInicial),
        dataFinal: brDate(data.dataFinal),
        pagina: String(pagina),
      };
      if (data.codigoIbgeMunicipio) params.codigoIBGE = data.codigoIbgeMunicipio;
      if (data.codigoUF) params.codigoUFConvenente = data.codigoUF;

      let custo = 0;
      let json: PortalConvenioRaw[];
      try {
        json = (await portalGet("/convenios", params)) as PortalConvenioRaw[];
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
      if (!Array.isArray(json) || json.length === 0) return { processados: 0, fim: true, custo };

      const rows = json
        .map((c) => mapearConvenioCache(c))
        .filter((r): r is NonNullable<ReturnType<typeof mapearConvenioCache>> => r !== null);

      // Valores são gravados exatamente como vieram da listagem do Portal.
      // Não consultamos /convenios/id pra "corrigir" — discrepâncias são
      // sinalizadas como findings de QA pra revisão manual, não auto-fix.
      const rowsFinais = rows;

      for (let i = 0; i < rowsFinais.length; i += 200) {
        const { error } = await supabaseAdmin
          .from("convenios_cache")
          .upsert(rowsFinais.slice(i, i + 200));
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
          regrasTransferegov(
            rowsFinais.map((r) => ({
              id: r.id,
              valor_repasse: r.valor_liberado,
              valor_global: r.valor,
            })),
          ),
        );
      } catch (e) {
        // Não interrompe a ingestão, mas o erro de QA fica visível no retorno.
        errosPasso.push(`qa p${pagina}: ${(e as Error).message}`);
      }

      // Página menor que a padrão do Portal (15) = última.
      return {
        processados: rowsFinais.length,
        fim: json.length < 15,
        custo,
        erros: errosPasso,
      };
    },
  });

  erros.push(...rodada.erros);

  // Linha de rodada no Histórico — inclui consulta vazia e motivo de parada.
  const avisoHistorico = await registrarRodadaImportacao(
    {
      fonte: "transferegov",
      escopo: escopoDoEnte(data),
      ...anoMesDaJanela(data.dataInicial, data.dataFinal),
      endpoint: `GET https://api.portaldatransparencia.gov.br/api-de-dados/convenios?dataInicial=${brDate(data.dataInicial)}&dataFinal=${brDate(data.dataFinal)}${data.codigoIbgeMunicipio ? `&codigoIBGE=${data.codigoIbgeMunicipio}` : ""}${data.codigoUF ? `&codigoUFConvenente=${data.codigoUF}` : ""}`,
      unidade: "páginas",
      userId,
      ...origem,
      duracaoMs: Date.now() - inicioRodada,
    },
    rodada,
  );
  if (avisoHistorico) erros.push(avisoHistorico);

  return {
    importados: rodada.processados,
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

/** Importa convênios e contratos de repasse de uma janela (ver o núcleo acima). */
export const importarConveniosTransferegov = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => importarConveniosPorEnteSchema.parse(input))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);
    return rodadaConveniosPorEnte(data, context.userId);
  });
