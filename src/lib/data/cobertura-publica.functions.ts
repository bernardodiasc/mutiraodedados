import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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
  const { data } = await (supabaseAdmin.from as (t: string) => any)(table)
    .select("updated_at")
    .order("updated_at", { ascending: false })
    .limit(1);
  return (data?.[0] as { updated_at?: string } | undefined)?.updated_at ?? null;
}

async function countOf(table: string): Promise<number> {
  const { count } = await (supabaseAdmin.from as (t: string) => any)(table).select("*", {
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
      countOf("cgu_convenios_cache"),
      countOf("pncp_contratos_cache"),
      countOf("transferegov_instrumentos_cache"),
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

    const ultimo = (rows: { ultimo: string | null }[]): string | null => {
      let max: string | null = null;
      for (const r of rows) {
        if (r.ultimo && (!max || r.ultimo > max)) max = r.ultimo;
      }
      return max;
    };

    const mkFonte = (
      id: string,
      titulo: string,
      descricao: string,
      rows: { ano: number; mes: number; qtd: number; ultimo: string | null }[],
      total: number,
      rota: string | undefined,
      granularidade: FonteCobertura["granularidade"] = "mes",
    ): FonteCobertura => {
      const { primeira, ultima } = rangeDeAnoMes(rows);
      return {
        id,
        titulo,
        descricao,
        granularidade,
        totalRegistros: total,
        ultimaAtualizacao: ultimo(rows),
        primeiraData: primeira,
        ultimaData: ultima,
        porAno: agregarPorAno(rows),
        porAnoMes: rows
          .filter((r) => r.ano && r.mes && r.qtd > 0)
          .map((r) => ({ ano: r.ano, mes: r.mes, qtd: r.qtd })),
        mesesAnoCorrente: mesesPresentes(rows, anoCorrente),
        rota,
      };
    };

    const fontes: FonteCobertura[] = [
      mkFonte(
        "cgu",
        "Portal CGU — contratos do Executivo",
        "Contratos publicados pelo Portal da Transparência para órgãos do Executivo federal.",
        cguRows,
        countCgu,
        "/orgaos",
      ),
      mkFonte(
        "cgu_licitacoes",
        "Portal CGU — licitações do Executivo",
        "Licitações publicadas pelo Portal da Transparência para órgãos do Executivo federal.",
        cguLicRows,
        countCguLic,
        "/licitacoes",
      ),
      mkFonte(
        "cgu_emendas",
        "Portal CGU — emendas parlamentares",
        "Emendas parlamentares (empenho, liquidação e pagamento) publicadas pelo Portal da Transparência, por ano.",
        cguEmeRows,
        countCguEme,
        "/emendas",
        "ano",
      ),
      mkFonte(
        "cgu_convenios",
        "Portal CGU — convênios",
        "Convênios e contratos de repasse da União, pelo endpoint /convenios do Portal da Transparência.",
        cguConvRows,
        countCguConv,
        "/convenios",
      ),
      mkFonte(
        "pncp",
        "PNCP — contratos públicos",
        "Contratos publicados no Portal Nacional de Contratações Públicas (União, Estados, Municípios).",
        pncpRows,
        countPncp,
        "/pncp",
      ),
      mkFonte(
        "transferegov",
        "Transferegov — convênios",
        "Convênios e contratos de repasse União ↔ Estados/Municípios.",
        transfRows,
        countTransf,
        "/transferegov",
      ),
      mkFonte(
        "siconfi",
        "SICONFI — relatórios fiscais",
        "RREO/RGF/DCA por exercício e período (granularidade por período do ano).",
        siconfiRows,
        countSiconfi,
        "/relatorios-fiscais",
        "periodo",
      ),
      mkFonte(
        "camara_ceap",
        "Câmara — CEAP (cota parlamentar)",
        "Notas fiscais de cota parlamentar dos ~513 deputados federais.",
        camCeapRows,
        countCamCeap,
        "/camara/deputados",
      ),
      mkFonte(
        "camara_vot",
        "Câmara — votações nominais",
        "Votações registradas em plenário e comissões da Câmara.",
        camVotRows,
        countCamVot,
        "/camara/votacoes",
      ),
      mkFonte(
        "senado_ceaps",
        "Senado — CEAPS (cota parlamentar)",
        "Notas fiscais de cota parlamentar dos 81 senadores.",
        senCeapsRows,
        countSenCeaps,
        "/senado/senadores",
      ),
      mkFonte(
        "senado_vot",
        "Senado — votações",
        "Votações registradas no Senado Federal.",
        senVotRows,
        countSenVot,
        "/senado/votacoes",
      ),
      {
        id: "camara_deputados",
        titulo: "Câmara — cadastro de deputados",
        descricao: "Cadastro vigente de parlamentares da Câmara dos Deputados.",
        granularidade: "cadastro",
        totalRegistros: countDeputados,
        ultimaAtualizacao: updDeputados,
        primeiraData: null,
        ultimaData: null,
        porAno: [],
        porAnoMes: [],
        mesesAnoCorrente: [],
        rota: "/camara/deputados",
      },
      mkFonte(
        "tse",
        "TSE — eleições (candidatos, bens, votos e contas)",
        `Dados abertos eleitorais de 2014 em diante. Além das candidaturas, o cache guarda ${countTseReceitas.toLocaleString("pt-BR")} receitas e ${countTseDespesas.toLocaleString("pt-BR")} despesas de campanha.`,
        ((tseContagem.data as { ano_eleicao: number; candidatos: number }[] | null) ?? []).map(
          (r) => ({ ano: r.ano_eleicao, mes: 1, qtd: Number(r.candidatos), ultimo: updTse }),
        ),
        countTseCandidatos,
        "/eleicoes",
        "ano",
      ),
      {
        id: "senado_senadores",
        titulo: "Senado — cadastro de senadores",
        descricao: "Cadastro vigente de parlamentares do Senado Federal.",
        granularidade: "cadastro",
        totalRegistros: countSenadores,
        ultimaAtualizacao: updSenadores,
        primeiraData: null,
        ultimaData: null,
        porAno: [],
        porAnoMes: [],
        mesesAnoCorrente: [],
        rota: "/senado/senadores",
      },
    ];

    return { geradoEm: new Date().toISOString(), anoCorrente, fontes };
  },
);
