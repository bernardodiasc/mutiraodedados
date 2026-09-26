import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { rodarComOrcamento } from "@/lib/data/runner";
import { checkpointImportacao } from "@/lib/data/checkpoint.server";
import { reacaoAoErro } from "@/lib/data/erro-origem";
import { registrarRodadaImportacao } from "@/lib/data/historico.server";
import type { OrigemRodada } from "@/lib/data/historico-rodada";
import { JANELA_ORCAMENTO_MS, JANELA_TETO_SUBREQUISICOES } from "@/lib/data/janela-varredura";
import { fetchComRetry } from "@/lib/data/http-retry";
import { UF_LIST } from "@/lib/admin-entes/logic";

/**
 * IBGE — cadastro de municípios, sob o contrato de fonte (v0.7.0).
 *
 * Antes deste módulo, a lista de municípios era baixada pelo NAVEGADOR a cada
 * uso do combobox (5.570 registros por abertura) e a de UFs era constante no
 * código. Agora o cadastro vive em `ibge_municipios_cache`, alimentado aqui:
 * um passo = uma UF, retomável, com linha de rodada no Histórico (id `ibge`).
 *
 * É cadastro vigente, não série temporal — não há janela; a "cobertura" é a
 * contagem e a última atualização, como deputados e senadores.
 */

const BASE = "https://servicodados.ibge.gov.br/api/v1/localidades";
const UA = "MutiraoDeDados/1.0 (+https://mutiraodedados.com.br)";

type MunicipioIBGE = {
  id?: number;
  nome?: string;
  microrregiao?: { mesorregiao?: { UF?: { sigla?: string } } };
  // A API v1 também expõe regiao-imediata (divisão de 2017) — fallback.
  "regiao-imediata"?: { "regiao-intermediaria"?: { UF?: { sigla?: string } } };
};

async function ensureAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error("Falha ao verificar permissão.");
  if (data?.role !== "admin") throw new Error("Acesso restrito.");
}

function siglaDe(m: MunicipioIBGE): string | null {
  return (
    m.microrregiao?.mesorregiao?.UF?.sigla ??
    m["regiao-imediata"]?.["regiao-intermediaria"]?.UF?.sigla ??
    null
  );
}

/** Chave da varredura do cadastro — a mesma para painel, fila e ferramenta. */
export const CHAVE_VARREDURA_IBGE = "ibge#municipios";

/** Município que a importação descarta: sem código de 7 dígitos ou sem nome. */
const municipioIlegivel = (codigo: string, nome: string) =>
  !/^\d{7}$/.test(codigo) || nome.length === 0;

/**
 * Total da origem: a lista nacional de municípios numa chamada só (visão
 * nivelada, ~2 MB) — é a soma das listas por UF que a varredura percorre. Os
 * ilegíveis contam como descartados.
 */
export async function totalDaOrigemIBGE(): Promise<{ total: number; descartados: number }> {
  const res = await fetchComRetry(`${BASE}/municipios?view=nivelado`, {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`IBGE ${res.status} (lista nacional de municípios)`);
  const lista = (await res.json()) as { "municipio-id"?: number; "municipio-nome"?: string }[];
  return {
    total: lista.length,
    descartados: lista.filter((m) =>
      municipioIlegivel(String(m["municipio-id"] ?? ""), m["municipio-nome"] ?? ""),
    ).length,
  };
}

/** Núcleo chamável sem browser (v0.11.0) — usado pela casca autenticada e pelo agendador. */
export async function rodadaMunicipiosIBGE(userId: string | null, origem: OrigemRodada = {}) {
  const erros: string[] = [];
  const inicioRodada = Date.now();
  // Ordem estável por código — o cursor da retomada depende dela.
  const ufs = [...UF_LIST].sort((a, b) => a.codigo.localeCompare(b.codigo));

  const rodada = await rodarComOrcamento({
    chave: CHAVE_VARREDURA_IBGE,
    checkpoint: checkpointImportacao,
    orcamentoMs: JANELA_ORCAMENTO_MS,
    orcamentoCusto: JANELA_TETO_SUBREQUISICOES,
    maxPassos: ufs.length,
    passo: async (cursor) => {
      if (cursor > ufs.length) return { processados: 0, fim: true };
      const uf = ufs[cursor - 1];
      let custo = 0;

      let lista: MunicipioIBGE[];
      try {
        const res = await fetchComRetry(`${BASE}/estados/${uf.uf}/municipios`, {
          headers: { "User-Agent": UA, Accept: "application/json" },
        });
        custo++;
        if (!res.ok) throw new Error(`IBGE ${res.status} (${uf.uf})`);
        lista = (await res.json()) as MunicipioIBGE[];
      } catch (e) {
        const r = reacaoAoErro(e);
        return {
          processados: 0,
          fim: false,
          custo: custo || 1,
          interromper: r.interromper,
          erros: [`${uf.uf}: ${(e as Error).message}`],
        };
      }

      const rows = lista
        .map((m) => ({
          codigo: String(m.id ?? ""),
          nome: m.nome ?? "",
          uf: siglaDe(m) ?? uf.uf ?? "",
          updated_at: new Date().toISOString(),
        }))
        .filter((r) => !municipioIlegivel(r.codigo, r.nome) && r.uf.length === 2);

      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await supabaseAdmin
          .from("ibge_municipios_cache")
          .upsert(rows.slice(i, i + 500));
        custo++;
        if (error) {
          const r = reacaoAoErro(new Error(error.message));
          return {
            processados: 0,
            fim: false,
            custo,
            interromper: r.interromper,
            erros: [`db ${uf.uf}: ${error.message}`],
          };
        }
      }
      return { processados: rows.length, fim: cursor === ufs.length, custo };
    },
  });

  erros.push(...rodada.erros);

  const avisoHistorico = await registrarRodadaImportacao(
    {
      fonte: "ibge",
      escopo: "municípios",
      endpoint: `GET ${BASE}/estados/{uf}/municipios`,
      unidade: "UFs",
      userId: userId,
      ...origem,
      duracaoMs: Date.now() - inicioRodada,
    },
    rodada,
  );
  if (avisoHistorico) erros.push(avisoHistorico);

  return {
    importados: rodada.processados,
    erros,
    varredura: {
      haMais: !rodada.concluido,
      cursor: rodada.cursorFinal,
      totalAcumulado: rodada.totalAcumulado,
      orcamentoEsgotado: rodada.orcamentoEsgotado,
      custoEsgotado: rodada.custoEsgotado,
    },
  };
}

/**
 * Parâmetros da importação (nenhum: é o cadastro inteiro) — o mesmo schema
 * na casca autenticada e no modo nomeado de `/api/cron-importar`.
 */
export const importarMunicipiosIBGESchema = z.object({});

export const importarMunicipiosIBGE = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => importarMunicipiosIBGESchema.parse(input ?? {}))
  .handler(async ({ context }) => {
    await ensureAdmin(context.userId);
    return rodadaMunicipiosIBGE(context.userId);
  });

/** Lista o cadastro de municípios do cache (leitura pública). */
export const listarMunicipiosIbge = createServerFn({ method: "GET" }).handler(async () => {
  const acc: { codigo: string; nome: string; uf: string }[] = [];
  // O PostgREST pagina em 1000; o cadastro tem ~5.570 municípios.
  for (let de = 0; de < 6000; de += 1000) {
    const { data, error } = await supabaseAdmin
      .from("ibge_municipios_cache")
      .select("codigo,nome,uf")
      .order("codigo")
      .range(de, de + 999);
    if (error) throw new Error(error.message);
    acc.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return { municipios: acc };
});
