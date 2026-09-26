/**
 * Modo nomeado — um arquivo do TSE (`tse_arquivo`): tipo × ano × UF.
 *
 * Janela natural: o arquivo de uma eleição numa UF. A rodada é a mesma do
 * painel (`sincronizarArquivoTse`), sem operador; bens, receitas e despesas
 * retomam por contagem de linhas em `tse_varredura`, candidatos e resultados
 * leem o arquivo inteiro numa rodada. A origem não informa total: a contagem
 * "não se aplica", e o reflexo na cobertura conta os registros da eleição e
 * da UF no cache (em bens, as fichas de candidato com o total declarado).
 *
 * O Histórico grava `fonte = tse_<tipo>`, `escopo = <ano>-<UF>` e `mes` 1 (a
 * âncora da janela anual). As pendentes percorrem a matriz inteira
 * (`tse/matriz.ts`): da eleição mais recente para a mais antiga e, em cada
 * uma, candidatos antes dos demais tipos; `params` aceita `tipo` e `uf` para
 * restringir.
 */
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { arquivoTseSchema } from "@/lib/data/tse/ingest.functions";
import { checkpointTse, sincronizarArquivoTse } from "@/lib/data/tse/ingest.server";
import { TSE_TIPOS_ARQUIVO, TSE_UFS, montarChaveTse } from "@/lib/data/tse/client-ckan";
import { arquivosPendentes } from "@/lib/data/tse/matriz";
import { lerConferencias } from "@/lib/data/automacao/conferencia.server";
import type { Adaptador } from "@/lib/data/automacao/adaptador";
import { textoDoErroDoBanco } from "@/lib/data/erros-banco";

type Params = z.infer<typeof arquivoTseSchema>;

const TABELA = {
  candidatos: "tse_candidatos_cache",
  receitas: "tse_receitas_campanha_cache",
  despesas: "tse_despesas_campanha_cache",
  resultados: "tse_resultados_cache",
} as const;

/**
 * Registros da eleição e da UF no cache. Bens não guardam a UF: conta as
 * fichas de candidato da UF com o total declarado, que a importação de bens
 * preenche.
 */
async function contarNaCelula(p: Params): Promise<number> {
  const consulta =
    p.tipo === "bens"
      ? supabaseAdmin
          .from("tse_candidatos_cache")
          .select("sq_candidato", { count: "exact" })
          .eq("ano_eleicao", p.ano)
          .eq("uf", p.uf)
          .not("bens_total_declarado", "is", null)
      : supabaseAdmin
          .from(TABELA[p.tipo])
          .select("sq_candidato", { count: "exact" })
          .eq("ano_eleicao", p.ano)
          .eq("uf", p.uf);
  const { count, error, status } = await consulta.limit(0);
  if (error)
    throw new Error(
      `conferência: contagem do TSE (${p.tipo}): ${textoDoErroDoBanco(error, status)}`,
    );
  return count ?? 0;
}

const filtroDasPendentes = z.object({
  tipo: z.enum(TSE_TIPOS_ARQUIVO).optional(),
  uf: z.enum(TSE_UFS).optional(),
});

export const adaptadorTseArquivo: Adaptador<Params> = {
  schema: arquivoTseSchema,
  fonte: (p) => `tse_${p.tipo}`,
  chave: (p) => montarChaveTse(p.tipo, p.ano, p.uf),
  checkpoint: checkpointTse,
  granularidade: "ano",
  escopo: (p) => `${p.ano}-${p.uf}`,
  janela: (p) => ({ ano: p.ano, mes: 1 }),
  contarNaCelula,
  descricao: (p) => `TSE: ${p.tipo} de ${p.ano} (${p.uf})`,
  unidades: ["registros"],
  rodada: async (p, origem) => {
    // O modo nomeado só chega aqui com varredura completa quando pediu
    // `reprocessar`: o núcleo recomeça do zero, como o runner das outras fontes.
    const estado = await checkpointTse.ler(montarChaveTse(p.tipo, p.ano, p.uf));
    const r = await sincronizarArquivoTse({
      ...p,
      userId: null,
      origem,
      reprocessar: estado?.completa ?? false,
    });
    return {
      importados: { registros: r.importados },
      erros: r.erros,
      varredura: {
        haMais: r.haMais,
        cursor: r.linhasProcessadas,
        totalAcumulado: r.totalAcumulado,
        orcamentoEsgotado: r.haMais,
        custoEsgotado: false,
      },
      origem: null,
    };
  },
  pendentes: async (params) => {
    const filtro = filtroDasPendentes.safeParse(params ?? {});
    if (!filtro.success) return { recusa: `tse_arquivo: ${z.prettifyError(filtro.error)}` };
    const tipos = filtro.data.tipo ? [filtro.data.tipo] : TSE_TIPOS_ARQUIVO;
    const conferencias = Object.fromEntries(
      await Promise.all(tipos.map(async (t) => [t, await lerConferencias(`tse_${t}`)] as const)),
    );
    return arquivosPendentes(conferencias, filtro.data);
  },
};
