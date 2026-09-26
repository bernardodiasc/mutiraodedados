import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { portalGet, PORTAL_BASE } from "@/lib/data/real/portal-client";
import { ensureAdmin, sleep, TETO_SUBREQUISICOES_PORTAL } from "@/lib/data/real/sweep";
import { registrarRodadaImportacao } from "@/lib/data/historico.server";
import type { OrigemRodada } from "@/lib/data/historico-rodada";
import { rodarComOrcamento, type ResultadoRodada } from "@/lib/data/runner";
import { checkpointImportacao } from "@/lib/data/checkpoint.server";
import { reacaoAoErro, reacaoAoErroDeLista } from "@/lib/data/erro-origem";
import { JANELA_ORCAMENTO_MS } from "@/lib/data/janela-varredura";

/**
 * Catálogo de órgãos SIAFI-driven.
 *
 * Duas rotinas, expostas juntas por um botão no admin ("Sincronizar catálogo de
 * órgãos") e, cada uma, como tarefa do modo nomeado (`cgu_siafi` e
 * `cgu_atividade`):
 *
 * 1. {@link rodadaCatalogoSiafi} — pagina `/orgaos-siafi` e grava nome de cada
 *    código válido em `orgaos_cache` (fonte de nomes + picklist de import). NÃO
 *    decide ativo/extinto: o SIAFI congela e mantém códigos de órgãos extintos.
 *
 * 2. {@link rodadaAtividadeOrgaos} — para cada órgão do catálogo (e cada um que
 *    aparece em documentos), sonda `/despesas/por-orgao` no ano corrente (e no
 *    anterior, por causa da defasagem de execução). Sem execução recente →
 *    `ativo = false` (extinto/inativo), mantendo a página histórica.
 *
 * As duas são retomáveis: cada rodada trabalha até esgotar o orçamento de
 * tempo ou de custo, grava o cursor em `importacao_varredura` e devolve
 * `haMais`; quem chamou repete até o fim. Os ÓRGÃOS ATIVOS DO CATÁLOGO
 * ({@link orgaosAtivosDoCatalogo}) — os que a sonda confirmou com execução —
 * são, por padrão, os órgãos que a ferramenta percorre nas tarefas por órgão.
 */

const CODIGO_INVALIDO = "CODIGO INVALIDO";

type OrgaoSiafi = { codigo?: string; descricao?: string };

/** Remove o sufixo verboso "- Unidades com vínculo direto" das descrições SIAFI. */
function limparNomeSiafi(descricao: string): string {
  return descricao.replace(/\s*-\s*Unidades com vínculo direto\s*$/i, "").trim();
}

/** Linhas de rodada no Histórico: a mesma fonte, uma linha da matriz por rotina. */
export const FONTE_ORGAOS_SIAFI = "orgaos_siafi";
export const ESCOPO_CATALOGO_SIAFI = "nomes";
export const ESCOPO_ATIVIDADE = "atividade";

/** Chaves de varredura em `importacao_varredura` — as mesmas para painel e ferramenta. */
export const CHAVE_VARREDURA_CATALOGO_SIAFI = "orgaos_siafi#nomes";
export const CHAVE_VARREDURA_ATIVIDADE = "orgaos_siafi#atividade";

/**
 * O que uma rodada retomável do catálogo devolve: o formato das demais
 * fontes (`importados`, `erros`, `varredura`), mais os contadores próprios.
 */
export type VarreduraDoCatalogo = {
  haMais: boolean;
  cursor: number;
  totalAcumulado: number;
  orcamentoEsgotado: boolean;
  custoEsgotado: boolean;
};

const varreduraDa = (r: ResultadoRodada): VarreduraDoCatalogo => ({
  haMais: !r.concluido,
  cursor: r.cursorFinal,
  totalAcumulado: r.totalAcumulado,
  orcamentoEsgotado: r.orcamentoEsgotado,
  custoEsgotado: r.custoEsgotado,
});

/**
 * Parâmetros do catálogo SIAFI — o mesmo schema na casca autenticada e no
 * modo nomeado.
 */
export const sincronizarCatalogoSiafiSchema = z.object({
  // Rede de segurança: o endpoint pagina em blocos de 15 e a varredura
  // completa leva centenas de páginas, em várias rodadas.
  maxPaginas: z.number().int().min(1).max(5000).default(5000),
  delayMs: z.number().int().min(0).max(2000).default(120),
});

export type ParamsCatalogoSiafi = z.infer<typeof sincronizarCatalogoSiafiSchema>;

/**
 * Núcleo chamável sem sessão: UMA rodada da paginação de `/orgaos-siafi`,
 * uma página por passo. Cada página é gravada ao ser lida (upsert só de
 * `{cod, nome}`), então a rodada interrompida não perde o que já leu. A
 * origem não informa o total: o fim é a primeira página vazia.
 */
export async function rodadaCatalogoSiafi(
  data: ParamsCatalogoSiafi,
  userId: string | null,
  origem: OrigemRodada = {},
) {
  const inicioRodada = Date.now();
  let invalidos = 0;
  let totalBruto = 0;

  const rodada = await rodarComOrcamento({
    chave: CHAVE_VARREDURA_CATALOGO_SIAFI,
    checkpoint: checkpointImportacao,
    orcamentoMs: JANELA_ORCAMENTO_MS,
    orcamentoCusto: TETO_SUBREQUISICOES_PORTAL,
    maxPassos: data.maxPaginas,
    passo: async (pagina) => {
      let lote: OrgaoSiafi[];
      try {
        lote = await portalGet<OrgaoSiafi[]>("/orgaos-siafi", { pagina: String(pagina) });
      } catch (e) {
        const r = reacaoAoErroDeLista(e);
        return {
          processados: 0,
          fim: r.fim,
          interromper: r.interromper,
          custo: 1,
          erros: [`p${pagina}: ${(e as Error).message}`],
        };
      }
      if (data.delayMs) await sleep(data.delayMs);
      if (!Array.isArray(lote) || lote.length === 0) return { processados: 0, fim: true, custo: 1 };

      const validos = new Map<string, string>(); // cod -> nome limpo
      let invalidosDaPagina = 0;
      for (const item of lote) {
        const cod = (item.codigo ?? "").trim();
        const desc = (item.descricao ?? "").trim();
        if (!cod) continue;
        if (desc.toUpperCase().includes(CODIGO_INVALIDO)) {
          invalidosDaPagina++;
          continue;
        }
        validos.set(cod, limparNomeSiafi(desc) || cod);
      }

      // Upsert só de {cod, nome}: em INSERT as demais colunas usam DEFAULT
      // (poder='executivo', ativo=true, disponivel_portal=true); em conflito só o
      // nome é atualizado — sigla/funcao/nota/ativo já preenchidos ficam intactos.
      const linhas = [...validos.entries()].map(([cod, nome]) => ({ cod, nome }));
      if (linhas.length > 0) {
        const { error } = await supabaseAdmin
          .from("orgaos_cache")
          .upsert(linhas, { onConflict: "cod" });
        if (error) {
          // Banco fora refaz a página; erro de dado registra e segue.
          const r = reacaoAoErro(new Error(error.message));
          return {
            processados: 0,
            fim: false,
            interromper: r.interromper,
            custo: 2,
            erros: [`db p${pagina}: ${error.message}`],
          };
        }
      }
      totalBruto += lote.length;
      invalidos += invalidosDaPagina;
      return { processados: linhas.length, fim: false, custo: 2 };
    },
  });

  const erros = [...rodada.erros];
  const avisoHistorico = await registrarRodadaImportacao(
    {
      fonte: FONTE_ORGAOS_SIAFI,
      escopo: ESCOPO_CATALOGO_SIAFI,
      endpoint: `GET ${PORTAL_BASE}/orgaos-siafi (${invalidos} inválidos ignorados nesta rodada)`,
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
    invalidos,
    totalBruto,
    erros,
    varredura: varreduraDa(rodada),
  };
}

export const sincronizarOrgaosSIAFI = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => sincronizarCatalogoSiafiSchema.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);
    return rodadaCatalogoSiafi(data, context.userId);
  });

/** Há execução orçamentária do órgão `cod` no `ano`? Checa a árvore (orgaoSuperior) e o próprio órgão. */
async function temExecucao(
  cod: string,
  ano: number,
  delayMs: number,
): Promise<{
  tem: boolean;
  consultas: number;
}> {
  let consultas = 0;
  for (const filtro of ["orgaoSuperior", "orgao"] as const) {
    const r = await portalGet<unknown[]>("/despesas/por-orgao", {
      ano: String(ano),
      [filtro]: cod,
      pagina: "1",
    });
    consultas++;
    if (delayMs) await sleep(delayMs);
    if (Array.isArray(r) && r.length > 0) return { tem: true, consultas };
  }
  return { tem: false, consultas };
}

const PAGINA_DO_BANCO = 1000;

/**
 * Os órgãos que a sonda de atividade verifica: o catálogo (`orgaos_cache`,
 * só os cobertos pelo Portal) e os que aparecem em documentos já ingeridos,
 * em ordem de código — o cursor da retomada depende dela.
 */
export async function codigosDaSondaDeAtividade(): Promise<string[]> {
  const set = new Set<string>();
  for (let de = 0; ; de += PAGINA_DO_BANCO) {
    const { data, error } = await supabaseAdmin
      .from("orgaos_cache")
      .select("cod")
      .eq("disponivel_portal", true)
      .order("cod")
      .range(de, de + PAGINA_DO_BANCO - 1);
    if (error) throw new Error(`orgaos_cache: ${error.message}`);
    for (const r of data ?? []) set.add(r.cod);
    if ((data ?? []).length < PAGINA_DO_BANCO) break;
  }
  const { codigosComDados } = await import("@/lib/data/status.server");
  for (const cod of await codigosComDados()) set.add(cod);
  return [...set].sort();
}

/**
 * Órgãos ativos do catálogo: os que a sonda de atividade já verificou e
 * achou com execução recente, cobertos pelo Portal, em ordem de código. É a
 * lista que as tarefas por órgão (contratos, licitações) percorrem quando a
 * ferramenta não recebe `--orgao`. Órgão nunca sondado não entra: rode a
 * atividade dos órgãos antes.
 */
export async function orgaosAtivosDoCatalogo(): Promise<string[]> {
  const codigos: string[] = [];
  for (let de = 0; ; de += PAGINA_DO_BANCO) {
    const { data, error } = await supabaseAdmin
      .from("orgaos_cache")
      .select("cod")
      .eq("ativo", true)
      .eq("disponivel_portal", true)
      .not("ultima_verificacao_atividade", "is", null)
      .order("cod")
      .range(de, de + PAGINA_DO_BANCO - 1);
    if (error) throw new Error(`órgãos ativos do catálogo: ${error.message}`);
    codigos.push(...(data ?? []).map((r) => r.cod));
    if ((data ?? []).length < PAGINA_DO_BANCO) return codigos;
  }
}

/** Parâmetros da sonda de atividade — o mesmo schema na casca e no modo nomeado. */
export const verificarAtividadeSchema = z.object({
  delayMs: z.number().int().min(0).max(2000).default(250),
});

export type ParamsAtividade = z.infer<typeof verificarAtividadeSchema>;

/**
 * Núcleo chamável sem sessão: UMA rodada da sonda de atividade, um órgão por
 * passo (até 4 consultas: ano corrente e anterior, pela árvore e pelo
 * próprio órgão). A execução tem defasagem no início do ano, então "sem
 * despesa no ano corrente" sozinho geraria falso-positivo de extinção.
 */
export async function rodadaAtividadeOrgaos(
  data: ParamsAtividade,
  userId: string | null,
  origem: OrigemRodada = {},
) {
  const inicioRodada = Date.now();
  const consultadoEm = new Date().toISOString();
  const anoAtual = new Date().getFullYear();
  const anos = [anoAtual, anoAtual - 1];
  const codigos = await codigosDaSondaDeAtividade();
  let ativos = 0;
  let inativos = 0;

  const rodada = await rodarComOrcamento({
    chave: CHAVE_VARREDURA_ATIVIDADE,
    checkpoint: checkpointImportacao,
    orcamentoMs: JANELA_ORCAMENTO_MS,
    orcamentoCusto: TETO_SUBREQUISICOES_PORTAL,
    maxPassos: codigos.length + 1,
    passo: async (cursor) => {
      if (cursor > codigos.length) return { processados: 0, fim: true };
      const cod = codigos[cursor - 1];
      let custo = 0;
      let anoComDespesa: number | null = null;
      try {
        for (const ano of anos) {
          const r = await temExecucao(cod, ano, data.delayMs);
          custo += r.consultas;
          if (r.tem) {
            anoComDespesa = ano;
            break;
          }
        }
      } catch (e) {
        // Passageiro (cota, 5xx, rede) refaz o órgão; definitivo registra e segue.
        const r = reacaoAoErro(e);
        return {
          processados: 0,
          fim: false,
          interromper: r.interromper,
          custo: custo + 1,
          erros: [`${cod}: ${(e as Error).message}`],
        };
      }
      const ativo = anoComDespesa !== null;
      const { error } = await supabaseAdmin
        .from("orgaos_cache")
        .update({
          ativo,
          ano_ultima_despesa: anoComDespesa,
          ultima_verificacao_atividade: consultadoEm,
        })
        .eq("cod", cod);
      custo++;
      // Órgão com dados mas ausente do catálogo (sync SIAFI não rodou / código
      // não listado): o update é no-op; o /orgaos ainda o mostra como "Órgão {cod}".
      if (error) {
        const r = reacaoAoErro(new Error(error.message));
        return {
          processados: 0,
          fim: false,
          interromper: r.interromper,
          custo,
          erros: [`db ${cod}: ${error.message}`],
        };
      }
      if (ativo) ativos++;
      else inativos++;
      return { processados: 1, fim: cursor === codigos.length, custo };
    },
  });

  const erros = [...rodada.erros];
  const avisoHistorico = await registrarRodadaImportacao(
    {
      fonte: FONTE_ORGAOS_SIAFI,
      escopo: ESCOPO_ATIVIDADE,
      endpoint: `GET ${PORTAL_BASE}/despesas/por-orgao?ano=${anos.join("|")}&orgaoSuperior=… (sonda de atividade de ${codigos.length} órgãos; nesta rodada ${ativos} ativos, ${inativos} inativos)`,
      unidade: "órgãos",
      userId,
      ...origem,
      duracaoMs: Date.now() - inicioRodada,
    },
    rodada,
  );
  if (avisoHistorico) erros.push(avisoHistorico);

  return {
    verificados: rodada.processados,
    ativos,
    inativos,
    /** Órgãos na lista da sonda. */
    total: codigos.length,
    erros,
    varredura: varreduraDa(rodada),
  };
}

export const verificarAtividadeOrgaos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => verificarAtividadeSchema.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);
    return rodadaAtividadeOrgaos(data, context.userId);
  });
