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

function legislaturaAtual(): number {
  return 52 + Math.floor((new Date().getFullYear() - 2003) / 4);
}
/** Foto oficial do Senado é determinística pelo código do parlamentar. */
function fotoSenador(cod: number, url: string | null): string {
  return url ?? `https://www.senado.leg.br/senadores/img/fotos-oficiais/senador${cod}.jpg`;
}

export type SenadorMembro = {
  id: number;
  nome: string;
  urlFoto: string;
  siglaPartido: string | null;
  siglaUf: string | null;
};
export type SenadoresPorLegislatura = {
  legAtual: number;
  atuais: SenadorMembro[];
  passadas: Array<{ legislatura: number; membros: SenadorMembro[] }>;
};

/**
 * Senadores separados entre a legislatura atual (em exercício) e as passadas
 * (da tabela de mandatos, com partido/UF de cada legislatura e foto pelo código).
 */
export const listarSenadoresPorLegislatura = createServerFn({ method: "GET" }).handler(
  async (): Promise<SenadoresPorLegislatura> => {
    const legAtual = legislaturaAtual();
    const [rosterRes, legRes] = await Promise.all([
      supabaseAdmin
        .from("senado_senadores_cache")
        .select("id,nome,sigla_partido,sigla_uf,url_foto,situacao")
        .limit(10000),
      supabaseAdmin
        .from("senado_senador_legislaturas")
        .select("codigo_parlamentar,legislatura,sigla_partido,sigla_uf")
        .limit(100000),
    ]);
    if (rosterRes.error) throw new Error(rosterRes.error.message);
    if (legRes.error) throw new Error(legRes.error.message);

    const idInfo = new Map<number, { nome: string; url_foto: string | null }>();
    for (const r of rosterRes.data ?? []) {
      idInfo.set(r.id as number, { nome: r.nome as string, url_foto: r.url_foto as string | null });
    }

    const atuais: SenadorMembro[] = (rosterRes.data ?? [])
      .filter((r) => (r.situacao as string | null) === "Exercício")
      .map((r) => ({
        id: r.id as number,
        nome: r.nome as string,
        urlFoto: fotoSenador(r.id as number, r.url_foto as string | null),
        siglaPartido: r.sigla_partido as string | null,
        siglaUf: r.sigla_uf as string | null,
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

    const porLeg = new Map<number, SenadorMembro[]>();
    for (const l of legRes.data ?? []) {
      const leg = l.legislatura as number;
      if (leg >= legAtual) continue;
      const cod = l.codigo_parlamentar as number;
      const info = idInfo.get(cod);
      if (!info) continue;
      if (!porLeg.has(leg)) porLeg.set(leg, []);
      porLeg.get(leg)!.push({
        id: cod,
        nome: info.nome,
        urlFoto: fotoSenador(cod, info.url_foto),
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

const UA_SENADO = "AuditoriaCidada/1.0 (+https://auditoria-cidada.lovable.app)";
const ROTULO_SERVICO: Record<string, string> = {
  ApartesParlamentar: "Apartes",
  CargoParlamentar: "Cargos",
  DiscursosParlamentar: "Discursos",
  FiliacaoParlamentar: "Filiações partidárias",
  HistoricoAcademicoParlamentar: "Histórico acadêmico",
  LicencaParlamentar: "Licenças",
  LiderancaParlamentar: "Lideranças",
  MandatoParlamentar: "Mandatos",
  MateriasAutoriaParlamentar: "Autorias de matérias",
  MateriasRelatoriaParlamentar: "Relatorias",
  MembroComissaoParlamentar: "Comissões",
  ProfissaoParlamentar: "Profissão",
  VotacaoParlamentar: "Votações",
};
type ServicoApi = { NomeServico?: string; UrlServico?: string };
type SenadorDetalheApi = {
  DetalheParlamentar?: {
    Parlamentar?: {
      IdentificacaoParlamentar?: {
        NomeCompletoParlamentar?: string;
        SexoParlamentar?: string;
        EmailParlamentar?: string;
        UrlPaginaParlamentar?: string;
        UrlPaginaParticular?: string;
      };
      OutrasInformacoes?: { Servico?: ServicoApi | ServicoApi[] };
    };
  };
};
export type PerfilSenador = {
  nomeCompleto: string | null;
  sexo: string | null;
  email: string | null;
  urlPagina: string | null;
  urlParticular: string | null;
  servicos: Array<{ nome: string; url: string }>;
};

/** Detalhe ao vivo do senador (best-effort): IdentificacaoParlamentar + serviços de dados abertos. */
async function buscarPerfilSenador(cod: number): Promise<PerfilSenador | null> {
  try {
    const res = await fetch(`https://legis.senado.leg.br/dadosabertos/senador/${cod}`, {
      headers: { accept: "application/json", "user-agent": UA_SENADO },
    });
    if (!res.ok) return null;
    const j = (await res.json()) as SenadorDetalheApi;
    const p = j.DetalheParlamentar?.Parlamentar ?? {};
    const ip = p.IdentificacaoParlamentar ?? {};
    const servRaw = p.OutrasInformacoes?.Servico;
    const servArr = Array.isArray(servRaw) ? servRaw : servRaw ? [servRaw] : [];
    return {
      nomeCompleto: ip.NomeCompletoParlamentar ?? null,
      sexo: ip.SexoParlamentar ?? null,
      email: ip.EmailParlamentar ?? null,
      urlPagina: ip.UrlPaginaParlamentar ?? null,
      urlParticular: ip.UrlPaginaParticular ?? null,
      servicos: servArr
        .map((sv) => ({ nome: ROTULO_SERVICO[sv.NomeServico ?? ""] ?? sv.NomeServico ?? "Serviço", url: sv.UrlServico ?? "" }))
        .filter((x) => x.url.startsWith("http")),
    };
  } catch {
    return null;
  }
}

type MandatoLegRef = { NumeroLegislatura?: string | number; DataInicio?: string; DataFim?: string };
type MandatoApiItem = {
  DescricaoParticipacao?: string;
  UfParlamentar?: string;
  PrimeiraLegislaturaDoMandato?: MandatoLegRef;
  SegundaLegislaturaDoMandato?: MandatoLegRef;
};
type MandatosApi = {
  MandatoParlamentar?: { Parlamentar?: { Mandatos?: { Mandato?: MandatoApiItem | MandatoApiItem[] } } };
};
export type MandatoSenador = {
  anoInicio: number | null;
  anoFim: number | null;
  legInicio: number | null;
  legFim: number | null;
  uf: string | null;
  participacao: string | null;
};

/**
 * Mandatos do senador (best-effort). Cada mandato dura 8 anos = 2 legislaturas
 * (PrimeiraLegislaturaDoMandato + SegundaLegislaturaDoMandato).
 */
async function buscarMandatosSenador(cod: number): Promise<MandatoSenador[]> {
  try {
    const res = await fetch(`https://legis.senado.leg.br/dadosabertos/senador/${cod}/mandatos`, {
      headers: { accept: "application/json", "user-agent": UA_SENADO },
    });
    if (!res.ok) return [];
    const j = (await res.json()) as MandatosApi;
    const raw = j.MandatoParlamentar?.Parlamentar?.Mandatos?.Mandato;
    const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
    const ano = (s?: string) => {
      const n = Number((s ?? "").slice(0, 4));
      return Number.isFinite(n) && n > 0 ? n : null;
    };
    const num = (v?: string | number) => (v != null && v !== "" ? Number(v) : null);
    return arr
      .map((m) => {
        const p = m.PrimeiraLegislaturaDoMandato;
        const s = m.SegundaLegislaturaDoMandato;
        return {
          anoInicio: ano(p?.DataInicio),
          anoFim: ano(s?.DataFim ?? p?.DataFim),
          legInicio: num(p?.NumeroLegislatura),
          legFim: num(s?.NumeroLegislatura) ?? num(p?.NumeroLegislatura),
          uf: m.UfParlamentar ?? null,
          participacao: m.DescricaoParticipacao ?? null,
        };
      })
      .sort((a, b) => (b.anoInicio ?? 0) - (a.anoInicio ?? 0));
  } catch {
    return [];
  }
}

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

    const [perfil, mandatos, legRes] = await Promise.all([
      buscarPerfilSenador(s.codigo_parlamentar as number),
      buscarMandatosSenador(s.codigo_parlamentar as number),
      supabaseAdmin
        .from("senado_senador_legislaturas")
        .select("legislatura,sigla_partido,sigla_uf,participacao")
        .eq("codigo_parlamentar", s.codigo_parlamentar as number)
        .order("legislatura", { ascending: false }),
    ]);
    const legislaturas = (legRes.data ?? []).map((m) => ({
      legislatura: m.legislatura as number,
      siglaPartido: m.sigla_partido as string | null,
      siglaUf: m.sigla_uf as string | null,
      participacao: m.participacao as string | null,
    }));

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
      perfil,
      mandatos,
      legislaturas,
      totalGeral,
      despesas,
      porTipo: [...porTipo.entries()].map(([tipo, total]) => ({ tipo, total })).sort((a, b) => b.total - a.total),
      porFornecedor: [...porFornecedor.values()].sort((a, b) => b.total - a.total).slice(0, 30),
      porMes: [...porMes.entries()].map(([mes, total]) => ({ mes, total })).sort((a, b) => a.mes.localeCompare(b.mes)),
    };
  });

export const senadoOverview = createServerFn({ method: "GET" }).handler(async () => {
  const legAtual = legislaturaAtual();
  const [{ count: nSens }, { count: nDesps }, totalRes, exercRes, pastRes] = await Promise.all([
    supabaseAdmin.from("senado_senadores_cache").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("senado_despesas_cache").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("senado_despesas_cache").select("valor_reembolsado").limit(100000),
    supabaseAdmin.from("senado_senadores_cache").select("id").eq("situacao", "Exercício").limit(10000),
    supabaseAdmin.from("senado_senador_legislaturas").select("codigo_parlamentar").lt("legislatura", legAtual).limit(100000),
  ]);
  const totalGasto = (totalRes.data ?? []).reduce((s, r) => s + Number(r.valor_reembolsado), 0);
  const atuaisIds = new Set((exercRes.data ?? []).map((r) => r.id as number));
  const pastIds = new Set((pastRes.data ?? []).map((r) => r.codigo_parlamentar as number));
  let historicos = 0;
  for (const cod of pastIds) if (!atuaisIds.has(cod)) historicos++;

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
    atuais: atuaisIds.size,
    historicos,
    totalDespesas: nDesps ?? 0,
    totalGasto,
    periodoInicio: span?.[0] ? `${span[0].ano}-${String(span[0].mes).padStart(2, "0")}` : null,
    periodoFim: spanEnd?.[0] ? `${spanEnd[0].ano}-${String(spanEnd[0].mes).padStart(2, "0")}` : null,
  };
});