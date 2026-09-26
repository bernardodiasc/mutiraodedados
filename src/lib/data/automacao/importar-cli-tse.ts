/**
 * A ferramenta `bun run importar` com as tarefas do TSE e o CSV da origem —
 * a parte pura que `importar-cli.ts` registra nas suas tabelas.
 *
 * - `tse_arquivo`: o intervalo é por eleição (`AAAA` ou `AAAA..AAAA`); cada
 *   janela é UM arquivo — tipo × ano × UF —, com o arquivo no `escopo`
 *   (`bens/AC`). Anos sem eleição ficam de fora; em cada eleição, candidatos
 *   antes dos demais tipos (`tse/matriz.ts`). `--param tipo=` e `--param uf=`
 *   restringem a matriz, também na consulta de pendentes.
 * - `tse_ponte`: o cadastro de cada casa (`camara`, `senado`; `--param
 *   casa=` restringe). O `offset` do lote seguinte volta no `cursor` da
 *   resposta e vai na rodada seguinte.
 * - `tse_lacunas`, `tse_sinais`, `cruzamento_doador_fornecedor`: uma janela
 *   por eleição.
 * - `convenios_origem`: o CSV inteiro, sem intervalo.
 */
import type { Extras, Granularidade, Janela, Recorte } from "@/lib/data/automacao/importar-cli";
import {
  arquivoDoEscopo,
  arquivosDaEleicao,
  ehEleicao,
  escopoDoArquivo,
} from "@/lib/data/tse/matriz";

const anoDa = (j: Janela) => Number(j.dataInicio.slice(0, 4));
const opcional = (chave: string, valor: string | undefined) =>
  valor === undefined ? {} : { [chave]: valor };

const porEleicao = (j: Janela) => ({ ano: anoDa(j) });

export const PARAMS_DA_JANELA_TSE: Record<
  string,
  (j: Janela, r: Recorte, x: Extras) => Record<string, unknown>
> = {
  tse_arquivo: (j, _r, x) => {
    const a = arquivoDoEscopo(j.escopo) ?? { tipo: x.tipo, uf: x.uf };
    return { tipo: a.tipo, ano: anoDa(j), uf: a.uf };
  },
  tse_ponte: (j, _r, x) => opcional("casa", j.escopo ?? x.casa),
  tse_lacunas: porEleicao,
  tse_sinais: porEleicao,
  cruzamento_doador_fornecedor: porEleicao,
  convenios_origem: () => ({}),
};

export const GRANULARIDADE_TSE: Record<string, Granularidade> = {
  tse_arquivo: "ano",
  tse_ponte: "cadastro",
  tse_lacunas: "ano",
  tse_sinais: "ano",
  cruzamento_doador_fornecedor: "ano",
  convenios_origem: "cadastro",
};

export const PARAMS_DAS_PENDENTES_TSE: Record<string, (x: Extras) => Record<string, unknown>> = {
  tse_arquivo: (x) => ({ ...opcional("tipo", x.tipo), ...opcional("uf", x.uf) }),
  tse_ponte: (x) => opcional("casa", x.casa),
};

export const CURSOR_NO_PARAM_TSE: Record<string, string> = { tse_ponte: "offset" };

const CASAS = ["camara", "senado"];
const CRUZAMENTOS = new Set(["tse_lacunas", "tse_sinais", "cruzamento_doador_fornecedor"]);

/**
 * As janelas do intervalo nas tarefas do TSE: um arquivo por janela no
 * `tse_arquivo`, uma casa por janela na ponte, só os anos de eleição nos
 * cruzamentos. As demais tarefas passam como vieram.
 */
export function janelasDoTse(tarefa: string, janelas: Janela[], extras: Extras): Janela[] {
  if (tarefa === "tse_arquivo") {
    return janelas.flatMap((j) =>
      arquivosDaEleicao(anoDa(j), { tipo: extras.tipo, uf: extras.uf }).map((a) => ({
        ...j,
        escopo: escopoDoArquivo(a),
      })),
    );
  }
  if (tarefa === "tse_ponte") {
    const casas = extras.casa ? [extras.casa] : CASAS;
    return janelas.flatMap((j) => casas.map((escopo) => ({ ...j, escopo })));
  }
  if (CRUZAMENTOS.has(tarefa)) return janelas.filter((j) => ehEleicao(anoDa(j)));
  return janelas;
}
