import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * SICONFI — Tesouro Nacional
 * API pública sem chave: https://apidatalake.tesouro.gov.br/ords/siconfi/tt/
 * Cobre RREO, RGF, DCA e MSC de todos os 5.598 entes federados.
 */
const BASE = "https://apidatalake.tesouro.gov.br/ords/siconfi/tt";
const UA = "AuditoriaCidada/1.0 (+https://auditoria-cidada.lovable.app)";

async function siconfiGet<T = unknown>(path: string, params: Record<string, string | number>): Promise<T> {
  const qs = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)]),
  ).toString();
  const res = await fetch(`${BASE}${path}?${qs}`, {
    headers: { accept: "application/json", "user-agent": UA },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`SICONFI API ${res.status}: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as T;
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

function esferaFromIbge(ibge: string): string {
  // IBGE de UF tem 2 dígitos, município tem 7. Distrito Federal = 53 (UF) ou 5300108 (mun).
  return ibge.length === 2 ? "estadual" : "municipal";
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

    // SICONFI endpoints divergem por tipo
    let path: string;
    const params: Record<string, string | number> = {
      an_exercicio: data.exercicio,
      id_ente: data.codIbge,
    };

    if (data.tipoRelatorio === "DCA") {
      path = "/dca";
      if (data.anexo) params.no_anexo = data.anexo;
    } else if (data.tipoRelatorio.startsWith("RREO")) {
      path = "/rreo";
      if (!data.periodo) throw new Error("RREO exige 'periodo' (1..6 bimestres).");
      params.nr_periodo = data.periodo;
      params.co_tipo_demonstrativo = data.tipoRelatorio === "RREO Simplificado" ? "RREO Simplificado" : "RREO";
      if (data.anexo) params.no_anexo = data.anexo;
    } else {
      path = "/rgf";
      if (!data.periodo) throw new Error("RGF exige 'periodo' (1..3 quadrimestres).");
      params.nr_periodo = data.periodo;
      params.co_tipo_demonstrativo = data.tipoRelatorio === "RGF Simplificado" ? "RGF Simplificado" : "RGF";
      if (data.anexo) params.no_anexo = data.anexo;
    }

    const json = await siconfiGet<SiconfiResp>(path, params);
    const items = json.items ?? [];
    if (items.length === 0) {
      return { importados: 0, aviso: "Relatório não encontrado ou não publicado para este ente/período." };
    }

    const codIbge = String(data.codIbge);
    const esfera = esferaFromIbge(codIbge);

    const rows = items.map((it, idx) => {
      const key = [
        codIbge,
        data.exercicio,
        data.periodo ?? 0,
        data.tipoRelatorio,
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
        exercicio: Number(it.exercicio ?? data.exercicio),
        periodo: data.periodo ?? null,
        periodicidade: it.periodicidade ?? null,
        tipo_relatorio: data.tipoRelatorio,
        anexo: it.anexo ?? data.anexo ?? null,
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
    } catch {
      // ignora erros de QA
    }
    return { importados: rows.length };
  });