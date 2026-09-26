/**
 * A matriz de arquivos do TSE — tipo × ano × UF —, a unidade da importação
 * sob demanda (`tse_arquivo`). Lógica pura: a ferramenta a usa para fatiar um
 * intervalo em arquivos, e a rota, para dizer quais estão pendentes.
 *
 * Ordem: da eleição mais recente para a mais antiga; dentro da eleição,
 * candidatos antes de bens, receitas, despesas e resultados (os demais
 * referenciam o catálogo de candidatos); dentro do tipo, as UFs na ordem de
 * `TSE_UFS`. Só entram as combinações que o TSE publica (`combinacaoValida`).
 *
 * Na janela da ferramenta, o arquivo vai no `escopo` como `<tipo>/<UF>` (ex.:
 * `bens/AC`); o Histórico grava `fonte = tse_<tipo>` e `escopo = <ano>-<UF>`.
 */
import type { ConferenciaGravada, JanelaPendente } from "@/lib/data/automacao/conferencia";
import { dentroDaJanelaAnual } from "@/lib/data/janelas";
import {
  TSE_ANOS_ELEICAO,
  TSE_TIPOS_ARQUIVO,
  TSE_UFS,
  combinacaoValida,
  type TseTipoArquivo,
} from "@/lib/data/tse/client-ckan";

export type ArquivoTse = { tipo: TseTipoArquivo; uf: (typeof TSE_UFS)[number] };

/** Restringe a matriz a um tipo e/ou uma UF. */
export type FiltroArquivos = { tipo?: string; uf?: string };

/** Os arquivos publicados de uma eleição, na ordem de importação. */
export function arquivosDaEleicao(ano: number, filtro: FiltroArquivos = {}): ArquivoTse[] {
  if (!ehEleicao(ano)) return [];
  const arquivos: ArquivoTse[] = [];
  for (const tipo of TSE_TIPOS_ARQUIVO) {
    if (filtro.tipo && filtro.tipo !== tipo) continue;
    for (const uf of TSE_UFS) {
      if (filtro.uf && filtro.uf !== uf) continue;
      if (combinacaoValida(tipo, ano, uf)) arquivos.push({ tipo, uf });
    }
  }
  return arquivos;
}

/** O ano é de uma eleição coberta pela fonte? */
export const ehEleicao = (ano: number) => (TSE_ANOS_ELEICAO as readonly number[]).includes(ano);

/** As eleições dentro da janela de disponibilidade, da mais recente à mais antiga. */
export function eleicoesNaJanela(hoje: Date = new Date()): number[] {
  return [...TSE_ANOS_ELEICAO].filter((a) => dentroDaJanelaAnual("tse", a, hoje)).reverse();
}

/** O arquivo no `escopo` da janela da ferramenta. */
export const escopoDoArquivo = (a: { tipo: string; uf: string }) => `${a.tipo}/${a.uf}`;

/** O arquivo de volta do `escopo`; `null` quando não é `<tipo>/<UF>`. */
export function arquivoDoEscopo(escopo: string | undefined): { tipo: string; uf: string } | null {
  const m = escopo?.match(/^([a-z]+)\/([A-Z]{2})$/);
  return m ? { tipo: m[1], uf: m[2] } : null;
}

/**
 * Os arquivos da matriz cuja última conferência não é aprovada — nunca
 * conferidos, reprovados ou inconclusivos —, na ordem de importação. As
 * conferências vêm por tipo, com o `escopo` do Histórico (`<ano>-<UF>`).
 */
export function arquivosPendentes(
  conferenciasPorTipo: Partial<Record<TseTipoArquivo, readonly ConferenciaGravada[]>>,
  filtro: FiltroArquivos = {},
  hoje: Date = new Date(),
): JanelaPendente[] {
  const ultima = new Map<string, ConferenciaGravada>();
  for (const [tipo, conferencias] of Object.entries(conferenciasPorTipo)) {
    for (const c of conferencias ?? []) {
      const k = `${tipo}#${c.escopo}`;
      const atual = ultima.get(k);
      if (!atual || c.consultado_em > atual.consultado_em) ultima.set(k, c);
    }
  }
  const pendentes: JanelaPendente[] = [];
  for (const ano of eleicoesNaJanela(hoje)) {
    for (const a of arquivosDaEleicao(ano, filtro)) {
      const u = ultima.get(`${a.tipo}#${ano}-${a.uf}`);
      if (u?.estado === "aprovada") continue;
      pendentes.push({
        ano,
        mes: 1,
        dataInicio: `${ano}-01-01`,
        dataFim: `${ano}-12-31`,
        escopo: escopoDoArquivo(a),
        ultima: u
          ? {
              estado: u.estado,
              motivo: u.motivo,
              execucao_id: u.execucao_id,
              consultado_em: u.consultado_em,
            }
          : null,
      });
    }
  }
  return pendentes;
}
