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

/** Legislatura corrente (52 = 2003–2007, +1 a cada 4 anos). */
function legislaturaAtual(): number {
  return 52 + Math.floor((new Date().getFullYear() - 2003) / 4);
}
/** Foto oficial da Câmara é determinística pelo id do deputado. */
function fotoDeputado(id: number, url: string | null): string {
  return url ?? `https://www.camara.leg.br/internet/deputado/bandep/${id}.jpg`;
}

export type DeputadoMembro = {
  id: number;
  nome: string;
  urlFoto: string;
  siglaPartido: string | null;
  siglaUf: string | null;
};
export type DeputadosPorLegislatura = {
  legAtual: number;
  atuais: DeputadoMembro[];
  passadas: Array<{ legislatura: number; membros: DeputadoMembro[] }>;
};

/**
 * Deputados separados entre a legislatura atual (em exercício, dados completos)
 * e as legislaturas passadas (da tabela de mandatos, com partido/UF de cada
 * legislatura e foto reconstruída pelo id). Público (read-only).
 */
export const listarDeputadosPorLegislatura = createServerFn({ method: "GET" }).handler(
  async (): Promise<DeputadosPorLegislatura> => {
    const legAtual = legislaturaAtual();
    const [rosterRes, legRes] = await Promise.all([
      supabaseAdmin
        .from("camara_deputados_cache")
        .select("id,nome,sigla_partido,sigla_uf,url_foto,situacao")
        .limit(10000),
      supabaseAdmin
        .from("camara_deputado_legislaturas")
        .select("deputado_id,id_legislatura,sigla_partido,sigla_uf")
        .limit(100000),
    ]);
    if (rosterRes.error) throw new Error(rosterRes.error.message);
    if (legRes.error) throw new Error(legRes.error.message);

    const idInfo = new Map<number, { nome: string; url_foto: string | null }>();
    for (const r of rosterRes.data ?? []) {
      idInfo.set(r.id as number, { nome: r.nome as string, url_foto: r.url_foto as string | null });
    }

    const atuais: DeputadoMembro[] = (rosterRes.data ?? [])
      .filter((r) => (r.situacao as string | null) === "Exercício")
      .map((r) => ({
        id: r.id as number,
        nome: r.nome as string,
        urlFoto: fotoDeputado(r.id as number, r.url_foto as string | null),
        siglaPartido: r.sigla_partido as string | null,
        siglaUf: r.sigla_uf as string | null,
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

    const porLeg = new Map<number, DeputadoMembro[]>();
    for (const l of legRes.data ?? []) {
      const leg = l.id_legislatura as number;
      if (leg >= legAtual) continue; // a atual vai na seção própria
      const info = idInfo.get(l.deputado_id as number);
      if (!info) continue;
      if (!porLeg.has(leg)) porLeg.set(leg, []);
      porLeg.get(leg)!.push({
        id: l.deputado_id as number,
        nome: info.nome,
        urlFoto: fotoDeputado(l.deputado_id as number, info.url_foto),
        siglaPartido: l.sigla_partido as string | null,
        siglaUf: l.sigla_uf as string | null,
      });
    }
    const passadas = [...porLeg.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([legislatura, membros]) => ({
        legislatura,
        membros: membros.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
      }));

    return { legAtual, atuais, passadas };
  },
);

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
const UA_CAMARA = "AuditoriaCidada/1.0 (+https://auditoria-cidada.lovable.app)";
type DeputadoDetalheApi = {
  dados?: {
    nomeCivil?: string;
    sexo?: string;
    escolaridade?: string;
    dataNascimento?: string;
    municipioNascimento?: string;
    ufNascimento?: string;
    urlWebsite?: string;
    redeSocial?: string[];
    ultimoStatus?: {
      email?: string;
      gabinete?: { email?: string; telefone?: string; sala?: string; predio?: string };
    };
  };
};
export type PerfilDeputado = {
  nomeCivil: string | null;
  sexo: string | null;
  escolaridade: string | null;
  dataNascimento: string | null;
  naturalidade: string | null;
  urlWebsite: string | null;
  redeSocial: string[];
  gabineteEmail: string | null;
  gabineteTelefone: string | null;
  urlPerfil: string;
};

/** Detalhe ao vivo do deputado (best-effort): perfil + links oficiais. CPF omitido (PII). */
async function buscarPerfilDeputado(id: number): Promise<PerfilDeputado | null> {
  try {
    const res = await fetch(`https://dadosabertos.camara.leg.br/api/v2/deputados/${id}`, {
      headers: { accept: "application/json", "user-agent": UA_CAMARA },
    });
    if (!res.ok) return null;
    const j = (await res.json()) as DeputadoDetalheApi;
    const d = j.dados ?? {};
    const g = d.ultimoStatus?.gabinete ?? {};
    const naturalidade = [d.municipioNascimento, d.ufNascimento].filter(Boolean).join("/") || null;
    return {
      nomeCivil: d.nomeCivil ?? null,
      sexo: d.sexo ?? null,
      escolaridade: d.escolaridade ?? null,
      dataNascimento: d.dataNascimento ?? null,
      naturalidade,
      urlWebsite: d.urlWebsite ?? null,
      redeSocial: Array.isArray(d.redeSocial) ? d.redeSocial.filter((u) => typeof u === "string") : [],
      gabineteEmail: g.email ?? d.ultimoStatus?.email ?? null,
      gabineteTelefone: g.telefone ?? null,
      urlPerfil: `https://www.camara.leg.br/deputados/${id}`,
    };
  } catch {
    return null;
  }
}

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

    const [perfil, mandRes] = await Promise.all([
      buscarPerfilDeputado(data.id),
      supabaseAdmin
        .from("camara_deputado_legislaturas")
        .select("id_legislatura,sigla_partido,sigla_uf,situacao")
        .eq("deputado_id", data.id)
        .order("id_legislatura", { ascending: false }),
    ]);
    const mandatos = (mandRes.data ?? []).map((m) => ({
      legislatura: m.id_legislatura as number,
      siglaPartido: m.sigla_partido as string | null,
      siglaUf: m.sigla_uf as string | null,
      situacao: m.situacao as string | null,
    }));

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
      perfil,
      mandatos,
      totalGeral,
      despesas,
      porTipo: [...porTipo.entries()].map(([tipo, total]) => ({ tipo, total })).sort((a, b) => b.total - a.total),
      porFornecedor: [...porFornecedor.values()].sort((a, b) => b.total - a.total).slice(0, 30),
      porMes: [...porMes.entries()].map(([mes, total]) => ({ mes, total })).sort((a, b) => a.mes.localeCompare(b.mes)),
    };
  });

/** Estatísticas gerais para a página de overview. */
export const camaraOverview = createServerFn({ method: "GET" }).handler(async () => {
  const legAtual = legislaturaAtual();
  const [{ count: nDeps }, { count: nDesps }, totalRes, exercRes, pastRes] = await Promise.all([
    supabaseAdmin.from("camara_deputados_cache").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("camara_despesas_cache").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("camara_despesas_cache").select("valor_liquido").limit(100000),
    supabaseAdmin.from("camara_deputados_cache").select("id").eq("situacao", "Exercício").limit(10000),
    supabaseAdmin.from("camara_deputado_legislaturas").select("deputado_id").lt("id_legislatura", legAtual).limit(100000),
  ]);
  const totalGasto = (totalRes.data ?? []).reduce((s, r) => s + Number(r.valor_liquido), 0);
  const atuaisIds = new Set((exercRes.data ?? []).map((r) => r.id as number));
  const pastIds = new Set((pastRes.data ?? []).map((r) => r.deputado_id as number));
  let historicos = 0;
  for (const id of pastIds) if (!atuaisIds.has(id)) historicos++;

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
    atuais: atuaisIds.size,
    historicos,
    totalDespesas: nDesps ?? 0,
    totalGasto,
    periodoInicio: span?.[0] ? `${span[0].ano}-${String(span[0].mes).padStart(2, "0")}` : null,
    periodoFim: spanEnd?.[0] ? `${spanEnd[0].ano}-${String(spanEnd[0].mes).padStart(2, "0")}` : null,
  };
});