import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { selectAll } from "@/lib/data/select-all";
import type { Senador, DespesaCEAPS } from "./types";

export const listarSenadores = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("senado_senadores_cache")
    .select(
      "id,nome,nome_completo,sigla_partido,sigla_uf,url_foto,email,situacao,codigo_parlamentar",
    )
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
/** Membro num contexto de legislatura: situação (atual) + participação (titular/suplente). */
export type SenadorConsulta = SenadorMembro & {
  legislatura: number;
  situacao: string | null;
  participacao: string | null;
};

export type LegislaturasInfoSenado = {
  legAtual: number;
  legislaturas: Array<{ legislatura: number; total: number }>;
  ufs: string[];
  partidos: string[];
  situacoes: string[];
  /** Titular, 1º Suplente, 2º Suplente — presente em todas as legislaturas. */
  participacoes: string[];
};

/**
 * Índice barato para o modo navegação: contagem por legislatura + domínios dos
 * filtros (UF, partido, situação, participação), sem trazer membros. Público.
 */
export const listarLegislaturasSenado = createServerFn({ method: "GET" }).handler(
  async (): Promise<LegislaturasInfoSenado> => {
    const legAtual = legislaturaAtual();
    const [leg, roster] = await Promise.all([
      selectAll(() =>
        supabaseAdmin
          .from("senado_senador_legislaturas")
          .select("legislatura,sigla_uf,sigla_partido,participacao"),
      ),
      selectAll(() => supabaseAdmin.from("senado_senadores_cache").select("situacao")),
    ]);
    const porLeg = new Map<number, number>();
    const ufs = new Set<string>();
    const partidos = new Set<string>();
    const participacoes = new Set<string>();
    for (const r of leg) {
      const l = r.legislatura as number;
      porLeg.set(l, (porLeg.get(l) ?? 0) + 1);
      if (r.sigla_uf) ufs.add(r.sigla_uf as string);
      if (r.sigla_partido) partidos.add(r.sigla_partido as string);
      if (r.participacao) participacoes.add(r.participacao as string);
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
      participacoes: [...participacoes].sort((a, b) => a.localeCompare(b, "pt-BR")),
    };
  },
);

const consultaSenadoresSchema = z.object({
  q: z.string().trim().max(120).optional(),
  uf: z.string().trim().max(2).optional(),
  partido: z.string().trim().max(20).optional(),
  situacao: z.string().trim().max(60).optional(),
  participacao: z.string().trim().max(40).optional(),
  legislatura: z.number().int().min(1).max(200).optional(),
});

/**
 * Consulta de senadores filtrada no servidor (busca global mesmo lazy). Filtra
 * por nome/UF/partido/situação/participação; `legislatura` escopa a uma. Situação
 * é o status atual (só na legislatura vigente); participação (titular/suplente)
 * existe em todas. Público (read-only).
 */
export const consultarMembrosSenado = createServerFn({ method: "GET" })
  .inputValidator((input) => consultaSenadoresSchema.parse(input ?? {}))
  .handler(async ({ data }): Promise<SenadorConsulta[]> => {
    const legAtual = legislaturaAtual();
    const [roster, leg] = await Promise.all([
      selectAll(() =>
        supabaseAdmin.from("senado_senadores_cache").select("id,nome,url_foto,situacao"),
      ),
      selectAll(() => {
        const base = supabaseAdmin
          .from("senado_senador_legislaturas")
          .select("codigo_parlamentar,legislatura,sigla_partido,sigla_uf,participacao");
        return data.legislatura != null ? base.eq("legislatura", data.legislatura) : base;
      }),
    ]);
    const idInfo = new Map(roster.map((r) => [r.id as number, r]));
    const term = data.q?.toLowerCase() ?? "";

    const out: SenadorConsulta[] = [];
    for (const l of leg) {
      const cod = l.codigo_parlamentar as number;
      const info = idInfo.get(cod);
      if (!info) continue;
      const nome = info.nome as string;
      if (term && !nome.toLowerCase().includes(term)) continue;
      if (data.uf && l.sigla_uf !== data.uf) continue;
      if (data.partido && l.sigla_partido !== data.partido) continue;
      if (data.participacao && l.participacao !== data.participacao) continue;
      const legNum = l.legislatura as number;
      const situacao = legNum === legAtual ? (info.situacao as string | null) : null;
      if (data.situacao && situacao !== data.situacao) continue;
      out.push({
        id: cod,
        nome,
        urlFoto: fotoSenador(cod, info.url_foto as string | null),
        siglaPartido: l.sigla_partido as string | null,
        siglaUf: l.sigla_uf as string | null,
        legislatura: legNum,
        situacao,
        participacao: l.participacao as string | null,
      });
    }
    return out.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  });

export const rankingGastosSenadores = createServerFn({ method: "GET" }).handler(async () => {
  // Soma no banco (view senado_gasto_por_senador); selectAll só pagina a view
  // agregada (~1 linha por senador) para ultrapassar o teto de 1000 do PostgREST.
  const [totais, sens] = await Promise.all([
    selectAll(() =>
      supabaseAdmin
        .from("senado_gasto_por_senador")
        .select("senador_id,total")
        .order("total", { ascending: false }),
    ),
    selectAll(() =>
      supabaseAdmin
        .from("senado_senadores_cache")
        .select("id,nome,sigla_partido,sigla_uf,url_foto"),
    ),
  ]);
  const senMap = new Map(sens.map((d) => [d.id as number, d]));
  return totais
    .map((r) => {
      const id = r.senador_id as number;
      const s = senMap.get(id);
      return {
        id,
        nome: s?.nome ?? `Senador ${id}`,
        siglaPartido: (s?.sigla_partido as string | null) ?? null,
        siglaUf: (s?.sigla_uf as string | null) ?? null,
        urlFoto: (s?.url_foto as string | null) ?? null,
        total: Number(r.total ?? 0),
      };
    })
    .sort((a, b) => b.total - a.total);
});

export type AfastamentoSenado = {
  codigo: number;
  nome: string;
  dataInicio: string | null;
  dataFim: string | null;
  descricaoCausa: string | null;
  participacao: string | null;
  uf: string | null;
};

/**
 * Afastamentos encerrados dentro de uma legislatura (senadores que deixaram o
 * exercício por licença, renúncia, investidura em cargo, falecimento…). Exclui o
 * fim normal de mandato (causa "TER"). Alimenta a visão "Vacâncias e afastamentos".
 */
export const movimentacoesLegislaturaSenado = createServerFn({ method: "GET" })
  .inputValidator((input) =>
    z.object({ legislatura: z.number().int().min(1).max(200) }).parse(input),
  )
  .handler(async ({ data }): Promise<AfastamentoSenado[]> => {
    const anoIni = 2003 + (data.legislatura - 52) * 4;
    const anoFim = anoIni + 4;
    const exRes = await selectAll(() =>
      supabaseAdmin
        .from("senado_exercicios")
        .select(
          "codigo_parlamentar,data_inicio,data_fim,sigla_causa,descricao_causa,participacao,uf",
        )
        .neq("sigla_causa", "TER")
        .not("data_fim", "is", null)
        .gte("data_fim", `${anoIni}-01-01`)
        .lt("data_fim", `${anoFim}-01-01`),
    );
    const ids = [...new Set(exRes.map((e) => e.codigo_parlamentar as number))];
    const roster = ids.length
      ? await selectAll(() =>
          supabaseAdmin
            .from("senado_senadores_cache")
            .select("codigo_parlamentar,nome")
            .in("codigo_parlamentar", ids),
        )
      : [];
    const nome = new Map(roster.map((r) => [r.codigo_parlamentar as number, r.nome as string]));
    return exRes
      .map((e) => ({
        codigo: e.codigo_parlamentar as number,
        nome: nome.get(e.codigo_parlamentar as number) ?? `Senador ${e.codigo_parlamentar}`,
        dataInicio: e.data_inicio as string | null,
        dataFim: e.data_fim as string | null,
        descricaoCausa: e.descricao_causa as string | null,
        participacao: e.participacao as string | null,
        uf: e.uf as string | null,
      }))
      .sort((a, b) => (b.dataFim ?? "").localeCompare(a.dataFim ?? ""));
  });

const UA_SENADO = "MutiraoDeDados/1.0 (+https://mutiraodedados.com.br)";
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
        .map((sv) => ({
          nome: ROTULO_SERVICO[sv.NomeServico ?? ""] ?? sv.NomeServico ?? "Serviço",
          url: sv.UrlServico ?? "",
        }))
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
  MandatoParlamentar?: {
    Parlamentar?: { Mandatos?: { Mandato?: MandatoApiItem | MandatoApiItem[] } };
  };
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
      .select(
        "id,ano,mes,tipo_despesa,data_documento,valor_reembolsado,fornecedor_nome,fornecedor_cnpj,num_documento,detalhamento",
      )
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
    const porFornecedor = new Map<
      string,
      { nome: string; cnpj: string | null; total: number; count: number }
    >();
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

    const cod = s.codigo_parlamentar as number;
    const [perfil, mandatos, legRes, exRes, meusSupRes, souSupRes] = await Promise.all([
      buscarPerfilSenador(cod),
      buscarMandatosSenador(cod),
      supabaseAdmin
        .from("senado_senador_legislaturas")
        .select("legislatura,sigla_partido,sigla_uf,participacao")
        .eq("codigo_parlamentar", cod)
        .order("legislatura", { ascending: false }),
      // Períodos em exercício + afastamentos deste senador.
      supabaseAdmin
        .from("senado_exercicios")
        .select("data_inicio,data_fim,sigla_causa,descricao_causa,participacao,uf")
        .eq("codigo_parlamentar", cod)
        .order("data_inicio", { ascending: false }),
      // Se é titular: seus suplentes. (distinct por suplente+ordem via app.)
      supabaseAdmin
        .from("senado_suplencia")
        .select("legislatura,ordem,suplente_codigo,suplente_nome")
        .eq("titular_codigo", cod)
        .order("legislatura", { ascending: false }),
      // Se é suplente: de quais titulares.
      supabaseAdmin
        .from("senado_suplencia")
        .select("legislatura,ordem,titular_codigo")
        .eq("suplente_codigo", cod)
        .order("legislatura", { ascending: false }),
    ]);
    const legislaturas = (legRes.data ?? []).map((m) => ({
      legislatura: m.legislatura as number,
      siglaPartido: m.sigla_partido as string | null,
      siglaUf: m.sigla_uf as string | null,
      participacao: m.participacao as string | null,
    }));
    const exercicios = (exRes.data ?? []).map((e) => ({
      dataInicio: e.data_inicio as string | null,
      dataFim: e.data_fim as string | null,
      siglaCausa: e.sigla_causa as string | null,
      descricaoCausa: e.descricao_causa as string | null,
      participacao: e.participacao as string | null,
      uf: e.uf as string | null,
    }));
    // Deduplica a cadeia de suplência por pessoa+ordem, guardando as legislaturas
    // (um mandato de 8 anos cobre 2 legislaturas). Assim, dois mandatos do mesmo
    // titular aparecem como suplentes distintos, cada um com seu período.
    const supMap = new Map<
      string,
      { codigo: number | null; nome: string | null; ordem: string | null; legs: Set<number> }
    >();
    for (const r of meusSupRes.data ?? []) {
      const c = r.suplente_codigo as number | null;
      const key = `${c ?? r.suplente_nome}-${r.ordem ?? ""}`;
      const cur = supMap.get(key) ?? {
        codigo: c,
        nome: r.suplente_nome as string | null,
        ordem: r.ordem as string | null,
        legs: new Set<number>(),
      };
      if (r.legislatura != null) cur.legs.add(r.legislatura as number);
      supMap.set(key, cur);
    }
    const meusSuplentes = [...supMap.values()]
      .map((s) => ({
        codigo: s.codigo,
        nome: s.nome,
        ordem: s.ordem,
        legislaturas: [...s.legs].sort((a, b) => a - b),
      }))
      .sort(
        (a, b) =>
          (a.ordem ?? "").localeCompare(b.ordem ?? "") ||
          (a.legislaturas[0] ?? 0) - (b.legislaturas[0] ?? 0),
      );
    const titMap = new Map<number, { ordem: string | null; legs: Set<number> }>();
    for (const r of souSupRes.data ?? []) {
      const t = r.titular_codigo as number;
      const cur = titMap.get(t) ?? { ordem: r.ordem as string | null, legs: new Set<number>() };
      if (r.legislatura != null) cur.legs.add(r.legislatura as number);
      titMap.set(t, cur);
    }
    // Nome dos titulares de quem este senador é suplente.
    let nomesTitulares = new Map<number, string>();
    if (titMap.size > 0) {
      const { data: tits } = await supabaseAdmin
        .from("senado_senadores_cache")
        .select("codigo_parlamentar,nome")
        .in("codigo_parlamentar", [...titMap.keys()]);
      nomesTitulares = new Map(
        (tits ?? []).map((t) => [t.codigo_parlamentar as number, t.nome as string]),
      );
    }
    const souSuplenteDe = [...titMap.entries()].map(([codigo, v]) => ({
      codigo,
      ordem: v.ordem,
      nome: nomesTitulares.get(codigo) ?? null,
      legislaturas: [...v.legs].sort((a, b) => a - b),
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
      exercicios,
      meusSuplentes,
      souSuplenteDe,
      totalGeral,
      despesas,
      porTipo: [...porTipo.entries()]
        .map(([tipo, total]) => ({ tipo, total }))
        .sort((a, b) => b.total - a.total),
      porFornecedor: [...porFornecedor.values()].sort((a, b) => b.total - a.total).slice(0, 30),
      porMes: [...porMes.entries()]
        .map(([mes, total]) => ({ mes, total }))
        .sort((a, b) => a.mes.localeCompare(b.mes)),
    };
  });

export const senadoOverview = createServerFn({ method: "GET" }).handler(async () => {
  const legAtual = legislaturaAtual();
  // Varredura completa para não subestimar atuais/histórico no teto de 1000.
  const [{ count: nSens }, { count: nDesps }, totalRes, exercData, pastData] = await Promise.all([
    supabaseAdmin.from("senado_senadores_cache").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("senado_despesas_cache").select("id", { count: "exact", head: true }),
    // Soma no banco: `.limit(100000)` sobre as despesas cruas truncava em 1000.
    supabaseAdmin.rpc("senado_gasto_total"),
    selectAll(() =>
      supabaseAdmin.from("senado_senadores_cache").select("id").eq("situacao", "Exercício"),
    ),
    selectAll(() =>
      supabaseAdmin
        .from("senado_senador_legislaturas")
        .select("codigo_parlamentar")
        .lt("legislatura", legAtual),
    ),
  ]);
  const totalGasto = Number(totalRes.data ?? 0);
  const atuaisIds = new Set(exercData.map((r) => r.id as number));
  const pastIds = new Set(pastData.map((r) => r.codigo_parlamentar as number));
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
    periodoFim: spanEnd?.[0]
      ? `${spanEnd[0].ano}-${String(spanEnd[0].mes).padStart(2, "0")}`
      : null,
  };
});
