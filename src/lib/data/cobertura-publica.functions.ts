import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { entradaCatalogoCobertura } from "@/lib/data/cobertura-catalogo";

export type FonteCobertura = {
  id: string;
  titulo: string;
  descricao: string;
  granularidade: "mes" | "periodo" | "cadastro" | "ano";
  totalRegistros: number;
  ultimaAtualizacao: string | null;
  primeiraData: string | null;
  ultimaData: string | null;
  /** total por ano */
  porAno: { ano: number; qtd: number }[];
  /** detalhe por ano e mês/período — usado no heatmap completo. */
  porAnoMes: { ano: number; mes: number; qtd: number }[];
  /** meses presentes no ano corrente (1..12) */
  mesesAnoCorrente: number[];
  /** rota interna para explorar essa fonte */
  rota?: string;
};

export type CoberturaPublicaResult = {
  geradoEm: string;
  anoCorrente: number;
  fontes: FonteCobertura[];
};

type RpcRow = { ano: number; mes: number; qtd: number; ultimo: string | null };
type RpcRowOrgao = {
  orgao_cod: string;
  ano: number;
  mes: number;
  qtd: number;
  ultimo: string | null;
};
type RpcSiconfi = {
  tipo_relatorio: string;
  ano: number;
  periodo: number;
  qtd: number;
  ultimo: string | null;
};

async function maxUpdated(table: string): Promise<string | null> {
  const { data } =
    await // eslint-disable-next-line @typescript-eslint/no-explicit-any -- `from` é tipado com os nomes literais de tabela do Database gerado; nome dinâmico exige escape
    (supabaseAdmin.from as (t: string) => any)(table)
      .select("updated_at")
      .order("updated_at", { ascending: false })
      .limit(1);
  return (data?.[0] as { updated_at?: string } | undefined)?.updated_at ?? null;
}

async function countOf(table: string): Promise<number> {
  const { count } =
    await // eslint-disable-next-line @typescript-eslint/no-explicit-any -- `from` é tipado com os nomes literais de tabela do Database gerado; nome dinâmico exige escape
    (supabaseAdmin.from as (t: string) => any)(table).select("*", {
      count: "exact",
      head: true,
    });
  return count ?? 0;
}

function agregarPorAno(
  rows: { ano: number; qtd: number | string }[],
): { ano: number; qtd: number }[] {
  const m = new Map<number, number>();
  for (const r of rows) {
    if (!r.ano) continue;
    m.set(r.ano, (m.get(r.ano) ?? 0) + Number(r.qtd));
  }
  return Array.from(m.entries())
    .map(([ano, qtd]) => ({ ano, qtd }))
    .sort((a, b) => a.ano - b.ano);
}

function mesesPresentes(
  rows: { ano: number; mes: number; qtd: number | string }[],
  ano: number,
): number[] {
  const s = new Set<number>();
  for (const r of rows) {
    if (r.ano === ano && r.mes && Number(r.qtd) > 0) s.add(r.mes);
  }
  return Array.from(s).sort((a, b) => a - b);
}

function rangeDeAnoMes(rows: { ano: number; mes: number; qtd: number | string }[]): {
  primeira: string | null;
  ultima: string | null;
} {
  const validas = rows
    .filter((r) => r.ano && r.mes && Number(r.qtd) > 0)
    .map((r) => r.ano * 100 + r.mes);
  if (validas.length === 0) return { primeira: null, ultima: null };
  const min = Math.min(...validas);
  const max = Math.max(...validas);
  const fmt = (n: number) => `${Math.floor(n / 100)}-${String(n % 100).padStart(2, "0")}-01`;
  return { primeira: fmt(min), ultima: fmt(max) };
}

export const coberturaPublica = createServerFn({ method: "GET" }).handler(
  async (): Promise<CoberturaPublicaResult> => {
    const anoCorrente = new Date().getFullYear();

    const [
      cgu,
      cguLic,
      cguEme,
      cguConv,
      pncp,
      transf,
      siconfi,
      camCeap,
      camVot,
      senCeaps,
      senVot,
      countCgu,
      countCguLic,
      countCguEme,
      countCguConv,
      countPncp,
      countTransf,
      countSiconfi,
      countCamCeap,
      countCamVot,
      countSenCeaps,
      countSenVot,
      countDeputados,
      countSenadores,
      updDeputados,
      updSenadores,
      tseContagem,
      countTseCandidatos,
      countTseReceitas,
      countTseDespesas,
      updTse,
      camProps,
      senMat,
      countCamProps,
      countSenMat,
      countOrgaos,
      updOrgaos,
      countIbge,
      updIbge,
    ] = await Promise.all([
      supabaseAdmin.rpc("cobertura_cgu"),
      supabaseAdmin.rpc("cobertura_cgu_licitacoes"),
      supabaseAdmin.rpc("cobertura_cgu_emendas"),
      supabaseAdmin.rpc("cobertura_cgu_convenios"),
      supabaseAdmin.rpc("cobertura_pncp"),
      supabaseAdmin.rpc("cobertura_transferegov"),
      supabaseAdmin.rpc("cobertura_siconfi"),
      supabaseAdmin.rpc("cobertura_camara_ceap"),
      supabaseAdmin.rpc("cobertura_camara_votacoes"),
      supabaseAdmin.rpc("cobertura_senado_ceaps"),
      supabaseAdmin.rpc("cobertura_senado_votacoes"),
      countOf("contratos_cache"),
      countOf("cgu_licitacoes_cache"),
      countOf("cgu_transferegov_emendas_cache"),
      countOf("convenios_cache"),
      countOf("pncp_contratos_cache"),
      countOf("convenios_cache"),
      countOf("siconfi_relatorios_cache"),
      countOf("camara_despesas_cache"),
      countOf("camara_votacoes_cache"),
      countOf("senado_despesas_cache"),
      countOf("senado_votacoes_cache"),
      countOf("camara_deputados_cache"),
      countOf("senado_senadores_cache"),
      maxUpdated("camara_deputados_cache"),
      maxUpdated("senado_senadores_cache"),
      supabaseAdmin.rpc("tse_contagem_ano_uf"),
      countOf("tse_candidatos_cache"),
      countOf("tse_receitas_campanha_cache"),
      countOf("tse_despesas_campanha_cache"),
      maxUpdated("tse_candidatos_cache"),
      supabaseAdmin.rpc("cobertura_camara_proposicoes"),
      supabaseAdmin.rpc("cobertura_senado_materias"),
      countOf("camara_proposicoes_cache"),
      countOf("senado_materias_cache"),
      countOf("orgaos_cache"),
      maxUpdated("orgaos_cache"),
      countOf("ibge_municipios_cache"),
      maxUpdated("ibge_municipios_cache"),
    ]);

    const cguRows = ((cgu.data as RpcRowOrgao[] | null) ?? []).map((r) => ({
      ano: r.ano,
      mes: r.mes,
      qtd: Number(r.qtd),
      ultimo: r.ultimo,
    }));
    const cguLicRows = ((cguLic.data as RpcRowOrgao[] | null) ?? []).map((r) => ({
      ano: r.ano,
      mes: r.mes,
      qtd: Number(r.qtd),
      ultimo: r.ultimo,
    }));
    const cguEmeRows = ((cguEme.data as RpcRow[] | null) ?? []).map((r) => ({
      ...r,
      qtd: Number(r.qtd),
    }));
    const cguConvRows = ((cguConv.data as RpcRow[] | null) ?? []).map((r) => ({
      ...r,
      qtd: Number(r.qtd),
    }));
    const pncpRows = ((pncp.data as RpcRow[] | null) ?? []).map((r) => ({
      ...r,
      qtd: Number(r.qtd),
    }));
    const transfRows = ((transf.data as RpcRow[] | null) ?? []).map((r) => ({
      ...r,
      qtd: Number(r.qtd),
    }));
    const siconfiRows = ((siconfi.data as RpcSiconfi[] | null) ?? []).map((r) => ({
      ano: r.ano,
      mes: r.periodo,
      qtd: Number(r.qtd),
      ultimo: r.ultimo,
    }));
    const camCeapRows = ((camCeap.data as RpcRow[] | null) ?? []).map((r) => ({
      ...r,
      qtd: Number(r.qtd),
    }));
    const camVotRows = ((camVot.data as RpcRow[] | null) ?? []).map((r) => ({
      ...r,
      qtd: Number(r.qtd),
    }));
    const senCeapsRows = ((senCeaps.data as RpcRow[] | null) ?? []).map((r) => ({
      ...r,
      qtd: Number(r.qtd),
    }));
    const senVotRows = ((senVot.data as RpcRow[] | null) ?? []).map((r) => ({
      ...r,
      qtd: Number(r.qtd),
    }));
    const camPropsRows = ((camProps.data as RpcRow[] | null) ?? []).map((r) => ({
      ...r,
      qtd: Number(r.qtd),
    }));
    const senMatRows = ((senMat.data as RpcRow[] | null) ?? []).map((r) => ({
      ...r,
      qtd: Number(r.qtd),
    }));

    const ultimo = (rows: { ultimo: string | null }[]): string | null => {
      let max: string | null = null;
      for (const r of rows) {
        if (r.ultimo && (!max || r.ultimo > max)) max = r.ultimo;
      }
      return max;
    };

    // Título, descrição, rota e granularidade vêm do catálogo — o teste-guarda
    // cruza o catálogo com FONTES_COM_HISTORICO, então fonte nova sem entrada
    // lá quebra a suíte antes de sumir da página.
    const mkFonte = (
      id: string,
      rows: { ano: number; mes: number; qtd: number; ultimo: string | null }[],
      total: number,
      descricaoExtra?: string,
    ): FonteCobertura => {
      const meta = entradaCatalogoCobertura(id);
      const { primeira, ultima } = rangeDeAnoMes(rows);
      return {
        id,
        titulo: meta.titulo,
        descricao: descricaoExtra ? `${meta.descricao} ${descricaoExtra}` : meta.descricao,
        granularidade: meta.granularidade,
        totalRegistros: total,
        ultimaAtualizacao: ultimo(rows),
        primeiraData: primeira,
        ultimaData: ultima,
        porAno: agregarPorAno(rows),
        porAnoMes: rows
          .filter((r) => r.ano && r.mes && r.qtd > 0)
          .map((r) => ({ ano: r.ano, mes: r.mes, qtd: r.qtd })),
        mesesAnoCorrente: mesesPresentes(rows, anoCorrente),
        rota: meta.rota ?? undefined,
      };
    };

    /** Cadastro vigente: sem série — contagem e última atualização. */
    const mkCadastro = (id: string, total: number, upd: string | null): FonteCobertura => {
      const meta = entradaCatalogoCobertura(id);
      return {
        id,
        titulo: meta.titulo,
        descricao: meta.descricao,
        granularidade: "cadastro",
        totalRegistros: total,
        ultimaAtualizacao: upd,
        primeiraData: null,
        ultimaData: null,
        porAno: [],
        porAnoMes: [],
        mesesAnoCorrente: [],
        rota: meta.rota ?? undefined,
      };
    };

    const fontes: FonteCobertura[] = [
      mkFonte("cgu", cguRows, countCgu),
      mkFonte("cgu_licitacoes", cguLicRows, countCguLic),
      mkFonte("cgu_emendas", cguEmeRows, countCguEme),
      mkFonte("cgu_convenios", cguConvRows, countCguConv),
      mkFonte("pncp", pncpRows, countPncp),
      mkFonte("transferegov", transfRows, countTransf),
      mkFonte("siconfi", siconfiRows, countSiconfi),
      mkFonte("camara_ceap", camCeapRows, countCamCeap),
      mkFonte("camara_vot", camVotRows, countCamVot),
      mkFonte("camara_props", camPropsRows, countCamProps),
      mkCadastro("camara_deputados", countDeputados, updDeputados),
      mkFonte("senado_ceaps", senCeapsRows, countSenCeaps),
      mkFonte("senado_vot", senVotRows, countSenVot),
      mkFonte("senado_mat", senMatRows, countSenMat),
      mkCadastro("senado_senadores", countSenadores, updSenadores),
      mkCadastro("orgaos_siafi", countOrgaos, updOrgaos),
      mkCadastro("ibge", countIbge, updIbge),
      mkFonte(
        "tse",
        ((tseContagem.data as { ano_eleicao: number; candidatos: number }[] | null) ?? []).map(
          (r) => ({ ano: r.ano_eleicao, mes: 1, qtd: Number(r.candidatos), ultimo: updTse }),
        ),
        countTseCandidatos,
        `Além das candidaturas, o cache guarda ${countTseReceitas.toLocaleString("pt-BR")} receitas e ${countTseDespesas.toLocaleString("pt-BR")} despesas de campanha.`,
      ),
    ];

    return { geradoEm: new Date().toISOString(), anoCorrente, fontes };
  },
);
