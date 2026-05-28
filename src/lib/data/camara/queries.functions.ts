import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Deputado, DespesaCEAP } from "./types";

/** Lista todos os deputados em cache. Público (read-only). */
export const listarDeputados = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("camara_deputados_cache")
    .select("id,nome,sigla_partido,sigla_uf,id_legislatura,url_foto,email,situacao")
    .order("nome", { ascending: true })
    .limit(1000);
  if (error) throw new Error(error.message);
  const deputados: Deputado[] = (data ?? []).map((d) => ({
    id: d.id as number,
    nome: d.nome as string,
    siglaPartido: d.sigla_partido as string | null,
    siglaUf: d.sigla_uf as string | null,
    idLegislatura: d.id_legislatura as number | null,
    urlFoto: d.url_foto as string | null,
    email: d.email as string | null,
    situacao: d.situacao as string | null,
  }));
  return deputados;
});

/** Ranking de gastos CEAP por deputado, em todo o período em cache. */
export const rankingGastosDeputados = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("camara_despesas_cache")
    .select("deputado_id,valor_liquido")
    .limit(100000);
  if (error) throw new Error(error.message);
  const totais = new Map<number, number>();
  for (const r of data ?? []) {
    const id = r.deputado_id as number;
    totais.set(id, (totais.get(id) ?? 0) + Number(r.valor_liquido));
  }
  const { data: deps } = await supabaseAdmin
    .from("camara_deputados_cache")
    .select("id,nome,sigla_partido,sigla_uf,url_foto");
  const depMap = new Map((deps ?? []).map((d) => [d.id as number, d]));
  const rows = [...totais.entries()]
    .map(([id, total]) => {
      const d = depMap.get(id);
      return {
        id,
        nome: d?.nome ?? `Deputado ${id}`,
        siglaPartido: (d?.sigla_partido as string | null) ?? null,
        siglaUf: (d?.sigla_uf as string | null) ?? null,
        urlFoto: (d?.url_foto as string | null) ?? null,
        total,
      };
    })
    .sort((a, b) => b.total - a.total);
  return rows;
});

/** Detalhe de um deputado + agregados de suas despesas. */
export const getDeputadoDetalhe = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ id: z.number().int().positive() }).parse(input))
  .handler(async ({ data }) => {
    const { data: dep, error } = await supabaseAdmin
      .from("camara_deputados_cache")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!dep) return null;

    const { data: desps } = await supabaseAdmin
      .from("camara_despesas_cache")
      .select(
        "id,ano,mes,tipo_despesa,data_documento,valor_liquido,valor_documento,valor_glosa,fornecedor_nome,fornecedor_cnpj,url_documento",
      )
      .eq("deputado_id", data.id)
      .order("data_documento", { ascending: false })
      .limit(5000);

    const despesas: DespesaCEAP[] = (desps ?? []).map((r) => ({
      id: r.id as string,
      deputadoId: data.id,
      ano: r.ano as number,
      mes: r.mes as number,
      tipoDespesa: r.tipo_despesa as string,
      dataDocumento: r.data_documento as string | null,
      valorDocumento: Number(r.valor_documento),
      valorLiquido: Number(r.valor_liquido),
      valorGlosa: Number(r.valor_glosa),
      fornecedorNome: r.fornecedor_nome as string | null,
      fornecedorCnpj: r.fornecedor_cnpj as string | null,
      urlDocumento: r.url_documento as string | null,
    }));

    // Agregados
    const totalGeral = despesas.reduce((s, x) => s + x.valorLiquido, 0);
    const porTipo = new Map<string, number>();
    const porFornecedor = new Map<string, { nome: string; cnpj: string | null; total: number; count: number }>();
    const porMes = new Map<string, number>();
    for (const d of despesas) {
      porTipo.set(d.tipoDespesa, (porTipo.get(d.tipoDespesa) ?? 0) + d.valorLiquido);
      const key = d.fornecedorCnpj ?? d.fornecedorNome ?? "(sem fornecedor)";
      const cur = porFornecedor.get(key) ?? {
        nome: d.fornecedorNome ?? key,
        cnpj: d.fornecedorCnpj ?? null,
        total: 0,
        count: 0,
      };
      cur.total += d.valorLiquido;
      cur.count += 1;
      porFornecedor.set(key, cur);
      const mkey = `${d.ano}-${String(d.mes).padStart(2, "0")}`;
      porMes.set(mkey, (porMes.get(mkey) ?? 0) + d.valorLiquido);
    }

    return {
      deputado: {
        id: dep.id as number,
        nome: dep.nome as string,
        siglaPartido: dep.sigla_partido as string | null,
        siglaUf: dep.sigla_uf as string | null,
        idLegislatura: dep.id_legislatura as number | null,
        urlFoto: dep.url_foto as string | null,
        email: dep.email as string | null,
        situacao: dep.situacao as string | null,
      } satisfies Deputado,
      totalGeral,
      despesas,
      porTipo: [...porTipo.entries()].map(([tipo, total]) => ({ tipo, total })).sort((a, b) => b.total - a.total),
      porFornecedor: [...porFornecedor.values()].sort((a, b) => b.total - a.total).slice(0, 30),
      porMes: [...porMes.entries()].map(([mes, total]) => ({ mes, total })).sort((a, b) => a.mes.localeCompare(b.mes)),
    };
  });

/** Estatísticas gerais para a página de overview. */
export const camaraOverview = createServerFn({ method: "GET" }).handler(async () => {
  const [{ count: nDeps }, { count: nDesps }, totalRes] = await Promise.all([
    supabaseAdmin.from("camara_deputados_cache").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("camara_despesas_cache").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("camara_despesas_cache").select("valor_liquido").limit(100000),
  ]);
  const totalGasto = (totalRes.data ?? []).reduce((s, r) => s + Number(r.valor_liquido), 0);

  // Cobertura temporal
  const { data: span } = await supabaseAdmin
    .from("camara_despesas_cache")
    .select("ano,mes")
    .order("ano", { ascending: true })
    .limit(1);
  const { data: spanEnd } = await supabaseAdmin
    .from("camara_despesas_cache")
    .select("ano,mes")
    .order("ano", { ascending: false })
    .limit(1);

  return {
    totalDeputados: nDeps ?? 0,
    totalDespesas: nDesps ?? 0,
    totalGasto,
    periodoInicio: span?.[0] ? `${span[0].ano}-${String(span[0].mes).padStart(2, "0")}` : null,
    periodoFim: spanEnd?.[0] ? `${spanEnd[0].ano}-${String(spanEnd[0].mes).padStart(2, "0")}` : null,
  };
});