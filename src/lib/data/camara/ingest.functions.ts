import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sanitizarTextoPublico } from "@/lib/sanitize";
import { regrasCamaraCeap, flagQA } from "@/lib/data/qa";

const BASE = "https://dadosabertos.camara.leg.br/api/v2";
const UA = "AuditoriaCidada/1.0 (+https://auditoria-cidada.lovable.app)";

async function camaraGet<T = unknown>(path: string, params: Record<string, string> = {}): Promise<T> {
  const qs = new URLSearchParams(params).toString();
  const url = `${BASE}${path}${qs ? `?${qs}` : ""}`;
  const res = await fetch(url, {
    headers: { accept: "application/json", "user-agent": UA },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Câmara API ${res.status}: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

type CamaraEnvelope<T> = { dados: T; links?: Array<{ rel: string; href: string }> };

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

/** Importa o cadastro completo de deputados da legislatura indicada (padrão: atual). */
export const importarDeputados = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        idLegislatura: z.number().int().min(50).max(100).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);

    type DepListItem = {
      id: number;
      nome: string;
      siglaPartido?: string;
      siglaUf?: string;
      idLegislatura?: number;
      urlFoto?: string;
      email?: string;
    };

    const params: Record<string, string> = { itens: "100", ordem: "ASC", ordenarPor: "nome" };
    if (data.idLegislatura) params.idLegislatura = String(data.idLegislatura);

    const all: DepListItem[] = [];
    let pagina = 1;
    while (pagina < 20) {
      const json = await camaraGet<CamaraEnvelope<DepListItem[]>>("/deputados", {
        ...params,
        pagina: String(pagina),
      });
      const list = json.dados ?? [];
      if (list.length === 0) break;
      all.push(...list);
      if (list.length < 100) break;
      pagina++;
    }

    if (all.length === 0) return { importados: 0 };

    const rows = all.map((d) => ({
      id: d.id,
      nome: d.nome,
      nome_civil: null,
      sigla_partido: d.siglaPartido ?? null,
      sigla_uf: d.siglaUf ?? null,
      id_legislatura: d.idLegislatura ?? null,
      url_foto: d.urlFoto ?? null,
      email: d.email ?? null,
      situacao: "Exercício",
      condicao_eleitoral: null,
      updated_at: new Date().toISOString(),
    }));

    for (let i = 0; i < rows.length; i += 200) {
      const { error } = await supabaseAdmin
        .from("camara_deputados_cache")
        .upsert(rows.slice(i, i + 200));
      if (error) throw new Error(`db: ${error.message}`);
    }
    return { importados: rows.length };
  });

/** Importa despesas CEAP de um mês/ano para TODOS os deputados em cache. */
export const importarCEAPMes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        ano: z.number().int().min(2009).max(2100),
        mes: z.number().int().min(1).max(12),
        deputadoId: z.number().int().positive().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);

    type DespesaRaw = {
      ano?: number;
      mes?: number;
      tipoDespesa?: string;
      codDocumento?: number;
      tipoDocumento?: string;
      numDocumento?: string;
      dataDocumento?: string;
      valorDocumento?: number;
      valorLiquido?: number;
      valorGlosa?: number;
      nomeFornecedor?: string;
      cnpjCpfFornecedor?: string;
      urlDocumento?: string;
    };

    // Decide quais deputados processar
    let deputadoIds: number[] = [];
    if (data.deputadoId) {
      deputadoIds = [data.deputadoId];
    } else {
      const { data: deps, error } = await supabaseAdmin
        .from("camara_deputados_cache")
        .select("id");
      if (error) throw new Error(`db: ${error.message}`);
      deputadoIds = (deps ?? []).map((d) => d.id as number);
    }

    if (deputadoIds.length === 0) {
      throw new Error("Nenhum deputado em cache. Importe o cadastro primeiro.");
    }

    let totalImportados = 0;
    const erros: string[] = [];

    for (const depId of deputadoIds) {
      try {
        const lista: DespesaRaw[] = [];
        let pagina = 1;
        while (pagina < 30) {
          const json = await camaraGet<CamaraEnvelope<DespesaRaw[]>>(
            `/deputados/${depId}/despesas`,
            {
              ano: String(data.ano),
              mes: String(data.mes),
              itens: "100",
              pagina: String(pagina),
              ordem: "ASC",
              ordenarPor: "dataDocumento",
            },
          );
          const arr = json.dados ?? [];
          if (arr.length === 0) break;
          lista.push(...arr);
          if (arr.length < 100) break;
          pagina++;
        }
        if (lista.length === 0) continue;

        const rows = lista.map((d, idx) => {
          const cod = d.codDocumento ?? null;
          const id = cod ? `${depId}-${cod}` : `${depId}-${data.ano}-${data.mes}-${idx}`;
          return {
            id,
            deputado_id: depId,
            ano: d.ano ?? data.ano,
            mes: d.mes ?? data.mes,
            tipo_despesa: sanitizarTextoPublico((d.tipoDespesa ?? "").slice(0, 200)) || "(sem tipo)",
            cod_documento: cod,
            tipo_documento: d.tipoDocumento ?? null,
            num_documento: d.numDocumento ?? null,
            data_documento: d.dataDocumento && /^\d{4}-\d{2}-\d{2}/.test(d.dataDocumento)
              ? d.dataDocumento.slice(0, 10)
              : null,
            valor_documento: Number(d.valorDocumento ?? 0),
            valor_liquido: Number(d.valorLiquido ?? 0),
            valor_glosa: Number(d.valorGlosa ?? 0),
            fornecedor_nome: sanitizarTextoPublico((d.nomeFornecedor ?? "").slice(0, 240)) || null,
            fornecedor_cnpj: d.cnpjCpfFornecedor ?? null,
            url_documento: d.urlDocumento ?? null,
            updated_at: new Date().toISOString(),
          };
        });

        for (let i = 0; i < rows.length; i += 200) {
          const { error } = await supabaseAdmin
            .from("camara_despesas_cache")
            .upsert(rows.slice(i, i + 200));
          if (error) throw new Error(error.message);
        }
        totalImportados += rows.length;
        try {
          await flagQA(
            regrasCamaraCeap(
              rows.map((r) => ({
                id: r.id,
                valor_liquido: r.valor_liquido,
                valor_documento: r.valor_documento,
                deputado_id: r.deputado_id,
              })),
            ),
          );
        } catch {
          // ignora erros de QA
        }
      } catch (e) {
        erros.push(`dep ${depId}: ${(e as Error).message}`);
      }
    }

    return { importados: totalImportados, deputadosProcessados: deputadoIds.length, erros };
  });