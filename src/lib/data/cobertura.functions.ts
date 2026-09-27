import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";
import { inserirImportacoes } from "@/lib/data/historico.server";
import { estadoAgregado, estadoDaJanela, type EstadoCobertura } from "@/lib/data/cobertura-estado";
import {
  linhasDaFonte,
  resumoDaLinha,
  type LinhaJanela,
} from "@/lib/data/cobertura-estados.server";

export type Celula = {
  ano: number;
  mes: number;
  qtd: number;
  ultimo: string | null;
  /** A janela tem rodada no Histórico. */
  tentado?: boolean;
  tentativaEm?: string | null;
  /** Estado de cobertura da janela (o mesmo da `/cobertura`). */
  estado?: EstadoCobertura;
  /** Motivo da conferência mais recente, quando houver. */
  motivo?: string | null;
  /** Execução da conferência mais recente, para o Histórico filtrado. */
  execucaoId?: string | null;
};
export type Linha = { id: string; label: string; sublabel?: string; celulas: Celula[] };
export type Fonte = {
  fonte:
    | "cgu"
    | "cgu_licitacoes"
    | "cgu_emendas"
    | "cgu_convenios"
    | "camara_ceap"
    | "camara_vot"
    | "camara_props"
    | "senado_ceaps"
    | "senado_vot"
    | "senado_mat"
    | "pncp"
    | "transferegov"
    | "siconfi";
  titulo: string;
  descricao: string;
  granularidade: "mes" | "periodo" | "ano";
  linhas: Linha[];
};
export type CoberturaResult = { fontes: Fonte[]; anos: number[] };

/** Fontes cuja API é consultada por ano inteiro (uma requisição por ano). */
export const FONTES_ANUAIS: ReadonlySet<Fonte["fonte"]> = new Set([
  "cgu_emendas",
  "camara_props",
  "senado_mat",
]);

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

type RpcRowOrgao = {
  orgao_cod: string;
  ano: number;
  mes: number;
  qtd: number;
  ultimo: string | null;
};
type RpcRow = { ano: number; mes: number; qtd: number; ultimo: string | null };
type RpcSiconfi = {
  tipo_relatorio: string;
  ano: number;
  periodo: number;
  qtd: number;
  ultimo: string | null;
};
/** As fontes da matriz, na ordem das linhas. */
const FONTES_DA_MATRIZ: Fonte["fonte"][] = [
  "cgu",
  "cgu_licitacoes",
  "cgu_emendas",
  "cgu_convenios",
  "camara_ceap",
  "camara_vot",
  "camara_props",
  "senado_ceaps",
  "senado_vot",
  "senado_mat",
  "pncp",
  "transferegov",
  "siconfi",
];

/** Fontes anuais cujas rodadas gravam a sigla (ou o tipo) no `escopo`. */
const FONTES_COM_SIGLA_NO_ESCOPO = new Set(["camara_props", "senado_mat"]);

export const statusCobertura = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CoberturaResult> => {
    await ensureAdmin(context.userId);

    const [
      cgu,
      cguLic,
      cguEme,
      cguConv,
      ceap,
      camVot,
      camProps,
      ceaps,
      senVot,
      senMat,
      pncp,
      transf,
      siconfi,
      historico,
    ] = await Promise.all([
      supabaseAdmin.rpc("cobertura_cgu"),
      supabaseAdmin.rpc("cobertura_cgu_licitacoes"),
      supabaseAdmin.rpc("cobertura_cgu_emendas"),
      supabaseAdmin.rpc("cobertura_cgu_convenios"),
      supabaseAdmin.rpc("cobertura_camara_ceap"),
      supabaseAdmin.rpc("cobertura_camara_votacoes"),
      supabaseAdmin.rpc("cobertura_camara_proposicoes"),
      supabaseAdmin.rpc("cobertura_senado_ceaps"),
      supabaseAdmin.rpc("cobertura_senado_votacoes"),
      supabaseAdmin.rpc("cobertura_senado_materias"),
      supabaseAdmin.rpc("cobertura_pncp"),
      supabaseAdmin.rpc("cobertura_transferegov"),
      supabaseAdmin.rpc("cobertura_siconfi"),
      Promise.all(FONTES_DA_MATRIZ.map(async (f) => [f, await linhasDaFonte(f)] as const)),
    ]);

    // Estado de cada janela, lido do Histórico (a mesma função da
    // `/cobertura`). Chave: `fonte|escopo|ano|mes`.
    // Janelas por fonte e escopo (`fonte|escopo`), e por fonte (`fonte|*`).
    const janelas = new Map<string, LinhaJanela[]>();
    const guardar = (k: string, l: LinhaJanela) => janelas.set(k, [...(janelas.get(k) ?? []), l]);
    for (const [fonte, linhas] of historico) {
      for (const l of linhas) {
        guardar(`${fonte}|${l.escopo}`, l);
        guardar(`${fonte}|*`, l);
      }
    }
    const agora = new Date();
    const celulaDaJanela = (c: Celula, l: LinhaJanela | undefined): Celula => ({
      ...c,
      tentado: !!l?.ultima_rodada_em,
      tentativaEm: l?.ultima_rodada_em ?? null,
      estado: estadoDaJanela(resumoDaLinha(l, c.qtd > 0), agora),
      motivo: l?.conferencia_motivo ?? null,
      execucaoId: l?.conferencia_execucao_id ?? null,
    });

    /**
     * Marca o estado nas células da linha e acrescenta as janelas consultadas
     * que não têm registro. Proposições e matérias gravam a sigla no escopo,
     * mas a matriz tem uma linha anual só: a célula do ano agrega o estado de
     * todas as siglas.
     */
    const marcarEstados = (fonte: string, escopo: string, celulas: Celula[]): Celula[] => {
      const agregada = FONTES_COM_SIGLA_NO_ESCOPO.has(fonte);
      const daLinha = janelas.get(`${fonte}|${agregada ? "*" : escopo}`) ?? [];
      const porCelula = new Map<string, LinhaJanela[]>();
      for (const l of daLinha) {
        const k = `${l.ano}|${l.mes}`;
        porCelula.set(k, [...(porCelula.get(k) ?? []), l]);
      }
      const out = celulas.map((c) => {
        const ls = porCelula.get(`${c.ano}|${c.mes}`) ?? [];
        porCelula.delete(`${c.ano}|${c.mes}`);
        if (!agregada) return celulaDaJanela(c, ls[0]);
        const cels = ls.map((l) => celulaDaJanela(c, l));
        return {
          ...celulaDaJanela(c, ls[0]),
          estado: estadoAgregado(cels.map((x) => x.estado!)),
        };
      });
      for (const [k, ls] of porCelula) {
        const [ano, mes] = k.split("|").map(Number);
        if (!ano) continue;
        const vazia: Celula = { ano, mes, qtd: 0, ultimo: null };
        const cels = ls.map((l) => celulaDaJanela(vazia, l));
        out.push({ ...cels[0], estado: estadoAgregado(cels.map((x) => x.estado!)) });
      }
      return out;
    };

    /** Escopos com janela no Histórico, para criar linhas sem registro (CGU por órgão). */
    const escoposComJanela = (fonte: string): string[] => [
      ...new Set((janelas.get(`${fonte}|*`) ?? []).map((l) => l.escopo).filter(Boolean)),
    ];

    const anosSet = new Set<number>();
    const colher = (rows: { ano: number }[] | null) => {
      for (const r of rows ?? []) if (r.ano) anosSet.add(r.ano);
    };
    colher((cgu.data as RpcRowOrgao[] | null) ?? []);
    colher((cguLic.data as RpcRowOrgao[] | null) ?? []);
    colher((cguEme.data as RpcRow[] | null) ?? []);
    colher((cguConv.data as RpcRow[] | null) ?? []);
    colher((ceap.data as RpcRow[] | null) ?? []);
    colher((camVot.data as RpcRow[] | null) ?? []);
    colher((camProps.data as RpcRow[] | null) ?? []);
    colher((ceaps.data as RpcRow[] | null) ?? []);
    colher((senVot.data as RpcRow[] | null) ?? []);
    colher((senMat.data as RpcRow[] | null) ?? []);
    colher((pncp.data as RpcRow[] | null) ?? []);
    colher((transf.data as RpcRow[] | null) ?? []);
    for (const r of (siconfi.data as RpcSiconfi[] | null) ?? []) if (r.ano) anosSet.add(r.ano);
    for (const [, linhas] of historico) for (const l of linhas) if (l.ano) anosSet.add(l.ano);

    const anoAtual = new Date().getFullYear();
    anosSet.add(anoAtual);
    const anos = Array.from(anosSet).sort((a, b) => b - a);

    // ===== CGU: linhas por órgão =====
    const cguRows = (cgu.data as RpcRowOrgao[] | null) ?? [];
    const cguMap = new Map<string, Celula[]>();
    for (const r of cguRows) {
      if (!cguMap.has(r.orgao_cod)) cguMap.set(r.orgao_cod, []);
      cguMap
        .get(r.orgao_cod)!
        .push({ ano: r.ano, mes: r.mes, qtd: Number(r.qtd), ultimo: r.ultimo });
    }
    // Órgão só com janelas consultadas (nenhum contrato ainda) também vira linha.
    for (const e of escoposComJanela("cgu")) if (!cguMap.has(e)) cguMap.set(e, []);
    const linhasCgu: Linha[] = Array.from(cguMap.entries()).map(([cod, celulas]) => ({
      id: cod,
      label: cod,
      celulas: marcarEstados("cgu", cod, celulas),
    }));

    // ===== CGU licitações: linhas por órgão (mesma forma de contratos) =====
    const cguLicRows = (cguLic.data as RpcRowOrgao[] | null) ?? [];
    const cguLicMap = new Map<string, Celula[]>();
    for (const r of cguLicRows) {
      if (!cguLicMap.has(r.orgao_cod)) cguLicMap.set(r.orgao_cod, []);
      cguLicMap
        .get(r.orgao_cod)!
        .push({ ano: r.ano, mes: r.mes, qtd: Number(r.qtd), ultimo: r.ultimo });
    }
    for (const e of escoposComJanela("cgu_licitacoes")) if (!cguLicMap.has(e)) cguLicMap.set(e, []);
    const linhasCguLic: Linha[] = Array.from(cguLicMap.entries()).map(([cod, celulas]) => ({
      id: cod,
      label: cod,
      celulas: marcarEstados("cgu_licitacoes", cod, celulas),
    }));

    const linhaUnica = (rows: RpcRow[] | null, id: string, label: string): Linha[] => [
      {
        id,
        label,
        celulas: marcarEstados(
          id,
          "",
          (rows ?? []).map((r) => ({
            ano: r.ano,
            mes: r.mes,
            qtd: Number(r.qtd),
            ultimo: r.ultimo,
          })),
        ),
      },
    ];

    /**
     * Para fontes anuais: agrega todos os meses do ano em uma única célula
     * (mes=1, usada como âncora). A UI da matriz e a página pública sabem
     * exibir granularidade "ano" como uma coluna só.
     */
    const linhaAnual = (rows: RpcRow[] | null, id: string, label: string): Linha[] => {
      const byAno = new Map<number, { qtd: number; ultimo: string | null }>();
      for (const r of rows ?? []) {
        if (!r.ano) continue;
        const cur = byAno.get(r.ano) ?? { qtd: 0, ultimo: null };
        cur.qtd += Number(r.qtd);
        if (r.ultimo && (!cur.ultimo || r.ultimo > cur.ultimo)) cur.ultimo = r.ultimo;
        byAno.set(r.ano, cur);
      }
      const celulas = Array.from(byAno.entries()).map(([ano, v]) => ({
        ano,
        mes: 1,
        qtd: v.qtd,
        ultimo: v.ultimo,
      }));
      return [{ id, label, celulas: marcarEstados(id, "", celulas) }];
    };

    // ===== SICONFI: linhas por tipo de relatório =====
    const siconfiRows = (siconfi.data as RpcSiconfi[] | null) ?? [];
    const siconfiMap = new Map<string, Celula[]>();
    for (const r of siconfiRows) {
      if (!siconfiMap.has(r.tipo_relatorio)) siconfiMap.set(r.tipo_relatorio, []);
      siconfiMap.get(r.tipo_relatorio)!.push({
        ano: r.ano,
        mes: r.periodo,
        qtd: Number(r.qtd),
        ultimo: r.ultimo,
      });
    }
    const linhasSiconfi: Linha[] = Array.from(siconfiMap.entries()).map(([tipo, celulas]) => ({
      id: tipo,
      label: tipo,
      celulas: marcarEstados("siconfi", tipo, celulas),
    }));

    return {
      anos,
      fontes: [
        {
          fonte: "cgu",
          titulo: "Portal CGU — contratos por órgão",
          descricao:
            "Linhas por órgão do Executivo. Clique numa célula para (re)importar aquele mês.",
          granularidade: "mes",
          linhas: linhasCgu,
        },
        {
          fonte: "cgu_licitacoes",
          titulo: "Portal CGU — licitações por órgão",
          descricao:
            "Licitações do Executivo federal por órgão e mês de abertura. Clique numa célula para (re)importar aquele mês.",
          granularidade: "mes",
          linhas: linhasCguLic,
        },
        {
          fonte: "cgu_emendas",
          titulo: "Portal CGU — emendas parlamentares",
          descricao:
            "Emendas individuais/coletivas por ano (empenho/liquidação/pagamento). A API é consultada por ano inteiro — clique na coluna do ano para (re)importar.",
          granularidade: "ano",
          linhas: linhaAnual(cguEme.data as RpcRow[] | null, "cgu_emendas", "Emendas"),
        },
        {
          fonte: "cgu_convenios",
          titulo: "Portal CGU — convênios",
          descricao:
            "Convênios e contratos de repasse (eixo tema, endpoint /convenios). Granularidade por mês de referência.",
          granularidade: "mes",
          linhas: linhaUnica(cguConv.data as RpcRow[] | null, "cgu_convenios", "Convênios"),
        },
        {
          fonte: "camara_ceap",
          titulo: "Câmara — CEAP (cota parlamentar)",
          descricao: "Notas fiscais de cota parlamentar por mês (todos os ~513 deputados).",
          granularidade: "mes",
          linhas: linhaUnica(ceap.data as RpcRow[] | null, "camara_ceap", "CEAP"),
        },
        {
          fonte: "camara_vot",
          titulo: "Câmara — votações nominais",
          descricao: "Votações registradas no plenário e comissões, por mês.",
          granularidade: "mes",
          linhas: linhaUnica(camVot.data as RpcRow[] | null, "camara_vot", "Votações"),
        },
        {
          fonte: "camara_props",
          titulo: "Câmara — proposições",
          descricao:
            "Proposições (PL, PEC, PLP, MPV, PDL, PRC) por ano de apresentação. A API é consultada por ano inteiro — clique na coluna do ano para (re)importar.",
          granularidade: "ano",
          linhas: linhaAnual(camProps.data as RpcRow[] | null, "camara_props", "Proposições"),
        },
        {
          fonte: "senado_ceaps",
          titulo: "Senado — CEAPS (cota parlamentar)",
          descricao: "Notas fiscais de cota parlamentar por mês (81 senadores).",
          granularidade: "mes",
          linhas: linhaUnica(ceaps.data as RpcRow[] | null, "senado_ceaps", "CEAPS"),
        },
        {
          fonte: "senado_vot",
          titulo: "Senado — votações",
          descricao: "Votações registradas, por mês.",
          granularidade: "mes",
          linhas: linhaUnica(senVot.data as RpcRow[] | null, "senado_vot", "Votações"),
        },
        {
          fonte: "senado_mat",
          titulo: "Senado — matérias",
          descricao:
            "Matérias legislativas (PLS, PEC, PLC etc.) por ano. A API é consultada por ano inteiro — clique na coluna do ano para (re)importar.",
          granularidade: "ano",
          linhas: linhaAnual(senMat.data as RpcRow[] | null, "senado_mat", "Matérias"),
        },
        {
          fonte: "pncp",
          titulo: "PNCP — contratos (União/Estados/Municípios)",
          descricao: "Contratos publicados no Portal Nacional de Contratações Públicas.",
          granularidade: "mes",
          linhas: linhaUnica(pncp.data as RpcRow[] | null, "pncp", "PNCP"),
        },
        {
          fonte: "transferegov",
          titulo: "Convênios por ente (Portal CGU)",
          descricao:
            "Convênios e contratos de repasse União ↔ Estados/Municípios, pelo ângulo de quem recebe.",
          granularidade: "mes",
          linhas: linhaUnica(transf.data as RpcRow[] | null, "transferegov", "Convênios"),
        },
        {
          fonte: "siconfi",
          titulo: "SICONFI — relatórios fiscais",
          descricao:
            "RREO/RGF/DCA por exercício e período. Colunas representam o número do período (DCA é anual).",
          granularidade: "periodo",
          linhas: linhasSiconfi,
        },
      ],
    };
  });

const TentativaSchema = z.object({
  fonte: z.string().min(1).max(40),
  escopo: z.string().max(80).default(""),
  ano: z.number().int().min(2000).max(2100),
  mes: z.number().int().min(1).max(12),
  registros: z.number().int().min(0).default(0),
  erro: z.string().max(500).optional(),
  endpoint: z.string().max(500).optional(),
});

export const registrarTentativa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => TentativaSchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);
    const erro = await inserirImportacoes({
      fonte: data.fonte,
      escopo: data.escopo ?? "",
      ano: data.ano,
      mes: data.mes,
      total_bruto: data.registros,
      importados: data.registros,
      erros: data.erro ? [data.erro] : [],
      user_id: context.userId,
      gatilho: "painel",
      endpoint: data.endpoint ?? null,
    });
    if (erro) throw new Error(erro);
    return { ok: true as const };
  });
