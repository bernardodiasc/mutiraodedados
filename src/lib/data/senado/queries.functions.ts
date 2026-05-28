import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Senador, DespesaCEAPS } from "./types";

export const listarSenadores = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("senado_senadores_cache")
    .select("id,nome,nome_completo,sigla_partido,sigla_uf,url_foto,email,situacao,codigo_parlamentar")
    .order("nome", { ascending: true })
    .limit(200);
  if (error) throw new Error(error.message);
  const out: Senador[] = (data ?? []).map((s) => ({
    id: s.id as number,
    codigoParlamentar: s.codigo_parlamentar as number,
    nome: s.nome as string,
    nomeCompleto: s.nome_completo as string | null,
    siglaPartido: s.sigla_partido as string | null,
    siglaUf: s.sigla_uf as string | null,
    urlFoto: s.url_foto as string | null,
    email: s.email as string | null,
    situacao: s.situacao as string | null,
  }));
  return out;
});

export const rankingGastosSenadores = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("senado_despesas_cache")
    .select("senador_id,valor_reembolsado")
    .limit(100000);
  if (error) throw new Error(error.message);
  const totais = new Map<number, number>();
  for (const r of data ?? []) {
    const id = r.senador_id as number;
    totais.set(id, (totais.get(id) ?? 0) + Number(r.valor_reembolsado));
  }
  const { data: sens } = await supabaseAdmin
    .from("senado_senadores_cache")
    .select("id,nome,sigla_partido,sigla_uf,url_foto");
  const senMap = new Map((sens ?? []).map((d) => [d.id as number, d]));
  return [...totais.entries()]
    .map(([id, total]) => {
      const s = senMap.get(id);
      return {
        id,
        nome: s?.nome ?? `Senador ${id}`,
        siglaPartido: (s?.sigla_partido as string | null) ?? null,
        siglaUf: (s?.sigla_uf as string | null) ?? null,
        urlFoto: (s?.url_foto as string | null) ?? null,
        total,
      };
    })
    .sort((a, b) => b.total - a.total);
});

export const getSenadorDetalhe = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ id: z.number().int().positive() }).parse(input))
  .handler(async ({ data }) => {
    const { data: s, error } = await supabaseAdmin
      .from("senado_senadores_cache")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!s) return null;

    const { data: desps } = await supabaseAdmin
      .from("senado_despesas_cache")
      .select("id,ano,mes,tipo_despesa,data_documento,valor_reembolsado,fornecedor_nome,fornecedor_cnpj,num_documento,detalhamento")
      .eq("senador_id", data.id)
      .order("data_documento", { ascending: false })
      .limit(5000);

    const despesas: DespesaCEAPS[] = (desps ?? []).map((r) => ({
      id: r.id as string,
      senadorId: data.id,
      ano: r.ano as number,
      mes: r.mes as number,
      tipoDespesa: (r.tipo_despesa as string | null) ?? null,
      dataDocumento: r.data_documento as string | null,
      valorReembolsado: Number(r.valor_reembolsado),
      fornecedorNome: r.fornecedor_nome as string | null,
      fornecedorCnpj: r.fornecedor_cnpj as string | null,
      numDocumento: r.num_documento as string | null,
      detalhamento: r.detalhamento as string | null,
    }));

    const totalGeral = despesas.reduce((s, x) => s + x.valorReembolsado, 0);
    const porTipo = new Map<string, number>();
    const porFornecedor = new Map<string, { nome: string; cnpj: string | null; total: number; count: number }>();
    const porMes = new Map<string, number>();
    for (const d of despesas) {
      const tipo = d.tipoDespesa ?? "(sem tipo)";
      porTipo.set(tipo, (porTipo.get(tipo) ?? 0) + d.valorReembolsado);
      const key = d.fornecedorCnpj ?? d.fornecedorNome ?? "(sem fornecedor)";
      const cur = porFornecedor.get(key) ?? {
        nome: d.fornecedorNome ?? key,
        cnpj: d.fornecedorCnpj ?? null,
        total: 0,
        count: 0,
      };
      cur.total += d.valorReembolsado;
      cur.count += 1;
      porFornecedor.set(key, cur);
      const mk = `${d.ano}-${String(d.mes).padStart(2, "0")}`;
      porMes.set(mk, (porMes.get(mk) ?? 0) + d.valorReembolsado);
    }

    return {
      senador: {
        id: s.id as number,
        codigoParlamentar: s.codigo_parlamentar as number,
        nome: s.nome as string,
        nomeCompleto: s.nome_completo as string | null,
        siglaPartido: s.sigla_partido as string | null,
        siglaUf: s.sigla_uf as string | null,
        urlFoto: s.url_foto as string | null,
        email: s.email as string | null,
        situacao: s.situacao as string | null,
      } satisfies Senador,
      totalGeral,
      despesas,
      porTipo: [...porTipo.entries()].map(([tipo, total]) => ({ tipo, total })).sort((a, b) => b.total - a.total),
      porFornecedor: [...porFornecedor.values()].sort((a, b) => b.total - a.total).slice(0, 30),
      porMes: [...porMes.entries()].map(([mes, total]) => ({ mes, total })).sort((a, b) => a.mes.localeCompare(b.mes)),
    };
  });

export const senadoOverview = createServerFn({ method: "GET" }).handler(async () => {
  const [{ count: nSens }, { count: nDesps }, totalRes] = await Promise.all([
    supabaseAdmin.from("senado_senadores_cache").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("senado_despesas_cache").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("senado_despesas_cache").select("valor_reembolsado").limit(100000),
  ]);
  const totalGasto = (totalRes.data ?? []).reduce((s, r) => s + Number(r.valor_reembolsado), 0);

  const { data: span } = await supabaseAdmin
    .from("senado_despesas_cache")
    .select("ano,mes")
    .order("ano", { ascending: true })
    .limit(1);
  const { data: spanEnd } = await supabaseAdmin
    .from("senado_despesas_cache")
    .select("ano,mes")
    .order("ano", { ascending: false })
    .limit(1);

  return {
    totalSenadores: nSens ?? 0,
    totalDespesas: nDesps ?? 0,
    totalGasto,
    periodoInicio: span?.[0] ? `${span[0].ano}-${String(span[0].mes).padStart(2, "0")}` : null,
    periodoFim: spanEnd?.[0] ? `${spanEnd[0].ano}-${String(spanEnd[0].mes).padStart(2, "0")}` : null,
  };
});