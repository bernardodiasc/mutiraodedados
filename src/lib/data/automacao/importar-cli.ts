/**
 * Lógica pura da ferramenta `bun run importar` (o executável fica em
 * `scripts/importar.ts`): argumentos, fatiamento do intervalo em janelas e o
 * laço de rodadas de uma janela contra o modo nomeado de `/api/cron-importar`.
 *
 * Uma EXECUÇÃO é uma janela: a ferramenta gera um `execucao_id` por janela e
 * o manda em todas as rodadas dela, até a rota responder `haMais: false` — e
 * a última resposta traz a conferência da janela.
 *
 * Política de parada (por fonte; a ferramenta importa uma fonte por vez e,
 * com várias, segue a ordem da tabela de dependências — {@link executarFontes}):
 * - reprovada → a fonte para na hora;
 * - inconclusiva → re-tenta a janela uma vez, após uma pausa; persistindo, a
 *   janela fica pendente e a ferramenta segue; 3 janelas inconclusivas
 *   seguidas param a fonte (a origem parece fora do ar);
 * - teto de rodadas estourado → reprovada (laço);
 * - 429 persistente do Portal da Transparência → a fonte para sem re-tentar
 *   e as fontes da chave ficam pausadas (`cota-do-portal.ts`).
 *
 * Sem estado local: no modo "só pendentes" a lista de janelas vem da rota
 * (consulta de pendentes). Interromper e rodar de novo continua de onde
 * parou — as janelas aprovadas saem da lista, e a janela interrompida segue
 * do cursor da varredura.
 */
import type { EstadoConferencia, JanelaPendente } from "@/lib/data/automacao/conferencia";
import { ORDEM, bloqueadaPor, naOrdem } from "@/lib/data/automacao/dependencias";
import type { RespostaNomeada, RespostaPendentes } from "@/lib/data/automacao/nomeado";
import {
  MOTIVO_COTA,
  SAIDA_COTA_DO_PORTAL,
  avisoDePausa,
  esbarrouNaCota,
  usaChaveDoPortal,
} from "@/lib/data/automacao/cota-do-portal";
import { periodosDoTipo, type TipoRelatorio } from "@/lib/data/siconfi/consulta";
import { SIGLAS_MATERIA_SENADO, TIPOS_PROPOSICAO_CAMARA } from "@/lib/data/siglas-legislativas";
import {
  CURSOR_NO_PARAM_TSE,
  GRANULARIDADE_TSE,
  PARAMS_DAS_PENDENTES_TSE,
  PARAMS_DA_JANELA_TSE,
  janelasDoTse,
} from "@/lib/data/automacao/importar-cli-tse";

export type RespostaRodada = Omit<RespostaNomeada, "tarefa" | "params" | "execucao_id">;

/**
 * Uma janela da ferramenta. Na fonte anual, as datas vão de 1º de janeiro a
 * 31 de dezembro; no cadastro, ficam vazias; no SICONFI, `periodo` é o
 * período do relatório (ausente no anual); nas matérias e proposições,
 * `escopo` é a sigla ou o tipo. `reprocessar` vem da janela quando ela pede
 * (ver {@link janelasDasPendentes}).
 */
export type Janela = {
  dataInicio: string;
  dataFim: string;
  periodo?: number;
  escopo?: string;
  reprocessar?: boolean;
};

/**
 * Recorte além da janela: o órgão ou a lista de órgãos, separados por
 * vírgula (contratos e licitações da CGU), ou o ente (convênios por ente).
 * Vem das opções `--orgao`, `--uf` e `--municipio`.
 */
export type Recorte = { orgao?: string; uf?: string; municipio?: string };

/**
 * Tarefas da CGU por órgão: cada janela é um mês de UM órgão, com o órgão no
 * `escopo` da janela. Com `--orgao`, os órgãos pedidos; sem ele, no modo "só
 * pendentes", os órgãos ativos do catálogo SIAFI (a lista vem da rota).
 */
const TAREFAS_POR_ORGAO = new Set(["cgu_contratos", "cgu_licitacoes"]);

/** Os códigos de `--orgao` (um, ou vários separados por vírgula). */
export function orgaosDoRecorte(r: Recorte = {}): string[] {
  if (!r.orgao) return [];
  const orgaos = r.orgao.split(",").map((o) => o.trim());
  const invalido = orgaos.find((o) => !/^\d{4,6}$/.test(o));
  if (invalido !== undefined) throw new Error(`código de órgão inválido: "${invalido}"\n${USO}`);
  return [...new Set(orgaos)];
}

/** O órgão de uma janela por órgão: o do `escopo`, ou o único de `--orgao`. */
function orgaoDaJanela(j: Janela, r: Recorte): string {
  const orgao = j.escopo ?? orgaosDoRecorte(r)[0];
  if (!orgao) throw new Error(`janela sem órgão\n${USO}`);
  return orgao;
}

/** Parâmetros próprios da tarefa, de `--param chave=valor` (ex.: a sigla das matérias). */
export type Extras = Record<string, string>;

const DATAS_DO_PORTAL = (j: Janela) => ({ dataInicial: j.dataInicio, dataFinal: j.dataFim });
const anoMes = (j: Janela) => ({
  ano: Number(j.dataInicio.slice(0, 4)),
  mes: Number(j.dataInicio.slice(5, 7)),
});
const anoDa = (j: Janela) => Number(j.dataInicio.slice(0, 4));
/** Só as chaves presentes, com o tipo que o schema da tarefa espera. */
const opcional = (chave: string, valor: string | undefined, numero = false) =>
  valor === undefined ? {} : { [chave]: numero ? Number(valor) : valor };

/** Tarefas com modo nomeado e como cada uma recebe a janela, o recorte e os `--param`. */
const PARAMS_DA_JANELA: Record<
  string,
  (j: Janela, r: Recorte, x: Extras) => Record<string, unknown>
> = {
  camara_vot: (j) => ({ dataInicio: j.dataInicio, dataFim: j.dataFim }),
  senado_vot: (j) => ({ dataInicio: j.dataInicio, dataFim: j.dataFim }),
  cgu_licitacoes: (j, r) => ({ codigoOrgao: orgaoDaJanela(j, r), ...DATAS_DO_PORTAL(j) }),
  cgu_contratos: (j, r) => ({ codigoOrgao: orgaoDaJanela(j, r), ...DATAS_DO_PORTAL(j) }),
  cgu_siafi: () => ({}),
  cgu_atividade: () => ({}),
  cgu_emendas: (j) => ({ ano: Number(j.dataInicio.slice(0, 4)) }),
  transferegov: (j, r) => ({ ...DATAS_DO_PORTAL(j), ...RECORTE_DA_TAREFA.transferegov(r) }),
  pncp: (j, _r, x) => ({
    ...DATAS_DO_PORTAL(j),
    ...opcional("uf", x.uf),
    ...opcional("municipioIbge", x.municipioIbge),
    ...opcional("cnpjOrgao", x.cnpjOrgao),
  }),
  convenios: (j) => DATAS_DO_PORTAL(j),
  camara_ceap: (j, _r, x) => ({ ...anoMes(j), ...opcional("deputadoId", x.deputadoId, true) }),
  senado_ceaps: (j, _r, x) => ({ ...anoMes(j), ...opcional("senadorId", x.senadorId, true) }),
  senado_mat: (j, _r, x) => ({ ano: anoDa(j), ...opcional("sigla", j.escopo ?? x.sigla) }),
  camara_props: (j, _r, x) => ({
    ano: anoDa(j),
    ...opcional("siglaTipo", j.escopo ?? x.siglaTipo),
  }),
  ibge: () => ({}),
  camara_cadastro: (_j, _r, x) => opcional("idLegislatura", x.idLegislatura, true),
  siconfi_relatorio: (j, _r, x) => ({
    codIbge: x.codIbge,
    tipoRelatorio: x.tipoRelatorio,
    exercicio: anoDa(j),
    ...(j.periodo ? { periodo: j.periodo } : {}),
    ...opcional("anexo", x.anexo),
  }),
  senado_cadastro: () => ({}),
  camara_trajetoria: (_j, _r, x) => opcional("idLegislatura", x.idLegislatura, true),
  siconfi_ano: (j, _r, x) => ({ codIbge: x.codIbge, exercicio: anoDa(j) }),
  siconfi_varredura: (j, _r, x) => ({
    conjunto: x.conjunto,
    ...opcional("uf", x.uf),
    ...opcional("codIbge", x.codIbge),
    exercicioInicial: anoDa(j),
    exercicioFinal: anoDa(j),
  }),
  ...PARAMS_DA_JANELA_TSE,
};

/**
 * Tarefas cujo progresso volta a quem chama: o `cursor` de uma rodada vai no
 * parâmetro indicado da rodada seguinte (a trajetória não guarda o offset no
 * servidor). Uma execução nova começa sem ele — do início.
 */
const CURSOR_NO_PARAM: Record<string, string> = {
  camara_trajetoria: "offset",
  ...CURSOR_NO_PARAM_TSE,
};

/**
 * Tarefas com recorte: os parâmetros dele, que também vão na consulta de
 * pendentes (a pendência é da linha da matriz — o órgão, o ente).
 */
const recorteDoOrgao = (r: Recorte): Record<string, unknown> => {
  const orgaos = orgaosDoRecorte(r);
  if (orgaos.length === 0) return {};
  return orgaos.length === 1 ? { codigoOrgao: orgaos[0] } : { codigosOrgao: orgaos };
};

const RECORTE_DA_TAREFA: Record<string, (r: Recorte) => Record<string, unknown>> = {
  cgu_licitacoes: recorteDoOrgao,
  cgu_contratos: recorteDoOrgao,
  transferegov: (r) => {
    if (r.uf && r.municipio) throw new Error(`informe --uf ou --municipio, não os dois\n${USO}`);
    return {
      ...(r.municipio ? { codigoIbgeMunicipio: r.municipio } : {}),
      ...(r.uf ? { codigoUF: r.uf } : {}),
    };
  },
};

/** Opções de recorte que cada tarefa aceita, e as que ela exige. */
const RECORTE_ACEITO: Record<string, (keyof Recorte)[]> = {
  cgu_contratos: ["orgao"],
  cgu_licitacoes: ["orgao"],
  transferegov: ["uf", "municipio"],
};

/**
 * O recorte obrigatório que falta para a tarefa rodar, ou `null`. As tarefas
 * por órgão exigem `--orgao` só com intervalo explícito: no modo "só
 * pendentes", sem ele, percorrem os órgãos ativos do catálogo.
 */
export function recorteQueFalta(
  tarefa: string,
  recorte: Recorte = {},
  pendentes = false,
): string | null {
  if (TAREFAS_POR_ORGAO.has(tarefa) && !pendentes && !recorte.orgao) {
    return "--orgao (ou --pendentes, que percorre os órgãos ativos do catálogo)";
  }
  return null;
}

/**
 * Como a tarefa fatia o intervalo: `mes` (o padrão), `ano` (a origem é
 * consultada por ano inteiro), `cadastro` (uma janela só, sem intervalo) ou
 * `periodo` (os períodos do relatório do SICONFI em cada exercício).
 */
export type Granularidade = "mes" | "ano" | "cadastro" | "periodo";

const GRANULARIDADE: Record<string, Granularidade> = {
  cgu_emendas: "ano",
  senado_mat: "ano",
  camara_props: "ano",
  ibge: "cadastro",
  camara_cadastro: "cadastro",
  cgu_siafi: "cadastro",
  cgu_atividade: "cadastro",
  siconfi_relatorio: "periodo",
  senado_cadastro: "cadastro",
  camara_trajetoria: "cadastro",
  siconfi_ano: "ano",
  siconfi_varredura: "ano",
  ...GRANULARIDADE_TSE,
};

export const granularidadeDa = (tarefa: string): Granularidade => GRANULARIDADE[tarefa] ?? "mes";

/** `--param` sem os quais a tarefa não roda. */
const PARAMS_OBRIGATORIOS: Record<string, string[]> = {
  siconfi_relatorio: ["codIbge", "tipoRelatorio"],
  siconfi_ano: ["codIbge"],
  siconfi_varredura: ["conjunto"],
};

/** Os `--param` obrigatórios da tarefa que não vieram. */
export const paramsFaltando = (tarefa: string, params: Extras = {}) =>
  (PARAMS_OBRIGATORIOS[tarefa] ?? []).filter((k) => !params[k]);

/**
 * `--param` que a consulta de pendentes da tarefa usa: o ente e o relatório
 * do SICONFI; a sigla das matérias ou o tipo das proposições, quando dados.
 */
const PARAMS_DAS_PENDENTES: Record<string, (x: Extras) => Record<string, unknown>> = {
  siconfi_relatorio: (x) => ({ codIbge: x.codIbge, tipoRelatorio: x.tipoRelatorio }),
  senado_mat: (x) => opcional("sigla", x.sigla),
  camara_props: (x) => opcional("siglaTipo", x.siglaTipo),
  siconfi_ano: (x) => ({ codIbge: x.codIbge }),
  siconfi_varredura: (x) => ({
    conjunto: x.conjunto,
    ...opcional("uf", x.uf),
    ...opcional("codIbge", x.codIbge),
  }),
  ...PARAMS_DAS_PENDENTES_TSE,
};

/**
 * Tarefas com uma linha por sigla (ou tipo) no mesmo ano: sem `--param`, a
 * ferramenta percorre as que o painel importa; com ele, só a pedida.
 */
const SIGLAS_DA_TAREFA: Record<string, { chave: string; doPainel: readonly string[] }> = {
  senado_mat: { chave: "sigla", doPainel: SIGLAS_MATERIA_SENADO },
  camara_props: { chave: "siglaTipo", doPainel: TIPOS_PROPOSICAO_CAMARA },
};

/**
 * As janelas de uma tarefa por sigla, uma por (janela, sigla), na ordem das
 * siglas; nas tarefas por órgão, uma por (janela, órgão de `--orgao`).
 */
function porSigla(tarefa: string, janelas: Janela[], extras: Extras, recorte?: Recorte): Janela[] {
  if (TAREFAS_POR_ORGAO.has(tarefa)) {
    const orgaos = orgaosDoRecorte(recorte);
    return janelas.flatMap((j) => orgaos.map((escopo) => ({ ...j, escopo })));
  }
  const s = SIGLAS_DA_TAREFA[tarefa];
  if (!s) return janelasDoTse(tarefa, janelas, extras);
  const siglas = extras[s.chave] ? [extras[s.chave]] : s.doPainel;
  return janelas.flatMap((j) => siglas.map((escopo) => ({ ...j, escopo })));
}

export const TAREFAS_DA_FERRAMENTA = Object.keys(PARAMS_DA_JANELA);

export function paramsDaJanela(
  tarefa: string,
  janela: Janela,
  recorte: Recorte = {},
  extras: Extras = {},
): Record<string, unknown> {
  return PARAMS_DA_JANELA[tarefa](janela, recorte, extras);
}

export const USO = `uso: bun run importar <tarefa>... <intervalo> [recorte] [--reprocessar] [--teto-rodadas N]
       bun run importar <tarefa>... --pendentes [<intervalo>] [recorte] [--teto-rodadas N]
       bun run importar --todas --pendentes [<intervalo>] [recorte]
  tarefa:      com adaptador: ${TAREFAS_DA_FERRAMENTA.join(" | ")}
               (as demais da tabela de dependências são puladas com aviso)
  --todas:     todas as tarefas da tabela de dependências, na ordem dela
  intervalo:   AAAA-MM (um mês) · AAAA-MM..AAAA-MM (meses) · AAAA ou AAAA..AAAA (anos)
               cgu_emendas, senado_mat, camara_props e as do SICONFI são por ano: AAAA ou AAAA..AAAA
               tse_arquivo e os cruzamentos (tse_lacunas, tse_sinais, cruzamento_doador_fornecedor)
               são por eleição: AAAA ou AAAA..AAAA (anos sem eleição ficam de fora)
               cadastros (ibge, camara_cadastro, camara_trajetoria, senado_cadastro, cgu_siafi,
               cgu_atividade, tse_ponte, convenios_origem): sem intervalo
  recorte:     --orgao COD[,COD...] (cgu_contratos, cgu_licitacoes: um mês de um órgão por janela;
               obrigatório com intervalo; com --pendentes, sem ele, os órgãos ativos do catálogo)
               --uf COD_IBGE | --municipio COD_IBGE (transferegov, opcional)
  --param:     parâmetro próprio da tarefa, chave=valor (ex.: sigla=PEC nas matérias;
               codIbge=35 e tipoRelatorio=RGF no siconfi_relatorio, obrigatórios;
               codIbge no siconfi_ano, obrigatório; conjunto=ufs|capitais|municipios|ente
               no siconfi_varredura, obrigatório, com uf=SP nos municípios e codIbge no ente;
               tipo=bens e uf=SP restringem o tse_arquivo; casa=camara|senado, o tse_ponte)
  --pendentes: só as janelas sem conferência aprovada (a lista vem do site)`;

export type Argumentos = {
  /** Na ordem da tabela de dependências (`dependencias.ts`). */
  tarefas: string[];
  /** Obrigatório sem `--pendentes`; com ele, só restringe a lista. */
  intervalo: string | null;
  pendentes: boolean;
  reprocessar: boolean;
  tetoRodadas: number;
  /** `--orgao`, `--uf`, `--municipio`; ausente quando nenhum foi dado. */
  recorte?: Recorte;
  /** `--param chave=valor`; cada tarefa usa só as chaves que conhece. */
  params: Extras;
};

const OPCOES_DE_RECORTE: Record<string, keyof Recorte> = {
  "--orgao": "orgao",
  "--uf": "uf",
  "--municipio": "municipio",
};

const ehIntervalo = (a: string) => /^\d{4}/.test(a);

export function interpretarArgs(argv: string[]): Argumentos {
  const tarefas: string[] = [];
  const intervalos: string[] = [];
  let reprocessar = false;
  let pendentes = false;
  let todas = false;
  let tetoRodadas = 30;
  let recorte: Recorte | undefined;
  const params: Extras = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--reprocessar") reprocessar = true;
    else if (a in OPCOES_DE_RECORTE) {
      const valor = argv[++i];
      if (!valor || valor.startsWith("--")) throw new Error(`${a} precisa de um código\n${USO}`);
      recorte = { ...recorte, [OPCOES_DE_RECORTE[a]]: valor };
    } else if (a === "--pendentes") pendentes = true;
    else if (a === "--todas") todas = true;
    else if (a === "--teto-rodadas") {
      tetoRodadas = Number(argv[++i]);
      if (!Number.isInteger(tetoRodadas) || tetoRodadas < 1) {
        throw new Error(`--teto-rodadas precisa de um inteiro positivo\n${USO}`);
      }
    } else if (a === "--param") {
      const m = (argv[++i] ?? "").match(/^([A-Za-z]+)=(.+)$/);
      if (!m) throw new Error(`--param precisa de chave=valor\n${USO}`);
      params[m[1]] = m[2];
    } else if (ehIntervalo(a)) intervalos.push(a);
    else tarefas.push(a);
  }
  const [intervalo = null] = intervalos;
  // Ou `--todas`, ou as tarefas pelo nome — exatamente um dos dois.
  const alvoAmbiguo = todas ? tarefas.length > 0 : tarefas.length === 0;
  if (alvoAmbiguo || intervalos.length > 1) throw new Error(USO);
  let ordenadas: string[];
  try {
    ordenadas = todas ? ORDEM : naOrdem(tarefas);
  } catch (e) {
    throw new Error(`${(e as Error).message}\n${USO}`);
  }
  // Recusa intervalo mal escrito para a granularidade de cada tarefa pedida.
  const comAdaptador = ordenadas.filter(temAdaptador);
  if (intervalo) {
    for (const t of comAdaptador) janelasDoIntervalo(intervalo, granularidadeDa(t), params);
  }
  // Só o cadastro dispensa o intervalo fora do modo "só pendentes".
  if (!intervalo && !pendentes && comAdaptador.some((t) => granularidadeDa(t) !== "cadastro")) {
    throw new Error(USO);
  }
  // Cada opção de recorte vale para as tarefas que a aceitam; as outras a
  // ignoram. Opção que nenhuma tarefa pedida aceita é recusada.
  for (const opcao of Object.keys(recorte ?? {}) as (keyof Recorte)[]) {
    if (!ordenadas.some((t) => RECORTE_ACEITO[t]?.includes(opcao))) {
      const aceitam = Object.keys(RECORTE_ACEITO).filter((t) => RECORTE_ACEITO[t].includes(opcao));
      throw new Error(`--${opcao} só vale para ${aceitam.join(", ")}\n${USO}`);
    }
  }
  // Pedida pelo nome, a tarefa sem o recorte que exige é erro de uso; com
  // `--todas`, ela só é pulada (ver `executarFontes`).
  orgaosDoRecorte(recorte);
  if (!todas) {
    for (const t of ordenadas) {
      const falta = recorteQueFalta(t, recorte, pendentes);
      if (falta) throw new Error(`${t} exige ${falta}\n${USO}`);
      const faltando = paramsFaltando(t, params);
      if (faltando.length > 0) {
        throw new Error(`${t} precisa de --param ${faltando.join(", ")}\n${USO}`);
      }
    }
  }
  if (recorte?.uf && recorte.municipio) {
    throw new Error(`informe --uf ou --municipio, não os dois\n${USO}`);
  }
  return {
    tarefas: ordenadas,
    intervalo,
    pendentes,
    reprocessar,
    tetoRodadas,
    ...(recorte ? { recorte } : {}),
    params,
  };
}

function mesDe(texto: string): { ano: number; mes: number } {
  const m = texto.match(/^(\d{4})-(\d{2})$/);
  const mes = m ? Number(m[2]) : 0;
  if (!m || mes < 1 || mes > 12) throw new Error(`mês inválido: "${texto}"\n${USO}`);
  return { ano: Number(m[1]), mes };
}

/** Do primeiro dia de `mesIni` ao último de `mesFim`, no mesmo ano. */
function janelaDosMeses(ano: number, mesIni: number, mesFim: number): Janela {
  const mm = (mes: number) => String(mes).padStart(2, "0");
  const ultimo = new Date(Date.UTC(ano, mesFim, 0)).getUTCDate();
  return { dataInicio: `${ano}-${mm(mesIni)}-01`, dataFim: `${ano}-${mm(mesFim)}-${ultimo}` };
}

const janelaDoMes = (ano: number, mes: number) => janelaDosMeses(ano, mes, mes);

/** Os anos de `AAAA` ou `AAAA..AAAA`, do mais recente para o mais antigo. */
function anosDoIntervalo(intervalo: string): number[] {
  const m = intervalo.match(/^(\d{4})(?:\.\.(\d{4}))?$/);
  if (!m) throw new Error(`intervalo por ano: AAAA ou AAAA..AAAA, não "${intervalo}"\n${USO}`);
  const ini = Number(m[1]);
  const fim = Number(m[2] ?? m[1]);
  if (fim < ini) throw new Error(`intervalo invertido: "${intervalo}"\n${USO}`);
  return Array.from({ length: fim - ini + 1 }, (_, i) => fim - i);
}

/**
 * Fatia o intervalo nas janelas naturais da tarefa, da mais recente para a
 * mais antiga: meses (o padrão), anos inteiros, a janela única do cadastro ou
 * os períodos do relatório do SICONFI (`extras.tipoRelatorio`) em cada
 * exercício.
 */
export function janelasDoIntervalo(
  intervalo: string | null,
  granularidade: Granularidade = "mes",
  extras: Extras = {},
): Janela[] {
  if (granularidade === "cadastro") return [{ dataInicio: "", dataFim: "" }];
  const texto = intervalo ?? "";
  if (granularidade === "ano") return anosDoIntervalo(texto).map((a) => janelaDosMeses(a, 1, 12));
  if (granularidade === "periodo") {
    const n = periodosDoTipo(extras.tipoRelatorio as TipoRelatorio);
    return anosDoIntervalo(texto).flatMap((a) => {
      if (n === 0) return [janelaDosMeses(a, 1, 12)];
      const meses = 12 / n;
      return Array.from({ length: n }, (_, i) => {
        const periodo = n - i;
        return { ...janelaDosMeses(a, periodo * meses - meses + 1, periodo * meses), periodo };
      });
    });
  }
  let ini: { ano: number; mes: number };
  let fim: { ano: number; mes: number };
  const anos = texto.match(/^(\d{4})(?:\.\.(\d{4}))?$/);
  if (anos) {
    // Anos inteiros também valem nas fontes mensais: todos os meses deles.
    ini = { ano: Number(anos[1]), mes: 1 };
    fim = { ano: Number(anos[2] ?? anos[1]), mes: 12 };
  } else {
    const [a, b = a] = texto.split("..");
    ini = mesDe(a);
    fim = mesDe(b);
  }
  const janelas: Janela[] = [];
  for (let ano = fim.ano, mes = fim.mes; ano > ini.ano || (ano === ini.ano && mes >= ini.mes); ) {
    janelas.push(janelaDoMes(ano, mes));
    mes -= 1;
    if (mes === 0) {
      mes = 12;
      ano -= 1;
    }
  }
  if (janelas.length === 0) throw new Error(`intervalo invertido: "${texto}"\n${USO}`);
  return janelas;
}

/** A janela nas linhas que a ferramenta imprime. */
export function rotuloDaJanela(j: Janela): string {
  if (!j.dataInicio) return "cadastro";
  if (j.periodo) return `${j.dataInicio.slice(0, 4)}, período ${j.periodo}`;
  const datas = `${j.dataInicio}..${j.dataFim}`;
  return j.escopo ? `${datas} ${j.escopo}` : datas;
}

/** Lê um arquivo no formato `.env` (chave=valor, aspas opcionais, `#` comenta). */
export function lerEnv(texto: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const linha of texto.split(/\r?\n/)) {
    const m = linha.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    env[m[1]] = m[2].replace(/^(["'])(.*)\1$/, "$2");
  }
  return env;
}

/**
 * As janelas pendentes que a rota devolveu, restritas ao intervalo quando
 * há um. A ordem é a da rota: da mais recente para a mais antiga.
 *
 * Só a janela cuja última conferência foi reprovada ou inconclusiva vai com
 * `reprocessar` — conferi-la de novo sem refazer daria o mesmo veredito. A
 * nunca conferida vai sem: completa, a rota só a confere, sem reimportar;
 * parcial, segue do cursor; nunca tentada, importa normalmente.
 */
export function janelasDasPendentes(
  pendentes: readonly JanelaPendente[],
  intervalo: string | null,
  granularidade: Granularidade = "mes",
  extras: Extras = {},
): Janela[] {
  const chave = (j: Janela) => `${j.dataInicio}#${j.periodo ?? ""}`;
  const permitidas = intervalo
    ? new Set(janelasDoIntervalo(intervalo, granularidade, extras).map(chave))
    : null;
  return pendentes
    .map((p) => ({
      dataInicio: p.dataInicio,
      dataFim: p.dataFim,
      // No SICONFI, o `mes` da pendente é o período do relatório (0 no anual).
      ...(granularidade === "periodo" && p.mes > 0 ? { periodo: p.mes } : {}),
      ...(p.escopo ? { escopo: p.escopo } : {}),
      reprocessar: p.ultima !== null && p.ultima.estado !== "aprovada",
    }))
    .filter((j) => !permitidas || permitidas.has(chave(j)));
}

export type CorpoNomeado = {
  tarefa: string;
  params: Record<string, unknown>;
  execucao_id: string;
  reprocessar: boolean;
};

export type ResultadoJanela = {
  /**
   * `terminou`: a rota disse `haMais: false`. `teto`: esgotou as rodadas.
   * `interrompida`: uma rodada parou por falha passageira da origem.
   * `falhou`: a chamada à rota falhou.
   */
  estado: "terminou" | "teto" | "interrompida" | "falhou";
  rodadas: RespostaRodada[];
  falha?: string;
};

/**
 * Repete rodadas de UMA janela até `haMais` virar falso, com teto de rodadas
 * como trava contra laço. Rodada interrompida (`parada: "erro"`, a origem
 * falhou de forma passageira) encerra a tentativa: insistir na hora só
 * gastaria o teto — a política re-tenta depois de uma pausa. `chamar` faz o
 * POST e lança se a rota não responder 200.
 */
export async function importarJanela(
  pedido: {
    tarefa: string;
    params: Record<string, unknown>;
    execucaoId: string;
    reprocessar: boolean;
    tetoRodadas: number;
    /** O parâmetro em que o `cursor` de uma rodada volta na seguinte (ver `CURSOR_NO_PARAM`). */
    cursorNoParam?: string;
  },
  chamar: (corpo: CorpoNomeado) => Promise<RespostaRodada>,
  aoTerminarRodada: (r: RespostaRodada, n: number) => void = () => {},
): Promise<ResultadoJanela> {
  let corpo: CorpoNomeado = {
    tarefa: pedido.tarefa,
    params: pedido.params,
    execucao_id: pedido.execucaoId,
    reprocessar: pedido.reprocessar,
  };
  const rodadas: RespostaRodada[] = [];
  for (let n = 1; n <= pedido.tetoRodadas; n++) {
    let r: RespostaRodada;
    try {
      r = await chamar(corpo);
    } catch (e) {
      return { estado: "falhou", rodadas, falha: (e as Error).message };
    }
    rodadas.push(r);
    aoTerminarRodada(r, n);
    if (!r.haMais) return { estado: "terminou", rodadas };
    if (r.parada === "erro") return { estado: "interrompida", rodadas };
    if (pedido.cursorNoParam && r.cursor !== null) {
      corpo = { ...corpo, params: { ...corpo.params, [pedido.cursorNoParam]: r.cursor } };
    }
  }
  return { estado: "teto", rodadas };
}

/**
 * `sem_conferencia`: a janela já estava completa e conferida (aprovada); nada
 * rodou. `cotaDoPortal`: a tentativa esbarrou na cota da chave do Portal
 * (`cota-do-portal.ts`).
 */
export type Veredito = {
  estado: EstadoConferencia | "sem_conferencia";
  motivo: string;
  cotaDoPortal?: true;
};

/** O veredito de uma tentativa: o da conferência da rota ou o da própria ferramenta. */
export function vereditoDaJanela(r: ResultadoJanela, tetoRodadas: number): Veredito {
  if (r.estado === "teto") {
    return {
      estado: "reprovada",
      motivo: `Teto de ${tetoRodadas} rodadas sem a janela terminar (laço).`,
    };
  }
  if (r.estado === "falhou") {
    return { estado: "reprovada", motivo: `A chamada à rota falhou: ${r.falha}` };
  }
  if (r.estado === "interrompida") {
    return {
      estado: "inconclusiva",
      motivo: "Rodada interrompida por falha passageira da origem.",
    };
  }
  const conferencia = r.rodadas[r.rodadas.length - 1]?.conferencia;
  if (conferencia) return { estado: conferencia.estado, motivo: conferencia.motivo };
  return {
    estado: "sem_conferencia",
    motivo:
      "A janela já estava completa e aprovada: nada rodou (use --reprocessar para refazê-la).",
  };
}

/** Pausa antes de re-tentar uma janela inconclusiva. */
export const PAUSA_ANTES_DE_RETENTAR_MS = 60_000;

/** Inconclusivas seguidas que param a fonte. */
export const INCONCLUSIVAS_QUE_PARAM = 3;

export type Plano = {
  tarefa: string;
  janelas: Janela[];
  reprocessar: boolean;
  tetoRodadas: number;
  recorte?: Recorte;
  /** `--param` mandados em toda janela; ausente quando nenhum foi dado. */
  params?: Extras;
};

export type Dependencias = {
  chamar: (corpo: CorpoNomeado) => Promise<RespostaRodada>;
  novoExecucaoId: () => string;
  esperar: (ms: number) => Promise<void>;
  log: (linha: string) => void;
};

/**
 * O que ficou de uma janela: o veredito e, da última tentativa, a execução,
 * as rodadas, os erros (sem os avisos `info:`) e os findings novos — o que o
 * relatório e a issue de reprovação citam. `importados` soma as tentativas.
 */
export type Desfecho = {
  janela: Janela;
  veredito: Veredito;
  execucaoId: string;
  rodadas: number;
  importados: Record<string, number>;
  erros: string[];
  /** `null` = a fonte não tem regras de qualidade, ou não houve conferência. */
  findingsNovos: number | null;
};

export type ResultadoPlano = {
  desfechos: Desfecho[];
  /** Por que a fonte parou antes do fim do plano; `null` = percorreu tudo. */
  parou: string | null;
  /** Parou pela cota da chave do Portal: as fontes da chave ficam pausadas. */
  cotaDoPortal?: true;
};

/** Resumo de uma rodada em uma linha. */
export function resumoDaRodada(r: RespostaRodada): string {
  const importados = Object.entries(r.importados)
    .map(([unidade, n]) => `${n} ${unidade}`)
    .join(", ");
  const partes = [importados, r.haMais ? "há mais" : "fim da janela", `parada: ${r.parada}`];
  if (r.erros.length) partes.push(`${r.erros.length} erro(s)`);
  return partes.join(" · ");
}

async function tentarJanela(
  plano: Plano,
  janela: Janela,
  reprocessar: boolean,
  deps: Dependencias,
): Promise<{ veredito: Veredito; execucaoId: string; rodadas: RespostaRodada[] }> {
  const execucaoId = deps.novoExecucaoId();
  deps.log(`  execução ${execucaoId}`);
  const r = await importarJanela(
    {
      tarefa: plano.tarefa,
      params: paramsDaJanela(plano.tarefa, janela, plano.recorte, plano.params),
      execucaoId,
      reprocessar,
      tetoRodadas: plano.tetoRodadas,
      ...(CURSOR_NO_PARAM[plano.tarefa] ? { cursorNoParam: CURSOR_NO_PARAM[plano.tarefa] } : {}),
    },
    deps.chamar,
    (rodada, n) => {
      deps.log(`    rodada ${n}: ${resumoDaRodada(rodada)}`);
      for (const e of rodada.erros) deps.log(`      erro: ${e}`);
      for (const a of rodada.avisos) deps.log(`      ${a}`);
    },
  );
  const veredito: Veredito = esbarrouNaCota(plano.tarefa, r.rodadas)
    ? { estado: "inconclusiva", motivo: MOTIVO_COTA, cotaDoPortal: true }
    : vereditoDaJanela(r, plano.tetoRodadas);
  deps.log(`  conferência: ${veredito.estado} — ${veredito.motivo}`);
  return { veredito, execucaoId, rodadas: r.rodadas };
}

function somarImportados(
  rodadas: readonly { importados: Record<string, number> }[],
): Record<string, number> {
  const soma: Record<string, number> = {};
  for (const r of rodadas) {
    for (const [unidade, n] of Object.entries(r.importados))
      soma[unidade] = (soma[unidade] ?? 0) + n;
  }
  return soma;
}

/**
 * Importa as janelas do plano, uma por vez, aplicando a política de parada.
 * A re-tentativa de uma inconclusiva usa `reprocessar`: se a janela chegou ao
 * fim, só refazê-la do zero produz um veredito novo; se foi interrompida, a
 * varredura parcial segue do cursor de qualquer jeito.
 */
export async function executarPlano(plano: Plano, deps: Dependencias): Promise<ResultadoPlano> {
  const desfechos: Desfecho[] = [];
  let inconclusivasSeguidas = 0;
  for (const janela of plano.janelas) {
    deps.log(`\n${plano.tarefa} ${rotuloDaJanela(janela)}`);
    const reprocessar = plano.reprocessar || (janela.reprocessar ?? false);
    const tentativas = [await tentarJanela(plano, janela, reprocessar, deps)];
    if (tentativas[0].veredito.estado === "inconclusiva" && !tentativas[0].veredito.cotaDoPortal) {
      deps.log(`  re-tentando em ${PAUSA_ANTES_DE_RETENTAR_MS / 1000} s`);
      await deps.esperar(PAUSA_ANTES_DE_RETENTAR_MS);
      tentativas.push(await tentarJanela(plano, janela, true, deps));
    }
    const { veredito, execucaoId, rodadas } = tentativas[tentativas.length - 1];
    desfechos.push({
      janela,
      veredito,
      execucaoId,
      rodadas: rodadas.length,
      importados: somarImportados(tentativas.flatMap((x) => x.rodadas)),
      erros: rodadas.flatMap((x) => x.erros),
      findingsNovos: rodadas[rodadas.length - 1]?.conferencia?.findingsNovos ?? null,
    });

    // Cota do Portal: nem re-tentativa nem próxima janela (`cota-do-portal.ts`).
    if (veredito.cotaDoPortal) {
      return { desfechos, parou: avisoDePausa(plano.tarefa), cotaDoPortal: true };
    }

    if (veredito.estado === "reprovada") {
      return { desfechos, parou: `Janela reprovada: a fonte ${plano.tarefa} para aqui.` };
    }
    if (veredito.estado === "inconclusiva") {
      inconclusivasSeguidas++;
      if (inconclusivasSeguidas >= INCONCLUSIVAS_QUE_PARAM) {
        return {
          desfechos,
          parou: `${INCONCLUSIVAS_QUE_PARAM} janelas inconclusivas seguidas: a origem parece fora do ar, a fonte ${plano.tarefa} para aqui.`,
        };
      }
    } else if (veredito.estado === "aprovada") {
      inconclusivasSeguidas = 0;
    }
  }
  return { desfechos, parou: null };
}

/**
 * 0 quando todas as janelas aprovaram (ou já estavam completas); 3 quando a
 * cota da chave do Portal acabou (pausar as fontes da chave); 1 nos demais.
 */
export function codigoDeSaida(r: ResultadoPlano): number {
  if (r.cotaDoPortal) return SAIDA_COTA_DO_PORTAL;
  if (r.parou) return 1;
  const ok = r.desfechos.every(
    (d) => d.veredito.estado === "aprovada" || d.veredito.estado === "sem_conferencia",
  );
  return ok ? 0 : 1;
}

/** O corpo da consulta de pendentes na rota; `params` só na tarefa com recorte. */
export const corpoDasPendentes = (tarefa: string, params?: Record<string, unknown>) => ({
  consulta: "pendentes",
  tarefa,
  ...(params ? { params } : {}),
});

/**
 * As janelas a importar de uma tarefa: as do intervalo ou, no modo "só
 * pendentes", as que a rota diz pendentes, cada uma com o seu `reprocessar`.
 * `--reprocessar` força a reimportação de todas.
 */
export async function montarPlano(
  tarefa: string,
  args: Argumentos,
  consultarPendentes: (
    tarefa: string,
    params?: Record<string, unknown>,
  ) => Promise<RespostaPendentes>,
): Promise<Plano> {
  const granularidade = granularidadeDa(tarefa);
  const extras = args.params ?? {};
  // Só a tarefa que tem recorte o recebe; ela cobra o que exige.
  const doRecorte = RECORTE_DA_TAREFA[tarefa]?.(args.recorte ?? {});
  const base = {
    tarefa,
    reprocessar: args.reprocessar,
    tetoRodadas: args.tetoRodadas,
    ...(doRecorte && args.recorte ? { recorte: args.recorte } : {}),
    ...(Object.keys(extras).length > 0 ? { params: extras } : {}),
  };
  if (!args.pendentes) {
    const janelas = janelasDoIntervalo(args.intervalo, granularidade, extras);
    return { ...base, janelas: porSigla(tarefa, janelas, extras, args.recorte) };
  }
  // A pendência é da linha da matriz (o órgão, o ente) ou, no SICONFI, do
  // ente e do relatório: a tarefa manda esses parâmetros na consulta.
  const daConsulta = { ...doRecorte, ...PARAMS_DAS_PENDENTES[tarefa]?.(extras) };
  const r =
    Object.keys(daConsulta).length > 0
      ? await consultarPendentes(tarefa, daConsulta)
      : await consultarPendentes(tarefa);
  return {
    ...base,
    janelas: janelasDasPendentes(r.janelas, args.intervalo, granularidade, extras),
  };
}

/** Tem adaptador na ferramenta (e na rota): as tarefas de `PARAMS_DA_JANELA`. */
export const temAdaptador = (tarefa: string) => tarefa in PARAMS_DA_JANELA;

/**
 * O que aconteceu com cada tarefa pedida. `sem_adaptador`: está na tabela de
 * dependências, mas ainda não tem modo nomeado — pulada. `pulada`: não roda
 * nesta execução pelo `motivo` (a cota da chave do Portal acabou, ou falta o
 * recorte ou o `--param` obrigatório). `bloqueada`: depende de uma fonte que parou nesta
 * execução.
 */
export type DesfechoFonte =
  | { tarefa: string; situacao: "sem_adaptador" }
  | { tarefa: string; situacao: "pulada"; motivo: string }
  | { tarefa: string; situacao: "bloqueada"; por: string }
  | { tarefa: string; situacao: "rodou"; resultado: ResultadoPlano };

/**
 * Importa as tarefas pedidas, uma fonte por vez, na ordem da tabela de
 * dependências. Cada fonte segue a política de parada de
 * {@link executarPlano}; a fonte que para — ou cujo plano não pôde ser
 * montado — bloqueia as que dependem dela, e as demais seguem. Quando uma
 * fonte esbarra na cota da chave do Portal, as fontes seguintes que usam a
 * chave são puladas (`cota-do-portal.ts`); as outras seguem.
 */
export async function executarFontes(
  args: Argumentos,
  deps: Dependencias & {
    consultarPendentes: (
      tarefa: string,
      params?: Record<string, unknown>,
    ) => Promise<RespostaPendentes>;
    temAdaptador: (tarefa: string) => boolean;
  },
): Promise<DesfechoFonte[]> {
  const desfechos: DesfechoFonte[] = [];
  const paradas = new Set<string>();
  let cotaEsgotadaEm: string | null = null;
  const pular = (tarefa: string, motivo: string) => {
    deps.log(`\n== ${tarefa}: pulada — ${motivo}`);
    desfechos.push({ tarefa, situacao: "pulada", motivo });
  };
  for (const tarefa of args.tarefas) {
    if (!deps.temAdaptador(tarefa)) {
      deps.log(`\n== ${tarefa}: pulada — ainda sem adaptador no modo nomeado`);
      desfechos.push({ tarefa, situacao: "sem_adaptador" });
      continue;
    }
    const por = bloqueadaPor(tarefa, paradas);
    if (por) {
      deps.log(`\n== ${tarefa}: pulada — depende de ${por}, que parou`);
      desfechos.push({ tarefa, situacao: "bloqueada", por });
      continue;
    }
    if (cotaEsgotadaEm && usaChaveDoPortal(tarefa)) {
      pular(tarefa, `cota da chave do Portal esgotada em ${cotaEsgotadaEm}`);
      continue;
    }
    const falta = recorteQueFalta(tarefa, args.recorte, args.pendentes);
    if (falta) {
      pular(tarefa, `exige ${falta} (não informado)`);
      continue;
    }
    const faltando = paramsFaltando(tarefa, args.params);
    if (faltando.length > 0) {
      pular(tarefa, `exige --param ${faltando.join(", ")} (não informado)`);
      continue;
    }
    deps.log(`\n== ${tarefa}`);
    let resultado: ResultadoPlano;
    try {
      const plano = await montarPlano(tarefa, args, deps.consultarPendentes);
      if (args.pendentes) deps.log(`${plano.janelas.length} janela(s) pendente(s)`);
      resultado = await executarPlano(plano, deps);
    } catch (e) {
      resultado = {
        desfechos: [],
        parou: `Não foi possível montar o plano de ${tarefa}: ${(e as Error).message}`,
      };
    }
    if (resultado.parou) {
      deps.log(resultado.parou);
      paradas.add(tarefa);
    }
    if (resultado.cotaDoPortal) cotaEsgotadaEm = tarefa;
    desfechos.push({ tarefa, situacao: "rodou", resultado });
  }
  return desfechos;
}

/**
 * 3 quando a cota da chave do Portal acabou ({@link SAIDA_COTA_DO_PORTAL}:
 * as fontes da chave ficam pausadas); 0 quando rodou ao menos uma fonte e
 * todas as que rodaram saíram com 0 (ver {@link codigoDeSaida}), sem nenhuma
 * bloqueada; 1 caso contrário. Tarefa pulada por falta de adaptador, de
 * recorte ou de `--param` obrigatório não pesa.
 */
export function codigoDeSaidaDasFontes(desfechos: readonly DesfechoFonte[]): number {
  const rodaram = desfechos.flatMap((d) => (d.situacao === "rodou" ? [d.resultado] : []));
  if (rodaram.some((r) => r.cotaDoPortal)) return SAIDA_COTA_DO_PORTAL;
  if (rodaram.length === 0) return 1;
  if (desfechos.some((d) => d.situacao === "bloqueada")) return 1;
  return rodaram.every((r) => codigoDeSaida(r) === 0) ? 0 : 1;
}

const ORDEM_DOS_ESTADOS: Veredito["estado"][] = [
  "aprovada",
  "sem_conferencia",
  "inconclusiva",
  "reprovada",
];

/**
 * O resumo final, uma linha por fonte, com o detalhe de cada janela
 * inconclusiva ou reprovada (execução, rodadas, motivo e erros) — o insumo
 * do relatório e da issue de reprovação.
 */
export function resumoDasFontes(desfechos: readonly DesfechoFonte[]): string {
  const linhas: string[] = [];
  for (const d of desfechos) {
    if (d.situacao === "sem_adaptador") {
      linhas.push(`${d.tarefa}: pulada — ainda sem adaptador no modo nomeado`);
      continue;
    }
    if (d.situacao === "bloqueada") {
      linhas.push(`${d.tarefa}: pulada — depende de ${d.por}, que parou`);
      continue;
    }
    if (d.situacao === "pulada") {
      linhas.push(`${d.tarefa}: pulada — ${d.motivo}`);
      continue;
    }
    const janelas = d.resultado.desfechos;
    const estados = ORDEM_DOS_ESTADOS.map(
      (e) => [e, janelas.filter((j) => j.veredito.estado === e).length] as const,
    )
      .filter(([, n]) => n > 0)
      .map(([e, n]) => `${n} ${e}`);
    const importados = Object.entries(somarImportados(janelas))
      .map(([unidade, n]) => `${n} ${unidade}`)
      .join(", ");
    const findings = janelas.flatMap((j) => (j.findingsNovos === null ? [] : [j.findingsNovos]));
    linhas.push(
      [
        `${d.tarefa}: ${estados.join(", ") || "nenhuma janela"}`,
        `importados: ${importados || "nada"}`,
        `findings novos: ${findings.length ? findings.reduce((a, b) => a + b, 0) : "não se aplica"}`,
      ].join(" · "),
    );
    for (const j of janelas) {
      if (j.veredito.estado !== "inconclusiva" && j.veredito.estado !== "reprovada") continue;
      linhas.push(
        `  ${j.veredito.estado} ${rotuloDaJanela(j.janela)} · execução ${j.execucaoId} · ${j.rodadas} rodada(s) · ${j.veredito.motivo}`,
      );
      for (const e of j.erros) linhas.push(`    erro: ${e}`);
    }
    if (d.resultado.parou) linhas.push(`  parou: ${d.resultado.parou}`);
  }
  return linhas.join("\n");
}
