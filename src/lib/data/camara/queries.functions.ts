import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { selectAll } from "@/lib/data/select-all";
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
/** Membro num contexto de legislatura, com a situação (só populada na atual). */
export type DeputadoConsulta = DeputadoMembro & { legislatura: number; situacao: string | null };

export type LegislaturasInfo = {
  legAtual: number;
  /** Uma entrada por legislatura com dados, em ordem decrescente. */
  legislaturas: Array<{ legislatura: number; total: number }>;
  ufs: string[];
  partidos: string[];
  /** Situações distintas presentes no cadastro (para o filtro). */
  situacoes: string[];
};

/**
 * Índice barato para o modo navegação: contagem de membros por legislatura e os
 * domínios de UF/partido/situação para popular os filtros — sem trazer nenhum
 * membro. Público (read-only).
 */
export const listarLegislaturasCamara = createServerFn({ method: "GET" }).handler(
  async (): Promise<LegislaturasInfo> => {
    const legAtual = legislaturaAtual();
    const [leg, roster] = await Promise.all([
      selectAll(() =>
        supabaseAdmin.from("camara_deputado_legislaturas").select("id_legislatura,sigla_uf,sigla_partido"),
      ),
      selectAll(() => supabaseAdmin.from("camara_deputados_cache").select("situacao")),
    ]);
    const porLeg = new Map<number, number>();
    const ufs = new Set<string>();
    const partidos = new Set<string>();
    for (const r of leg) {
      const l = r.id_legislatura as number;
      porLeg.set(l, (porLeg.get(l) ?? 0) + 1);
      if (r.sigla_uf) ufs.add(r.sigla_uf as string);
      if (r.sigla_partido) partidos.add(r.sigla_partido as string);
    }
    const situacoes = new Set<string>();
    for (const r of roster) if (r.situacao) situacoes.add(r.situacao as string);
    return {
      legAtual,
      legislaturas: [...porLeg.entries()]
        .map(([legislatura, total]) => ({ legislatura, total }))
        .sort((a, b) => b.legislatura - a.legislatura),
      ufs: [...ufs].sort(),
      partidos: [...partidos].sort(),
      situacoes: [...situacoes].sort((a, b) => a.localeCompare(b, "pt-BR")),
    };
  },
);

const consultaDeputadosSchema = z.object({
  q: z.string().trim().max(120).optional(),
  uf: z.string().trim().max(2).optional(),
  partido: z.string().trim().max(20).optional(),
  situacao: z.string().trim().max(60).optional(),
  legislatura: z.number().int().min(1).max(200).optional(),
});

/**
 * Consulta de membros filtrada no servidor (modo resultado e carga por
 * legislatura no modo navegação). A filtragem por nome/UF/partido/situação roda
 * no banco/servidor, então a busca continua global mesmo com carregamento lazy;
 * o cliente só recebe os que casam. `legislatura` escopa a uma legislatura.
 * Situação só existe para a legislatura atual (status corrente do parlamentar).
 * Público (read-only).
 */
export const consultarMembrosCamara = createServerFn({ method: "GET" })
  .inputValidator((input) => consultaDeputadosSchema.parse(input ?? {}))
  .handler(async ({ data }): Promise<DeputadoConsulta[]> => {
    const legAtual = legislaturaAtual();
    const [roster, leg] = await Promise.all([
      selectAll(() => supabaseAdmin.from("camara_deputados_cache").select("id,nome,url_foto,situacao")),
      selectAll(() => {
        const base = supabaseAdmin
          .from("camara_deputado_legislaturas")
          .select("deputado_id,id_legislatura,sigla_partido,sigla_uf");
        return data.legislatura != null ? base.eq("id_legislatura", data.legislatura) : base;
      }),
    ]);
    const idInfo = new Map(roster.map((r) => [r.id as number, r]));
    const term = data.q?.toLowerCase() ?? "";

    const out: DeputadoConsulta[] = [];
    for (const l of leg) {
      const info = idInfo.get(l.deputado_id as number);
      if (!info) continue;
      const nome = info.nome as string;
      if (term && !nome.toLowerCase().includes(term)) continue;
      if (data.uf && l.sigla_uf !== data.uf) continue;
      if (data.partido && l.sigla_partido !== data.partido) continue;
      const legNum = l.id_legislatura as number;
      // Situação é o status corrente do parlamentar — só faz sentido na atual.
      const situacao = legNum === legAtual ? (info.situacao as string | null) : null;
      if (data.situacao && situacao !== data.situacao) continue;
      out.push({
        id: l.deputado_id as number,
        nome,
        urlFoto: fotoDeputado(l.deputado_id as number, info.url_foto as string | null),
        siglaPartido: l.sigla_partido as string | null,
        siglaUf: l.sigla_uf as string | null,
        legislatura: legNum,
        situacao,
      });
    }
    return out.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  },
);

/** Ranking de gastos CEAP por deputado, em todo o período em cache. */
export const rankingGastosDeputados = createServerFn({ method: "GET" }).handler(async () => {
  // A soma acontece no banco (view camara_gasto_por_deputado): varrer as despesas
  // cruas no app truncaria em 1000 lançamentos e transferiria centenas de milhares
  // de linhas. A view devolve ~1 linha por deputado — poucos milhares —, então
  // paginamos com selectAll só para ultrapassar o teto de 1000 do PostgREST.
  const [totais, deps] = await Promise.all([
    selectAll(() =>
      supabaseAdmin
        .from("camara_gasto_por_deputado")
        .select("deputado_id,total")
        .order("total", { ascending: false }),
    ),
    selectAll(() =>
      supabaseAdmin.from("camara_deputados_cache").select("id,nome,sigla_partido,sigla_uf,url_foto"),
    ),
  ]);
  const depMap = new Map(deps.map((d) => [d.id as number, d]));
  const rows = totais
    .map((r) => {
      const id = r.deputado_id as number;
      const d = depMap.get(id);
      return {
        id,
        nome: d?.nome ?? `Deputado ${id}`,
        siglaPartido: (d?.sigla_partido as string | null) ?? null,
        siglaUf: (d?.sigla_uf as string | null) ?? null,
        urlFoto: (d?.url_foto as string | null) ?? null,
        total: Number(r.total ?? 0),
      };
    })
    .sort((a, b) => b.total - a.total);
  return rows;
});

export type Movimentacao = {
  deputadoId: number;
  nome: string;
  dataHora: string | null;
  situacao: string | null;
  condicaoEleitoral: string | null;
  siglaUf: string | null;
  descricao: string | null;
};

/**
 * Movimentações de uma legislatura: quem saiu (renúncia, vacância, afastamento)
 * e quem entrou por suplência (posse de suplente, reassunção). Alimenta a visão
 * "Vacâncias e substituições" a partir dos eventos de /historico. Público.
 */
export const movimentacoesLegislaturaCamara = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ legislatura: z.number().int().min(1).max(200) }).parse(input))
  .handler(async ({ data }): Promise<Movimentacao[]> => {
    const eventos = await selectAll(() =>
      supabaseAdmin
        .from("camara_deputado_eventos")
        .select("deputado_id,data_hora,situacao,condicao_eleitoral,sigla_uf,descricao")
        .eq("id_legislatura", data.legislatura)
        .or("descricao.ilike.%Saída%,descricao.ilike.%Posse de Suplente%,descricao.ilike.%Reassunção%"),
    );
    const ids = [...new Set(eventos.map((e) => e.deputado_id as number))];
    const roster = ids.length
      ? await selectAll(() => supabaseAdmin.from("camara_deputados_cache").select("id,nome").in("id", ids))
      : [];
    const nome = new Map(roster.map((r) => [r.id as number, r.nome as string]));
    return eventos
      .map((e) => ({
        deputadoId: e.deputado_id as number,
        nome: nome.get(e.deputado_id as number) ?? `Deputado ${e.deputado_id}`,
        dataHora: e.data_hora as string | null,
        situacao: e.situacao as string | null,
        condicaoEleitoral: e.condicao_eleitoral as string | null,
        siglaUf: e.sigla_uf as string | null,
        descricao: e.descricao as string | null,
      }))
      .sort((a, b) => (b.dataHora ?? "").localeCompare(a.dataHora ?? ""));
  });

/** Detalhe de um deputado + agregados de suas despesas. */
const UA_CAMARA = "MutiraoDeDados/1.0 (+https://mutiraodedados.com.br)";
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

    const [perfil, mandRes, eventosRes] = await Promise.all([
      buscarPerfilDeputado(data.id),
      supabaseAdmin
        .from("camara_deputado_legislaturas")
        .select("id_legislatura,sigla_partido,sigla_uf,situacao")
        .eq("deputado_id", data.id)
        .order("id_legislatura", { ascending: false }),
      supabaseAdmin
        .from("camara_deputado_eventos")
        .select("id_legislatura,data_hora,situacao,condicao_eleitoral,sigla_partido,sigla_uf,descricao")
        .eq("deputado_id", data.id)
        .order("data_hora", { ascending: false })
        .limit(500),
    ]);
    const mandatos = (mandRes.data ?? []).map((m) => ({
      legislatura: m.id_legislatura as number,
      siglaPartido: m.sigla_partido as string | null,
      siglaUf: m.sigla_uf as string | null,
      situacao: m.situacao as string | null,
    }));
    // Trajetória: entradas/saídas do mandato (posse, licença, afastamento,
    // vacância, reassunção), da mais recente para a mais antiga.
    const eventos = (eventosRes.data ?? []).map((e) => ({
      legislatura: e.id_legislatura as number | null,
      dataHora: e.data_hora as string | null,
      situacao: e.situacao as string | null,
      condicaoEleitoral: e.condicao_eleitoral as string | null,
      siglaPartido: e.sigla_partido as string | null,
      siglaUf: e.sigla_uf as string | null,
      descricao: e.descricao as string | null,
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
      eventos,
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
  // exercício (~647) e mandatos passados (~3,8 mil) precisam de varredura completa:
  // com o teto de 1000, `historicos` e a contagem de atuais ficavam subestimados.
  const [{ count: nDeps }, { count: nDesps }, totalRes, exercData, pastData] = await Promise.all([
    supabaseAdmin.from("camara_deputados_cache").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("camara_despesas_cache").select("id", { count: "exact", head: true }),
    // Soma no banco: `.limit(100000)` sobre as despesas cruas truncava em 1000.
    supabaseAdmin.rpc("camara_gasto_total"),
    selectAll(() => supabaseAdmin.from("camara_deputados_cache").select("id").eq("situacao", "Exercício")),
    selectAll(() => supabaseAdmin.from("camara_deputado_legislaturas").select("deputado_id").lt("id_legislatura", legAtual)),
  ]);
  const totalGasto = Number(totalRes.data ?? 0);
  const atuaisIds = new Set(exercData.map((r) => r.id as number));
  const pastIds = new Set(pastData.map((r) => r.deputado_id as number));
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