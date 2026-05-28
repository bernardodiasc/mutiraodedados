import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sanitizarTextoPublico } from "@/lib/sanitize";
import { regrasSenadoCeaps, flagQA } from "@/lib/data/qa";

const BASE = "https://legis.senado.leg.br/dadosabertos";
const UA = "AuditoriaCidada/1.0 (+https://auditoria-cidada.lovable.app)";

async function senadoGet<T = unknown>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { accept: "application/json", "user-agent": UA },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Senado API ${res.status}: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

/** Garante que o caller é admin. */
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

/** Normaliza arrays "Senado-style": campos podem ser objeto único ou array. */
function asArray<T>(v: T | T[] | null | undefined): T[] {
  if (v === null || v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

function toNum(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  const s = String(v).replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

type Parlamentar = {
  IdentificacaoParlamentar?: {
    CodigoParlamentar?: string | number;
    NomeParlamentar?: string;
    NomeCompletoParlamentar?: string;
    SiglaPartidoParlamentar?: string;
    UfParlamentar?: string;
    UrlFotoParlamentar?: string;
    EmailParlamentar?: string;
  };
};

/** Importa os 81 senadores em exercício. */
export const importarSenadores = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({}).parse(input ?? {}))
  .handler(async ({ context }) => {
    await ensureAdmin(context.userId);

    const json = await senadoGet<{
      ListaParlamentarEmExercicio?: {
        Parlamentares?: { Parlamentar?: Parlamentar | Parlamentar[] };
      };
    }>("/senador/lista/atual");

    const arr = asArray(json.ListaParlamentarEmExercicio?.Parlamentares?.Parlamentar);
    if (arr.length === 0) throw new Error("Senado retornou lista vazia.");

    const rows = arr
      .map((p) => {
        const i = p.IdentificacaoParlamentar ?? {};
        const id = Number(i.CodigoParlamentar);
        if (!Number.isFinite(id) || id <= 0) return null;
        return {
          id,
          codigo_parlamentar: id,
          nome: i.NomeParlamentar ?? `Senador ${id}`,
          nome_completo: i.NomeCompletoParlamentar ?? null,
          sigla_partido: i.SiglaPartidoParlamentar ?? null,
          sigla_uf: i.UfParlamentar ?? null,
          url_foto: i.UrlFotoParlamentar ?? null,
          email: i.EmailParlamentar ?? null,
          situacao: "Exercício",
          updated_at: new Date().toISOString(),
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    for (let i = 0; i < rows.length; i += 100) {
      const { error } = await supabaseAdmin
        .from("senado_senadores_cache")
        .upsert(rows.slice(i, i + 100));
      if (error) throw new Error(`db: ${error.message}`);
    }
    return { importados: rows.length };
  });

type DespesaRaw = {
  Ano?: string | number;
  Mes?: string | number;
  TipoDespesa?: string;
  CnpjCpfFornecedor?: string;
  Fornecedor?: string;
  Documento?: string;
  DataDocumento?: string;
  ValorReembolsado?: string | number;
  Detalhamento?: string;
  CodigoDocumento?: string | number;
};

/**
 * Importa CEAPS (cota dos senadores) de um ano/mês para TODOS os senadores em cache.
 * Endpoint: /senador/{cod}/despesas/{ano} (filtra mês client-side).
 */
export const importarCEAPSMes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        ano: z.number().int().min(2008).max(2100),
        mes: z.number().int().min(1).max(12),
        senadorId: z.number().int().positive().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);

    let senadorIds: number[] = [];
    if (data.senadorId) {
      senadorIds = [data.senadorId];
    } else {
      const { data: sens, error } = await supabaseAdmin
        .from("senado_senadores_cache")
        .select("id");
      if (error) throw new Error(`db: ${error.message}`);
      senadorIds = (sens ?? []).map((s) => s.id as number);
    }
    if (senadorIds.length === 0) {
      throw new Error("Nenhum senador em cache. Importe o cadastro primeiro.");
    }

    let totalImportados = 0;
    const erros: string[] = [];

    for (const senId of senadorIds) {
      try {
        const json = await senadoGet<{
          DespesasParlamentares?: {
            Senador?: {
              Despesas?: { Despesa?: DespesaRaw | DespesaRaw[] };
            };
          };
        }>(`/senador/${senId}/despesas/${data.ano}`);

        const lista = asArray(json.DespesasParlamentares?.Senador?.Despesas?.Despesa);
        const doMes = lista.filter((d) => Number(d.Mes) === data.mes);
        if (doMes.length === 0) continue;

        const rows = doMes.map((d, idx) => {
          const cod = d.CodigoDocumento ?? d.Documento ?? `${idx}`;
          return {
            id: `${senId}-${data.ano}-${data.mes}-${cod}`,
            senador_id: senId,
            ano: Number(d.Ano ?? data.ano),
            mes: Number(d.Mes ?? data.mes),
            tipo_despesa: sanitizarTextoPublico((d.TipoDespesa ?? "").slice(0, 200)) || "(sem tipo)",
            fornecedor_nome: sanitizarTextoPublico((d.Fornecedor ?? "").slice(0, 240)) || null,
            fornecedor_cnpj: d.CnpjCpfFornecedor ?? null,
            data_documento:
              d.DataDocumento && /^\d{4}-\d{2}-\d{2}/.test(d.DataDocumento)
                ? d.DataDocumento.slice(0, 10)
                : null,
            num_documento: d.Documento ?? null,
            valor_reembolsado: toNum(d.ValorReembolsado),
            detalhamento: sanitizarTextoPublico((d.Detalhamento ?? "").slice(0, 500)) || null,
            updated_at: new Date().toISOString(),
          };
        });

        for (let i = 0; i < rows.length; i += 200) {
          const { error } = await supabaseAdmin
            .from("senado_despesas_cache")
            .upsert(rows.slice(i, i + 200));
          if (error) throw new Error(error.message);
        }
        totalImportados += rows.length;
        try {
          await flagQA(
            regrasSenadoCeaps(
              rows.map((r) => ({
                id: r.id,
                valor_reembolsado: r.valor_reembolsado,
                senador_id: r.senador_id,
              })),
            ),
          );
        } catch {
          // ignora erros de QA
        }
      } catch (e) {
        erros.push(`sen ${senId}: ${(e as Error).message}`);
      }
    }

    return { importados: totalImportados, senadoresProcessados: senadorIds.length, erros };
  });