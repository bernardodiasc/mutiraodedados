import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ehStatusTransitorio, fetchComRetry } from "@/lib/data/http-retry";

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

type SiconfiItem = {
  cod_ibge?: string | number;
  instituicao?: string;
  uf?: string;
  exercicio?: number;
  periodo?: number;
  periodicidade?: string;
  anexo?: string;
  coluna?: string;
  cod_conta?: string;
  conta?: string;
  valor?: number | string;
  esfera?: string;
};

type SiconfiResp = { items?: SiconfiItem[]; count?: number };

type TipoRelatorio = "RREO" | "RREO Simplificado" | "RGF" | "RGF Simplificado" | "DCA";

function esferaFromIbge(ibge: string): string {
  // IBGE de UF tem 2 dígitos, município tem 7. Distrito Federal = 53 (UF) ou 5300108 (mun).
  return ibge.length === 2 ? "estadual" : "municipal";
}

/**
 * Núcleo de ingestão de UM relatório SICONFI: busca, normaliza, faz upsert,
 * aplica QA e registra a rodada em `importacoes` (uma linha por consulta — como
 * as demais fontes). Retorna a contagem importada.
 */
async function ingerirRelatorioSiconfi(params: {
  codIbge: string;
  exercicio: number;
  periodo?: number;
  tipoRelatorio: TipoRelatorio;
  anexo?: string;
  userId: string;
}): Promise<{ importados: number; aviso?: string }> {
  const { codIbge, exercicio, periodo, tipoRelatorio, anexo, userId } = params;

  // SICONFI endpoints divergem por tipo
  let path: string;
  const reqParams: Record<string, string | number> = {
    an_exercicio: exercicio,
    id_ente: codIbge,
  };

  if (tipoRelatorio === "DCA") {
    path = "/dca";
    if (anexo) reqParams.no_anexo = anexo;
  } else if (tipoRelatorio.startsWith("RREO")) {
    path = "/rreo";
    if (!periodo) throw new Error("RREO exige 'periodo' (1..6 bimestres).");
    reqParams.nr_periodo = periodo;
    reqParams.co_tipo_demonstrativo =
      tipoRelatorio === "RREO Simplificado" ? "RREO Simplificado" : "RREO";
    if (anexo) reqParams.no_anexo = anexo;
  } else {
    path = "/rgf";
    if (!periodo) throw new Error("RGF exige 'periodo' (1..3 quadrimestres).");
    reqParams.nr_periodo = periodo;
    reqParams.co_tipo_demonstrativo =
      tipoRelatorio === "RGF Simplificado" ? "RGF Simplificado" : "RGF";
    if (anexo) reqParams.no_anexo = anexo;
  }

  const endpoint = `GET ${BASE}${path}?${new URLSearchParams(
    Object.entries(reqParams).map(([k, v]) => [k, String(v)]),
  ).toString()}`;

  const json = await siconfiGet<SiconfiResp>(path, reqParams);
  const items = json.items ?? [];

  const esfera = esferaFromIbge(codIbge);
  const rows = items.map((it, idx) => {
    const key = [
      codIbge,
      exercicio,
      periodo ?? 0,
      tipoRelatorio,
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
      tipo_relatorio: tipoRelatorio,
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

  // Histórico: uma linha por consulta (inclui consultas vazias, como as demais fontes).
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

  if (rows.length === 0) {
    return {
      importados: 0,
      aviso: "Relatório não encontrado ou não publicado para este ente/período.",
    };
  }
  return { importados: rows.length };
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
