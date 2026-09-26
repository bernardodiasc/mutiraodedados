import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ehStatusTransitorio, fetchComRetry } from "@/lib/data/http-retry";
import { rodarComOrcamento } from "@/lib/data/runner";
import { checkpointImportacao } from "@/lib/data/checkpoint.server";
import { ehErroTransitorio } from "@/lib/data/erro-origem";
import { registrarRodadaImportacao, inserirImportacoes } from "@/lib/data/historico.server";
import { JANELA_ORCAMENTO_MS } from "@/lib/data/janela-varredura";
import { UF_LIST } from "@/lib/admin-entes/logic";
import {
  consultarRelatorio,
  periodosDoTipo,
  type PaginaSiconfi,
  type TipoRelatorio,
} from "@/lib/data/siconfi/consulta";
import {
  alvoNoCursor,
  CAPITAIS,
  chaveVarreduraSiconfi,
  escopoDaVarreduraSiconfi,
  exerciciosDoIntervalo,
  filtroDoConjunto,
  PARALELISMO_SICONFI,
  ROTULO_CONJUNTO,
  SICONFI_TETO_CUSTO_RODADA,
  rotuloAlvo,
  totalDeConsultas,
  type ConjuntoSiconfi,
  type EnteSiconfi,
} from "@/lib/data/siconfi/varredura";
import { ehPeriodoRecente, gatilhoPadrao, type OrigemRodada } from "@/lib/data/historico-rodada";
import { classificarResultado } from "@/lib/data/resultado-rodada";

/**
 * SICONFI — Tesouro Nacional
 * API pública sem chave: https://apidatalake.tesouro.gov.br/ords/siconfi/tt/
 * Cobre RREO, RGF, DCA e MSC de todos os 5.598 entes federados.
 */
const BASE = "https://apidatalake.tesouro.gov.br/ords/siconfi/tt";
const UA = "MutiraoDeDados/1.0 (+https://mutiraodedados.com.br)";

async function siconfiGet<T = unknown>(
  path: string,
  params: Record<string, string | number>,
): Promise<T> {
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();
  // Até a v0.3.0 esta era a única fonte sem retry nenhum: qualquer 503 do
  // Tesouro derrubava a rodada inteira.
  let res: Response;
  try {
    res = await fetchComRetry(`${BASE}${path}?${qs}`, {
      headers: { accept: "application/json", "user-agent": UA },
    });
  } catch (e) {
    throw new Error(`TRANSIENT: SICONFI indisponível (rede): ${(e as Error).message}`);
  }
  if (res.ok) return (await res.json()) as T;
  const body = await res.text().catch(() => "");
  const snippet = body.slice(0, 200);
  throw new Error(
    ehStatusTransitorio(res.status)
      ? `TRANSIENT: SICONFI ${res.status} (serviço indisponível — ${snippet})`
      : `SICONFI API ${res.status}: ${snippet}`,
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

/**
 * População atual de cada ente, pelo cadastro do próprio SICONFI (`/entes`).
 * Decide se o município pode ter optado pelo RGF semestral/simplificado.
 * Uma requisição por instância do worker; a falha não fica em cache e sobe
 * como erro da consulta (5xx/rede é transitório: a varredura refaz o passo).
 */
let populacoes: Promise<Map<string, number>> | null = null;
function populacaoDosEntes(): Promise<Map<string, number>> {
  populacoes ??= siconfiGet<PaginaSiconfi<{ cod_ibge: number; populacao: number }>>("/entes", {})
    .then((r) => new Map((r.items ?? []).map((e) => [String(e.cod_ibge), Number(e.populacao)])))
    .catch((e) => {
      populacoes = null;
      throw e;
    });
  return populacoes;
}

function esferaFromIbge(ibge: string): string {
  // IBGE de UF tem 2 dígitos, município tem 7. Distrito Federal = 53 (UF) ou 5300108 (mun).
  return ibge.length === 2 ? "estadual" : "municipal";
}

type PedidoRelatorio = {
  codIbge: string;
  exercicio: number;
  periodo?: number;
  tipoRelatorio: TipoRelatorio;
  anexo?: string;
};

/**
 * O período já pode ter crescido na origem? Lê o fim do período (o fim do
 * exercício no DCA) com a folga de sempre do "ainda não publicado".
 */
export function relatorioRecente(
  p: Pick<PedidoRelatorio, "exercicio" | "periodo" | "tipoRelatorio">,
) {
  const n = periodosDoTipo(p.tipoRelatorio);
  const mesFim = n > 0 && p.periodo ? p.periodo * (12 / n) : 12;
  return ehPeriodoRecente(p.exercicio, mesFim);
}

/**
 * Núcleo de ingestão de UM relatório SICONFI: busca (todos os poderes e a
 * forma certa — ver `consulta.ts`), normaliza, faz upsert, aplica QA e
 * registra a rodada em `importacoes` (uma linha por consulta — como as demais
 * fontes). Vazio só é registrado quando o extrato de entregas confirma que o
 * relatório não foi entregue; vazio com entrega registrada é erro.
 *
 * A linha de rodada casa com a matriz de cobertura: `escopo` = o tipo de
 * relatório (a linha da matriz), `ano` = exercício, `mes` = período (0 no
 * DCA, como a célula) — e o ente consultado vai em `orgao_cod`. Ela sai com
 * `resultado` também quando a consulta falha, e o erro volta em `erros` em
 * vez de lançar.
 */
export async function rodadaRelatorioSiconfi(
  params: PedidoRelatorio,
  userId: string | null,
  origem: OrigemRodada = {},
): Promise<{ importados: number; requisicoes: number; aviso?: string; erros: string[] }> {
  let r: Awaited<ReturnType<typeof ingerirRelatorio>> | null = null;
  const erros: string[] = [];
  try {
    r = await ingerirRelatorio(params);
  } catch (e) {
    erros.push((e as Error).message);
  }
  if (r?.erroQa) erros.push(`qa: ${r.erroQa}`);
  const importados = r?.importados ?? 0;

  // Histórico: uma linha por consulta. A linha com 0 registros e sem erro é o
  // marcador "consultado, vazio" — só chega aqui com o extrato confirmando a
  // não entrega (o vazio inesperado é erro em `consultarRelatorio`).
  const erroHistorico = await inserirImportacoes({
    fonte: "siconfi",
    escopo: r?.tipoGravado ?? params.tipoRelatorio,
    orgao_cod: params.codIbge,
    ano: params.exercicio,
    mes: params.periodo ?? 0,
    total_bruto: importados,
    importados,
    erros,
    resultado: classificarResultado({
      importados,
      erros,
      periodoRecente: relatorioRecente(params),
    }),
    user_id: userId,
    gatilho: origem.gatilho ?? gatilhoPadrao(userId),
    execucao_id: origem.execucaoId ?? null,
    // O relógio do Worker, como a linha de rodada da varredura: a conferência
    // ordena as linhas da execução por aqui, e a da rodada tem de vir depois
    // das consultas que ela fez.
    consultado_em: new Date().toISOString(),
    endpoint:
      r?.endpoint ??
      `SICONFI ${params.tipoRelatorio} ${params.exercicio}${params.periodo ? `/${params.periodo}` : ""} (ente ${params.codIbge})`,
  });
  if (erroHistorico) console.error("[siconfi] falha ao registrar importacao", erroHistorico);

  return {
    importados,
    requisicoes: r?.requisicoes ?? 0,
    ...(r?.aviso ? { aviso: r.aviso } : {}),
    erros,
  };
}

/** Casca do painel: a falha da consulta vira exceção, como antes. */
async function ingerirRelatorioSiconfi(
  params: PedidoRelatorio & { userId: string },
): Promise<{ importados: number; requisicoes: number; aviso?: string }> {
  const { userId, ...pedido } = params;
  const r = await rodadaRelatorioSiconfi(pedido, userId);
  const falha = r.erros.find((e) => !e.startsWith("qa: "));
  if (falha) throw new Error(falha);
  return {
    importados: r.importados,
    requisicoes: r.requisicoes,
    ...(r.aviso ? { aviso: r.aviso } : {}),
  };
}

/** Busca, grava e aplica o QA de um relatório. Lança se a consulta falhar. */
async function ingerirRelatorio(params: PedidoRelatorio) {
  const { codIbge, exercicio, periodo, tipoRelatorio, anexo } = params;

  const populacao =
    codIbge.length === 7 ? ((await populacaoDosEntes()).get(codIbge) ?? null) : null;

  const r = await consultarRelatorio({
    buscar: siconfiGet,
    base: BASE,
    codIbge,
    exercicio,
    periodo,
    tipo: tipoRelatorio,
    populacao,
    anexo,
  });
  const endpoint = r.endpoints.join(" · ");

  const esfera = esferaFromIbge(codIbge);
  const tipoGravado = r.tipo === "dados" ? r.forma.tipo : tipoRelatorio;
  const rows = (r.tipo === "dados" ? r.itens : []).map((it, idx) => {
    // O poder entra na chave só no RGF: um anexo/conta/coluna se repete em
    // cada poder e, sem ele, o Legislativo sobrescreveria o Executivo.
    const key = [
      codIbge,
      exercicio,
      periodo ?? 0,
      tipoGravado,
      ...(it.poder ? [it.poder] : []),
      it.anexo ?? "",
      it.cod_conta ?? "",
      it.coluna ?? "",
      idx,
    ].join("|");
    return {
      id: key,
      cod_ibge: codIbge,
      esfera,
      uf: it.uf ?? null,
      ente_nome: it.instituicao ?? "Ente",
      exercicio: Number(it.exercicio ?? exercicio),
      periodo: periodo ?? null,
      periodicidade: it.periodicidade ?? null,
      tipo_relatorio: tipoGravado,
      anexo: it.anexo ?? anexo ?? null,
      coluna: it.coluna ?? null,
      cod_conta: it.cod_conta ?? null,
      conta: it.conta ?? null,
      valor: Number(it.valor ?? 0),
      updated_at: new Date().toISOString(),
    };
  });

  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await supabaseAdmin
      .from("siconfi_relatorios_cache")
      .upsert(rows.slice(i, i + 200));
    if (error) throw new Error(`db: ${error.message}`);
  }

  let erroQa: string | null = null;
  if (rows.length > 0) {
    try {
      const { regrasSiconfi, flagQA } = await import("@/lib/data/qa");
      await flagQA(
        regrasSiconfi(
          rows.map((r) => ({
            id: r.id,
            valor: r.valor,
            conta: r.conta,
            tipo_relatorio: r.tipo_relatorio,
          })),
        ),
      );
    } catch (e) {
      // Não interrompe a ingestão; o erro de QA vai para o log da importação.
      erroQa = (e as Error).message;
    }
  }

  const requisicoes = r.requisicoes + Math.ceil(rows.length / 200);
  const aviso =
    r.tipo === "nao_entregue"
      ? "Relatório não entregue ao SICONFI para este ente/período (conferido no extrato de entregas)."
      : r.poderesSemDados.length > 0
        ? `Sem ${tipoGravado} publicado para o(s) poder(es) ${r.poderesSemDados.join(", ")}.`
        : undefined;
  return { importados: rows.length, requisicoes, aviso, erroQa, tipoGravado, endpoint };
}

/**
 * Parâmetros de um relatório — fonte única da validação: a casca autenticada
 * e o modo nomeado de `/api/cron-importar` usam este mesmo schema.
 */
export const importarRelatorioSICONFISchema = z.object({
  codIbge: z.string().regex(/^\d{2}$|^\d{7}$/),
  exercicio: z.number().int().min(2010).max(2100),
  periodo: z.number().int().min(1).max(6).optional(),
  tipoRelatorio: z.enum(["RREO", "RREO Simplificado", "RGF", "RGF Simplificado", "DCA"]),
  anexo: z.string().optional(),
});

/**
 * Importa um relatório SICONFI (RREO, RGF ou DCA) para um ente específico.
 * Tipo: "RREO" (bimestral), "RGF" (quadrimestral), "DCA" (anual).
 */
export const importarRelatorioSICONFI = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => importarRelatorioSICONFISchema.parse(input))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);
    return ingerirRelatorioSiconfi({
      codIbge: String(data.codIbge),
      exercicio: data.exercicio,
      periodo: data.periodo,
      tipoRelatorio: data.tipoRelatorio,
      anexo: data.anexo,
      userId: context.userId,
    });
  });

/**
 * Parâmetros da varredura em massa — fonte única da validação: a casca
 * autenticada e o modo nomeado de `/api/cron-importar` usam este mesmo schema.
 */
export const varrerSiconfiSchema = z
  .object({
    conjunto: z.enum(["ufs", "capitais", "municipios", "ente"]),
    exercicioInicial: z.number().int().min(2010).max(2100),
    exercicioFinal: z.number().int().min(2010).max(2100),
    /** Obrigatório quando conjunto = "municipios". */
    uf: z.string().length(2).optional(),
    /** Obrigatório quando conjunto = "ente". */
    codIbge: z
      .string()
      .regex(/^\d{2}$|^\d{7}$/)
      .optional(),
  })
  .refine((p) => p.exercicioFinal >= p.exercicioInicial, {
    message: "Intervalo de exercícios inválido: o final é anterior ao inicial.",
  });

export type ParamsVarreduraSiconfi = z.infer<typeof varrerSiconfiSchema>;

/**
 * Parâmetros do "ano todo" de um ente — o conjunto padrão de relatórios de um
 * exercício. Mesmo schema na casca e no modo nomeado.
 */
export const importarConjuntoSICONFISchema = z.object({
  codIbge: z.string().regex(/^\d{2}$|^\d{7}$/),
  exercicio: z.number().int().min(2010).max(2100),
});

/** O "ano todo" de um ente é a varredura desse ente num exercício só. */
export const varreduraDoAnoTodo = (p: {
  codIbge: string;
  exercicio: number;
}): ParamsVarreduraSiconfi => ({
  conjunto: "ente",
  codIbge: p.codIbge,
  exercicioInicial: p.exercicio,
  exercicioFinal: p.exercicio,
});

/**
 * Chave da varredura — a mesma para painel e ferramenta. O "ano todo" de um
 * ente cai na chave do conjunto "ente" com um exercício só.
 */
export const chaveDaVarreduraSiconfi = (p: ParamsVarreduraSiconfi) =>
  chaveVarreduraSiconfi(p.conjunto, p.exercicioInicial, p.exercicioFinal, filtroDoConjunto(p));

/**
 * Núcleo da varredura em massa do SICONFI: percorre (ente × exercício ×
 * relatório) numa sequência retomável, uma consulta por passo.
 *
 * Importar o histórico ente a ente pela tela é inviável — só as 27 UFs em 14
 * exercícios já são 3.780 consultas. Aqui a varredura roda em rodadas
 * limitadas por tempo e por subrequisições, grava onde parou, e quem chama
 * (painel ou ferramenta) repete até `haMais` virar falso.
 *
 * Cada consulta grava a sua linha em `importacoes` como o relatório avulso
 * (`rodadaRelatorioSiconfi`): tipo no `escopo`, exercício e período em
 * `ano`/`mes`, ente em `orgao_cod` — o casamento com a matriz de cobertura —,
 * com `resultado` e a execução. A rodada grava mais uma linha, com o conjunto
 * no `escopo` (`varredura:<conjunto>[:<filtro>]`); numa varredura de um
 * exercício só, ela ancora o exercício (`mes` 0, como o DCA): é nela que a
 * conferência da janela fica gravada.
 *
 * Consulta sem dados NÃO é erro quando o extrato de entregas confirma que o
 * relatório não foi entregue: ela conta como consultada e a varredura segue.
 * Falha passageira da origem interrompe a rodada sem avançar (a próxima refaz
 * a consulta); erro definitivo é registrado e a varredura segue.
 */
export async function rodadaVarreduraSiconfi(
  data: ParamsVarreduraSiconfi,
  userId: string | null,
  origem: OrigemRodada = {},
) {
  const exercicios = exerciciosDoIntervalo(data.exercicioInicial, data.exercicioFinal);
  if (exercicios.length === 0) {
    throw new Error("Intervalo de exercícios inválido: o final é anterior ao inicial.");
  }

  const entes = await resolverEntes(data.conjunto, data.uf, data.codIbge);
  if (entes.length === 0) {
    throw new Error("Nenhum ente no conjunto escolhido.");
  }

  let semDados = 0;
  const inicioRodada = Date.now();
  const totalConsultas = totalDeConsultas(entes.length, exercicios.length);

  const rodada = await rodarComOrcamento({
    chave: chaveDaVarreduraSiconfi(data),
    checkpoint: checkpointImportacao,
    orcamentoMs: JANELA_ORCAMENTO_MS,
    orcamentoCusto: SICONFI_TETO_CUSTO_RODADA,
    paralelismo: PARALELISMO_SICONFI,
    // Uma a mais que as consultas: a sondagem que descobre o fim cabe na
    // mesma rodada, sem uma rodada extra só para ela.
    maxPassos: totalConsultas + 1,
    passo: async (cursor) => {
      const { posicao, fim } = alvoNoCursor(entes, exercicios, cursor);
      if (fim || !posicao) return { processados: 0, fim: true };

      const { ente, exercicio, alvo } = posicao;
      const r = await rodadaRelatorioSiconfi(
        {
          codIbge: ente.codigo,
          exercicio,
          periodo: alvo.periodo,
          tipoRelatorio: alvo.tipoRelatorio,
        },
        userId,
        origem,
      );
      const falha = r.erros.find((e) => !e.startsWith("qa: "));
      if (falha) {
        const erros = [`${ente.nome}/${exercicio} ${rotuloAlvo(alvo)}: ${falha}`];
        // Falha passageira da origem interrompe sem avançar: a próxima rodada
        // refaz esta consulta. Erro definitivo é registrado e a varredura
        // segue — um relatório indisponível não pode travar 3.780 consultas.
        return {
          processados: 0,
          fim: false,
          custo: 2,
          erros,
          interromper: ehErroTransitorio(falha),
        };
      }
      if (r.importados === 0) semDados++;
      // Requisições à API (um poder por vez no RGF, páginas, extrato) +
      // as gravações em lote (~1 por 200 linhas).
      return { processados: r.importados, fim: false, custo: r.requisicoes };
    },
  });

  // Varredura de um exercício só ancora o exercício, com o período 0 (o do
  // DCA): é a janela da ferramenta, e a conferência a acha por aqui.
  const umExercicio = data.exercicioInicial === data.exercicioFinal;
  const erros = [...rodada.erros];
  const avisoHistorico = await registrarRodadaImportacao(
    {
      fonte: "siconfi",
      escopo: escopoDaVarreduraSiconfi(data),
      orgaoCod: data.conjunto === "ente" ? (data.codIbge ?? null) : null,
      ano: umExercicio ? data.exercicioInicial : null,
      mes: umExercicio ? 0 : null,
      endpoint: `GET ${BASE}/{rreo,rgf,dca} (varredura ${ROTULO_CONJUNTO[data.conjunto]}, exercícios ${data.exercicioInicial}–${data.exercicioFinal})`,
      unidade: "consultas",
      userId,
      gatilho: origem.gatilho,
      execucaoId: origem.execucaoId ?? null,
      duracaoMs: Date.now() - inicioRodada,
      periodoRecente: umExercicio && ehPeriodoRecente(data.exercicioInicial, 12),
    },
    rodada,
  );
  if (avisoHistorico) erros.push(avisoHistorico);

  return {
    importados: rodada.processados,
    consultas: Math.max(0, rodada.cursorFinal - rodada.cursorInicial + 1),
    semDados,
    totalConsultas,
    entes: entes.length,
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

/**
 * Importa o CONJUNTO PADRÃO de relatórios fiscais de um ente/exercício: RREO
 * (bimestres 1..6), RGF (quadrimestres 1..3) e DCA (anual). É a varredura do
 * ente num exercício só — retomável: o painel repete até `haMais` virar falso.
 * Cada consulta gera a sua própria linha em `importacoes`; falhas
 * individuais não abortam o lote.
 */
export const importarConjuntoSICONFI = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => importarConjuntoSICONFISchema.parse(input))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);
    return rodadaVarreduraSiconfi(varreduraDoAnoTodo(data), context.userId);
  });

/**
 * Varredura em massa do SICONFI, pelo painel: uma rodada do núcleo
 * {@link rodadaVarreduraSiconfi}; o painel repete até terminar.
 */
export const varrerSiconfi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => varrerSiconfiSchema.parse(input))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);
    return rodadaVarreduraSiconfi(data, context.userId);
  });

/**
 * Lista de entes do conjunto escolhido. UFs e capitais são estáticas; a lista
 * de municípios de uma UF vem do IBGE (uma requisição por rodada).
 */
async function resolverEntes(
  conjunto: ConjuntoSiconfi,
  uf?: string,
  codIbge?: string,
): Promise<EnteSiconfi[]> {
  if (conjunto === "ufs") {
    return UF_LIST.map((u) => ({ codigo: u.codigo, nome: u.nome, uf: u.uf ?? "" }));
  }
  if (conjunto === "capitais") return [...CAPITAIS];
  if (conjunto === "ente") {
    if (!codIbge) throw new Error("Informe o código IBGE do ente.");
    return [{ codigo: codIbge, nome: codIbge, uf: uf ?? "" }];
  }
  if (!uf) throw new Error("Informe a UF para varrer os municípios.");
  // Cadastro próprio primeiro (ibge_municipios_cache, v0.7.0) — cada rodada
  // da varredura re-lia a lista na API do IBGE, uma dependência externa a
  // mais para falhar no meio de uma carga longa. A API fica de fallback
  // enquanto o cache não foi importado.
  const { data: doCache } = await supabaseAdmin
    .from("ibge_municipios_cache")
    .select("codigo,nome")
    .eq("uf", uf.toUpperCase())
    .order("codigo");
  if (doCache && doCache.length > 0) {
    return doCache.map((m) => ({ codigo: m.codigo, nome: m.nome, uf }));
  }
  const res = await fetchComRetry(
    `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${encodeURIComponent(uf)}/municipios`,
    { headers: { accept: "application/json" } },
  );
  if (!res.ok) throw new Error(`TRANSIENT: IBGE ${res.status} ao listar municípios de ${uf}`);
  const lista = (await res.json()) as Array<{ id: number; nome: string }>;
  return lista
    .map((m) => ({ codigo: String(m.id), nome: m.nome, uf }))
    .sort((a, b) => a.codigo.localeCompare(b.codigo));
}
