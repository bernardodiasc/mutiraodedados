/**
 * A ordem entre fontes da ferramenta `bun run importar`: a tabela de
 * dependências. Quem pede várias tarefas de uma vez (ou `--todas`) recebe-as
 * nesta ordem, e uma fonte que para bloqueia só as que dependem dela — as
 * outras seguem.
 *
 * A tabela declara todas as tarefas previstas no modo nomeado, tenham ou não
 * adaptador hoje. Tarefa sem adaptador é pulada com aviso (ver
 * `executarFontes`); ganhar o adaptador basta para ela entrar na rodada, sem
 * mexer aqui. Tarefa nova, fora desta lista, entra na etapa certa com as suas
 * dependências — o teste da tabela acusa adaptador que não está nela.
 *
 * `dependeDe` lista só as dependências que a importação exige (sem elas o
 * dado não entra, ou entra sem vínculo): a CEAP precisa do cadastro da
 * legislatura; o enriquecimento pela origem só atualiza convênios que já
 * existem; a ponte precisa dos candidatos e dos dois cadastros; os
 * cruzamentos precisam do TSE, da ponte e, no doador↔fornecedor, dos
 * contratos da CGU. CGU por órgão usa por padrão os órgãos ativos do
 * catálogo SIAFI.
 *
 * O TSE é uma tarefa só (`tse_arquivo`, arquivo tipo × ano × UF): candidatos
 * vêm antes de bens, receitas, despesas e resultados dentro dela, na ordem
 * das janelas pendentes da própria tarefa.
 */

export type TarefaDaTabela = { tarefa: string; dependeDe: string[] };

export type Etapa = { nome: string; tarefas: TarefaDaTabela[] };

const t = (tarefa: string, ...dependeDe: string[]): TarefaDaTabela => ({ tarefa, dependeDe });

export const ETAPAS: Etapa[] = [
  {
    nome: "cadastros",
    tarefas: [
      t("camara_cadastro"),
      t("camara_trajetoria", "camara_cadastro"),
      t("senado_cadastro"),
      t("cgu_siafi"),
      t("cgu_atividade", "cgu_siafi"),
      t("ibge"),
    ],
  },
  {
    nome: "dados de base",
    tarefas: [
      t("camara_vot"),
      t("senado_vot"),
      t("camara_props"),
      t("senado_mat"),
      t("camara_ceap", "camara_cadastro"),
      t("senado_ceaps"),
      t("pncp"),
      t("convenios"),
      t("transferegov"),
      t("cgu_contratos", "cgu_siafi", "cgu_atividade"),
      t("cgu_licitacoes", "cgu_siafi", "cgu_atividade"),
      t("cgu_emendas"),
      t("siconfi_relatorio"),
      t("siconfi_ano"),
      t("siconfi_varredura", "ibge"),
    ],
  },
  {
    nome: "enriquecimento pela origem",
    tarefas: [t("convenios_origem", "convenios", "transferegov")],
  },
  {
    nome: "TSE: candidatos, depois bens, receitas, despesas e resultados",
    tarefas: [t("tse_arquivo")],
  },
  {
    nome: "vínculo parlamentar↔candidato",
    tarefas: [t("tse_ponte", "camara_cadastro", "senado_cadastro", "tse_arquivo")],
  },
  {
    nome: "cruzamentos",
    tarefas: [
      t("tse_lacunas", "tse_arquivo", "tse_ponte"),
      t("tse_sinais", "tse_arquivo", "tse_ponte"),
      t("cruzamento_doador_fornecedor", "tse_arquivo", "tse_ponte", "cgu_contratos"),
    ],
  },
];

/** Todas as tarefas da tabela, na ordem em que rodam. */
export const ORDEM: string[] = ETAPAS.flatMap((e) => e.tarefas.map((x) => x.tarefa));

const DEPENDENCIAS = new Map(ETAPAS.flatMap((e) => e.tarefas.map((x) => [x.tarefa, x.dependeDe])));

/** As tarefas pedidas, na ordem da tabela. Recusa id que a tabela não conhece. */
export function naOrdem(tarefas: readonly string[]): string[] {
  const desconhecidas = tarefas.filter((x) => !DEPENDENCIAS.has(x));
  if (desconhecidas.length) {
    throw new Error(`tarefa desconhecida: ${desconhecidas.join(", ")}`);
  }
  return ORDEM.filter((x) => tarefas.includes(x));
}

/**
 * A fonte parada de que a tarefa depende, direta ou indiretamente; `null`
 * quando nenhuma dependência dela parou.
 */
export function bloqueadaPor(tarefa: string, paradas: ReadonlySet<string>): string | null {
  for (const d of DEPENDENCIAS.get(tarefa) ?? []) {
    if (paradas.has(d)) return d;
    const indireta = bloqueadaPor(d, paradas);
    if (indireta) return indireta;
  }
  return null;
}
