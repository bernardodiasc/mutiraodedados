import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

export type Celula = {
  ano: number;
  mes: number;
  qtd: number;
  ultimo: string | null;
  tentado?: boolean;
  tentativaEm?: string | null;
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
type RpcTentativa = {
  fonte: string;
  escopo: string;
  ano: number;
  mes: number;
  tentativas: number;
  ultimo: string | null;
};

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
      tentativas,
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
      supabaseAdmin.rpc("cobertura_tentativas"),
    ]);

    // Index attempts: key = `${fonte}|${escopo}|${ano}|${mes}`
    const tentMap = new Map<string, { ultimo: string | null }>();
    for (const t of (tentativas.data as RpcTentativa[] | null) ?? []) {
      tentMap.set(`${t.fonte}|${t.escopo}|${t.ano}|${t.mes}`, { ultimo: t.ultimo });
    }
    const marcarTentativas = (fonte: string, escopo: string, celulas: Celula[]): Celula[] => {
      const out = celulas.map((c) => {
        const k = `${fonte}|${escopo}|${c.ano}|${c.mes}`;
        const t = tentMap.get(k);
        if (t) {
          tentMap.delete(k);
          return { ...c, tentado: true, tentativaEm: t.ultimo };
        }
        return c;
      });
      // Add empty cells for attempts with no data
      for (const [k, t] of tentMap) {
        const [f, e, a, m] = k.split("|");
        if (f === fonte && e === escopo) {
          out.push({
            ano: Number(a),
            mes: Number(m),
            qtd: 0,
            ultimo: null,
            tentado: true,
            tentativaEm: t.ultimo,
          });
          tentMap.delete(k);
        }
      }
      return out;
    };

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
    for (const t of (tentativas.data as RpcTentativa[] | null) ?? []) if (t.ano) anosSet.add(t.ano);

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
    // Ensure rows exist for any orgao that has only attempts (no contracts yet)
    for (const [k] of tentMap) {
      const [f, e] = k.split("|");
      if (f === "cgu" && e && !cguMap.has(e)) cguMap.set(e, []);
    }
    const linhasCgu: Linha[] = Array.from(cguMap.entries()).map(([cod, celulas]) => ({
      id: cod,
      label: cod,
      celulas: marcarTentativas("cgu", cod, celulas),
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
    for (const [k] of tentMap) {
      const [f, e] = k.split("|");
      if (f === "cgu_licitacoes" && e && !cguLicMap.has(e)) cguLicMap.set(e, []);
    }
    const linhasCguLic: Linha[] = Array.from(cguLicMap.entries()).map(([cod, celulas]) => ({
      id: cod,
      label: cod,
      celulas: marcarTentativas("cgu_licitacoes", cod, celulas),
    }));

    const linhaUnica = (rows: RpcRow[] | null, id: string, label: string): Linha[] => [
      {
        id,
        label,
        celulas: marcarTentativas(
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
      return [{ id, label, celulas: marcarTentativas(id, "", celulas) }];
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
      celulas: marcarTentativas("siconfi", tipo, celulas),
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
    const { error } = await supabaseAdmin.from("importacoes").insert({
      fonte: data.fonte,
      escopo: data.escopo ?? "",
      ano: data.ano,
      mes: data.mes,
      total_bruto: data.registros,
      importados: data.registros,
      erros: data.erro ? [data.erro] : [],
      user_id: context.userId,
      endpoint: data.endpoint ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
