import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ehStatusTransitorio, fetchComRetry } from "@/lib/data/http-retry";
import { rodarComOrcamento } from "@/lib/data/runner";
import { checkpointImportacao } from "@/lib/data/checkpoint.server";
import { ehErroTransitorio } from "@/lib/data/erro-origem";
import { registrarRodadaImportacao } from "@/lib/data/historico.server";
import { JANELA_ORCAMENTO_MS, JANELA_TETO_SUBREQUISICOES } from "@/lib/data/janela-varredura";
import { UF_LIST } from "@/lib/admin-entes/logic";
import {
  consultarRelatorio,
  type PaginaSiconfi,
  type TipoRelatorio,
} from "@/lib/data/siconfi/consulta";
import {
  alvoNoCursor,
  CAPITAIS,
  chaveVarreduraSiconfi,
  exerciciosDoIntervalo,
  ROTULO_CONJUNTO,
  rotuloAlvo,
  totalDeConsultas,
  type ConjuntoSiconfi,
  type EnteSiconfi,
} from "@/lib/data/siconfi/varredura";

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

/**
 * Núcleo de ingestão de UM relatório SICONFI: busca (todos os poderes e a
 * forma certa — ver `consulta.ts`), normaliza, faz upsert, aplica QA e
 * registra a rodada em `importacoes` (uma linha por consulta — como as demais
 * fontes). Vazio só é registrado quando o extrato de entregas confirma que o
 * relatório não foi entregue; vazio com entrega registrada lança erro.
 */
async function ingerirRelatorioSiconfi(params: {
  codIbge: string;
  exercicio: number;
  periodo?: number;
  tipoRelatorio: TipoRelatorio;
  anexo?: string;
  userId: string;
}): Promise<{ importados: number; requisicoes: number; aviso?: string }> {
  const { codIbge, exercicio, periodo, tipoRelatorio, anexo, userId } = params;

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

  // Histórico: uma linha por consulta. A linha com 0 registros e sem erro é o
  // marcador "consultado, vazio" — só chega aqui com o extrato confirmando a
  // não entrega (o vazio inesperado lançou erro em `consultarRelatorio`).
  try {
    await supabaseAdmin.from("importacoes").insert({
      fonte: "siconfi",
      escopo: codIbge,
      ano: exercicio,
      mes: periodo ?? 1,
      total_bruto: rows.length,
      importados: rows.length,
      erros: erroQa ? [`qa: ${erroQa}`] : [],
      user_id: userId,
      endpoint,
    });
  } catch (e) {
    console.error("[siconfi] falha ao registrar importacao", e);
  }

  const requisicoes = r.requisicoes + Math.ceil(rows.length / 200);
  if (r.tipo === "nao_entregue") {
    return {
      importados: 0,
      requisicoes,
      aviso:
        "Relatório não entregue ao SICONFI para este ente/período (conferido no extrato de entregas).",
    };
  }
  const aviso =
    r.poderesSemDados.length > 0
      ? `Sem ${tipoGravado} publicado para o(s) poder(es) ${r.poderesSemDados.join(", ")}.`
      : undefined;
  return { importados: rows.length, requisicoes, ...(aviso ? { aviso } : {}) };
}

/**
 * Importa um relatório SICONFI (RREO, RGF ou DCA) para um ente específico.
 * Tipo: "RREO" (bimestral), "RGF" (quadrimestral), "DCA" (anual).
 */
export const importarRelatorioSICONFI = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        codIbge: z.string().regex(/^\d{2}$|^\d{7}$/),
        exercicio: z.number().int().min(2010).max(2100),
        periodo: z.number().int().min(1).max(6).optional(),
        tipoRelatorio: z.enum(["RREO", "RREO Simplificado", "RGF", "RGF Simplificado", "DCA"]),
        anexo: z.string().optional(),
      })
      .parse(input),
  )
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
 * Importa o CONJUNTO PADRÃO de relatórios fiscais de um ente/exercício numa só
 * ação: RREO (bimestres 1..6), RGF (quadrimestres 1..3) e DCA (anual). Cada
 * sub-relatório é uma consulta independente (e gera sua própria linha em
 * `importacoes`). Best-effort: falhas individuais não abortam o lote.
 */
export const importarConjuntoSICONFI = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        codIbge: z.string().regex(/^\d{2}$|^\d{7}$/),
        exercicio: z.number().int().min(2010).max(2100),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);
    const codIbge = String(data.codIbge);

    const alvos: Array<{ tipoRelatorio: TipoRelatorio; periodo?: number }> = [
      ...[1, 2, 3, 4, 5, 6].map((p) => ({ tipoRelatorio: "RREO" as const, periodo: p })),
      ...[1, 2, 3].map((p) => ({ tipoRelatorio: "RGF" as const, periodo: p })),
      { tipoRelatorio: "DCA" as const },
    ];

    let importados = 0;
    const erros: string[] = [];
    for (const alvo of alvos) {
      try {
        const r = await ingerirRelatorioSiconfi({
          codIbge,
          exercicio: data.exercicio,
          periodo: alvo.periodo,
          tipoRelatorio: alvo.tipoRelatorio,
          userId: context.userId,
        });
        importados += r.importados;
      } catch (e) {
        const msg = (e as Error).message;
        erros.push(`${alvo.tipoRelatorio}${alvo.periodo ? ` P${alvo.periodo}` : ""}: ${msg}`);
        console.error(`[siconfi] conjunto ${alvo.tipoRelatorio} ${alvo.periodo ?? ""} falhou`, e);
      }
    }
    return { importados, consultas: alvos.length, erros };
  });

/**
 * Varredura em massa do SICONFI: percorre (ente × exercício × relatório) numa
 * sequência retomável.
 *
 * Importar o histórico ente a ente pela tela é inviável — só as 27 UFs em 14
 * exercícios já são 3.780 consultas. Aqui a varredura roda em rodadas
 * limitadas por tempo e por subrequisições, grava onde parou e o painel
 * continua até terminar.
 *
 * Consulta sem dados NÃO é erro quando o extrato de entregas confirma que o
 * relatório não foi entregue: ela conta como consultada e a varredura segue.
 * Vazio com entrega registrada é erro definitivo (registrado, a varredura
 * segue, e nenhum marcador de vazio é gravado).
 */
export const varrerSiconfi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
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
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);

    const exercicios = exerciciosDoIntervalo(data.exercicioInicial, data.exercicioFinal);
    if (exercicios.length === 0) {
      throw new Error("Intervalo de exercícios inválido: o final é anterior ao inicial.");
    }

    const entes = await resolverEntes(data.conjunto, data.uf, data.codIbge);
    if (entes.length === 0) {
      throw new Error("Nenhum ente no conjunto escolhido.");
    }

    const erros: string[] = [];
    let semDados = 0;
    const inicioRodada = Date.now();

    const rodada = await rodarComOrcamento({
      chave: chaveVarreduraSiconfi(
        data.conjunto,
        data.exercicioInicial,
        data.exercicioFinal,
        data.conjunto === "municipios" ? (data.uf ?? null) : (data.codIbge ?? null),
      ),
      checkpoint: checkpointImportacao,
      orcamentoMs: JANELA_ORCAMENTO_MS,
      orcamentoCusto: JANELA_TETO_SUBREQUISICOES,
      maxPassos: totalDeConsultas(entes.length, exercicios.length),
      passo: async (cursor) => {
        const { posicao, fim } = alvoNoCursor(entes, exercicios, cursor);
        if (fim || !posicao) return { processados: 0, fim: true };

        const { ente, exercicio, alvo } = posicao;
        try {
          const r = await ingerirRelatorioSiconfi({
            codIbge: ente.codigo,
            exercicio,
            periodo: alvo.periodo,
            tipoRelatorio: alvo.tipoRelatorio,
            userId: context.userId,
          });
          if (r.importados === 0) semDados++;
          // Requisições à API (um poder por vez no RGF, páginas, extrato) +
          // as gravações em lote (~1 por 200 linhas).
          return { processados: r.importados, fim: false, custo: r.requisicoes };
        } catch (e) {
          const msg = (e as Error).message;
          const rotulo = `${ente.nome}/${exercicio} ${rotuloAlvo(alvo)}`;
          // Falha passageira da origem interrompe sem avançar: a próxima rodada
          // refaz esta consulta. Erro definitivo é registrado e a varredura
          // segue — um relatório indisponível não pode travar 3.780 consultas.
          if (ehErroTransitorio(e)) {
            return {
              processados: 0,
              fim: false,
              custo: 2,
              interromper: true,
              erros: [`${rotulo}: ${msg}`],
            };
          }
          return { processados: 0, fim: false, custo: 2, erros: [`${rotulo}: ${msg}`] };
        }
      },
    });

    erros.push(...rodada.erros);

    const avisoHistorico = await registrarRodadaImportacao(
      {
        fonte: "siconfi",
        escopo: data.conjunto === "ente" ? (data.codIbge ?? "") : data.conjunto,
        endpoint: `GET ${BASE}/{rreo,rgf,dca} (varredura ${ROTULO_CONJUNTO[data.conjunto]}, exercícios ${data.exercicioInicial}–${data.exercicioFinal})`,
        unidade: "consultas",
        userId: context.userId,
        duracaoMs: Date.now() - inicioRodada,
      },
      rodada,
    );
    if (avisoHistorico) erros.push(avisoHistorico);

    return {
      importados: rodada.processados,
      consultas: rodada.cursorFinal - rodada.cursorInicial + 1,
      semDados,
      totalConsultas: totalDeConsultas(entes.length, exercicios.length),
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
