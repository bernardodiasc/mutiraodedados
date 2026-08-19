import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { calcularNotaTransparencia, type NotaTransparencia } from "@/lib/transparencia";
import type { Contrato } from "@/lib/data/types";
import type { Dataset } from "@/lib/data/source";
import { ORGAOS_BASE } from "@/lib/data/catalog";

export type LinhaRanking = {
  fonte: "cgu" | "pncp";
  id: string;
  nome: string;
  sigla: string;
  funcao: string;
  esfera?: string | null;
  uf?: string | null;
  nota: NotaTransparencia;
};

export type RankingITIResult = {
  geradoEm: string;
  linhas: LinhaRanking[];
};

function normalizarModalidade(s: string | null | undefined): Contrato["modalidade"] {
  const t = (s ?? "").toLowerCase();
  if (t.includes("preg")) return "pregao";
  if (t.includes("concorr")) return "concorrencia";
  if (t.includes("inexig")) return "inexigibilidade";
  return "dispensa";
}

function emptyDS(): Dataset {
  return { orgaos: [], fornecedores: [], contratos: [] };
}

async function fetchAllPaginated<T>(
  table: string,
  columns: string,
  pageSize = 1000,
  maxPages = 100,
): Promise<T[]> {
  const all: T[] = [];
  for (let page = 0; page < maxPages; page++) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data, error } =
      await // eslint-disable-next-line @typescript-eslint/no-explicit-any -- `from` é tipado com os nomes literais de tabela do Database gerado; nome dinâmico exige escape
      (supabaseAdmin.from as (t: string) => any)(table).select(columns).range(from, to);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as T[];
    all.push(...rows);
    if (rows.length < pageSize) break;
  }
  return all;
}

type CguRow = {
  id: string;
  orgao_cod: string;
  fornecedor_cnpj: string;
  objeto: string | null;
  modalidade: string | null;
  valor: number | string | null;
  ano: number;
  data_assinatura: string | null;
};

type PncpRow = {
  id: string;
  orgao_cnpj: string;
  orgao_nome: string;
  esfera: string | null;
  poder: string | null;
  uf: string | null;
  objeto: string | null;
  modalidade: string | null;
  fornecedor_cnpj_cpf: string | null;
  valor_global: number | string | null;
  ano: number;
  data_assinatura: string | null;
};

export const rankingITI = createServerFn({ method: "GET" }).handler(
  async (): Promise<RankingITIResult> => {
    const [cguRows, pncpRows] = await Promise.all([
      fetchAllPaginated<CguRow>(
        "contratos_cache",
        "id,orgao_cod,fornecedor_cnpj,objeto,modalidade,valor,ano,data_assinatura",
      ),
      fetchAllPaginated<PncpRow>(
        "pncp_contratos_cache",
        "id,orgao_cnpj,orgao_nome,esfera,poder,uf,objeto,modalidade,fornecedor_cnpj_cpf,valor_global,ano,data_assinatura",
      ),
    ]);

    const linhas: LinhaRanking[] = [];

    // ===== CGU: contratos do Executivo federal =====
    const cguByOrgao = new Map<string, Contrato[]>();
    for (const r of cguRows) {
      const c: Contrato = {
        id: r.id,
        orgaoCod: r.orgao_cod,
        fornecedorCnpj: r.fornecedor_cnpj,
        objeto: r.objeto ?? "",
        modalidade: normalizarModalidade(r.modalidade),
        valor: Number(r.valor) || 0,
        ano: r.ano,
        dataAssinatura: r.data_assinatura ?? "",
      };
      const list = cguByOrgao.get(r.orgao_cod) ?? [];
      list.push(c);
      cguByOrgao.set(r.orgao_cod, list);
    }
    const catalogo = new Map(ORGAOS_BASE.map((o) => [o.cod, o]));
    for (const [cod, contratos] of cguByOrgao) {
      const ds: Dataset = { ...emptyDS(), contratos };
      const nota = calcularNotaTransparencia(ds, cod);
      if (nota.amostra === 0) continue;
      const meta = catalogo.get(cod);
      linhas.push({
        fonte: "cgu",
        id: cod,
        nome: meta?.nome ?? cod,
        sigla: meta?.sigla ?? cod,
        funcao: meta?.funcao ?? "—",
        nota,
      });
    }

    // ===== PNCP: contratos União/Estados/Municípios =====
    const pncpByOrgao = new Map<
      string,
      {
        meta: Omit<
          PncpRow,
          | "id"
          | "objeto"
          | "modalidade"
          | "fornecedor_cnpj_cpf"
          | "valor_global"
          | "ano"
          | "data_assinatura"
        >;
        contratos: Contrato[];
      }
    >();
    for (const r of pncpRows) {
      const cod = r.orgao_cnpj;
      const c: Contrato = {
        id: r.id,
        orgaoCod: cod,
        fornecedorCnpj: r.fornecedor_cnpj_cpf ?? "—",
        objeto: r.objeto ?? "",
        modalidade: normalizarModalidade(r.modalidade),
        valor: Number(r.valor_global) || 0,
        ano: r.ano,
        dataAssinatura: r.data_assinatura ?? "",
      };
      const cur = pncpByOrgao.get(cod);
      if (cur) {
        cur.contratos.push(c);
      } else {
        pncpByOrgao.set(cod, {
          meta: {
            orgao_cnpj: r.orgao_cnpj,
            orgao_nome: r.orgao_nome,
            esfera: r.esfera,
            poder: r.poder,
            uf: r.uf,
          },
          contratos: [c],
        });
      }
    }
    for (const [cnpj, { meta, contratos }] of pncpByOrgao) {
      const ds: Dataset = { ...emptyDS(), contratos };
      const nota = calcularNotaTransparencia(ds, cnpj);
      if (nota.amostra === 0) continue;
      const funcao = [meta.esfera, meta.poder, meta.uf].filter(Boolean).join(" · ") || "PNCP";
      linhas.push({
        fonte: "pncp",
        id: cnpj,
        nome: meta.orgao_nome,
        sigla: cnpj,
        funcao,
        esfera: meta.esfera,
        uf: meta.uf,
        nota,
      });
    }

    linhas.sort((a, b) => b.nota.nota - a.nota.nota);
    return { geradoEm: new Date().toISOString(), linhas };
  },
);
