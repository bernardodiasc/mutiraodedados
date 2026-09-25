/**
 * Montagem das consultas ao SICONFI e classificação da resposta vazia.
 *
 * Até 2026-09-25 o RGF era pedido sem `in_periodicidade` e `co_poder`, que o
 * endpoint `/rgf` exige: a API respondia 200 com zero itens e a importação
 * registrava "sem dados" para todo ente. O mesmo acontecia com municípios que
 * publicam o RREO/RGF Simplificado (a consulta só pedia a versão completa).
 *
 * Por isso este módulo:
 * - pede o RGF poder a poder (E, L, J, M, D conforme o ente) e com a
 *   periodicidade certa (Q; S só é permitida a município com menos de 50 mil
 *   habitantes, LRF art. 63);
 * - tenta a forma alternativa (Simplificado/semestral) quando o ente pode
 *   tê-la escolhido;
 * - só aceita "vazio" quando o extrato de entregas do próprio SICONFI confirma
 *   que o relatório não foi entregue. Vazio com entrega registrada é erro — é
 *   sinal de que a consulta não bate com a publicação, não de ausência.
 *
 * Sem I/O: quem chama injeta `buscar` (uma página da API). Isso deixa a
 * lógica testável com uma API falsa.
 */

export type FamiliaRelatorio = "RREO" | "RGF" | "DCA";
export type Poder = "E" | "L" | "J" | "M" | "D";

/** Tipo de relatório como a tela e a tabela de cache conhecem. */
export type TipoRelatorio = "RREO" | "RREO Simplificado" | "RGF" | "RGF Simplificado" | "DCA";

/** LRF art. 63: abaixo disso o município pode optar pelo RGF semestral e simplificado. */
export const LIMIAR_PEQUENO_MUNICIPIO = 50_000;

/** Código IBGE do Distrito Federal no SICONFI (declara como ente estadual). */
const COD_DF = "53";

/**
 * Poderes/órgãos que publicam RGF próprio. Estados: Executivo, Legislativo
 * (inclui o Tribunal de Contas), Judiciário, Ministério Público e Defensoria.
 * O DF não tem Judiciário nem MP próprios (são mantidos pela União).
 * Municípios: Executivo e Legislativo (Câmara e, onde existe, o TCM).
 */
export function poderesDoEnte(codIbge: string): Poder[] {
  if (codIbge === COD_DF) return ["E", "L", "D"];
  if (codIbge.length === 2) return ["E", "L", "J", "M", "D"];
  return ["E", "L"];
}

export function familiaDoTipo(tipo: TipoRelatorio): FamiliaRelatorio {
  if (tipo.startsWith("RREO")) return "RREO";
  if (tipo.startsWith("RGF")) return "RGF";
  return "DCA";
}

/** Uma forma de publicação: o demonstrativo e, no RGF, a periodicidade. */
export type FormaRelatorio = {
  tipo: TipoRelatorio;
  periodicidade?: "Q" | "S";
  /** Quantos períodos a forma tem no ano (RGF Q = 3, RGF S = 2). */
  periodos?: number;
};

const RGF_Q: FormaRelatorio = { tipo: "RGF", periodicidade: "Q", periodos: 3 };
const RGF_S: FormaRelatorio = { tipo: "RGF Simplificado", periodicidade: "S", periodos: 2 };

export function ehPequenoMunicipio(codIbge: string, populacao: number | null): boolean {
  return codIbge.length === 7 && populacao != null && populacao < LIMIAR_PEQUENO_MUNICIPIO;
}

/**
 * Formas a tentar, na ordem. A forma completa vem primeiro para todo ente —
 * numa amostra de 2023, a maioria dos municípios pequenos ainda publica o RGF
 * quadrimestral. A simplificada só entra para município com menos de 50 mil
 * habitantes. Quando o tipo pedido já é o Simplificado, só ele é tentado.
 */
export function formasATentar(
  tipo: TipoRelatorio,
  codIbge: string,
  populacao: number | null,
): FormaRelatorio[] {
  const pequeno = ehPequenoMunicipio(codIbge, populacao);
  switch (tipo) {
    case "DCA":
      return [{ tipo: "DCA" }];
    case "RREO Simplificado":
      return [{ tipo: "RREO Simplificado" }];
    case "RREO":
      return pequeno ? [{ tipo: "RREO" }, { tipo: "RREO Simplificado" }] : [{ tipo: "RREO" }];
    case "RGF Simplificado":
      return [RGF_S];
    case "RGF":
      return pequeno ? [RGF_Q, RGF_S] : [RGF_Q];
  }
}

export type ConsultaSiconfi = { path: string; params: Record<string, string | number> };

/** Parâmetros de uma consulta — um poder por vez no RGF. */
export function montarConsulta(args: {
  codIbge: string;
  exercicio: number;
  periodo?: number;
  forma: FormaRelatorio;
  poder?: Poder;
  anexo?: string;
}): ConsultaSiconfi {
  const { codIbge, exercicio, periodo, forma, poder, anexo } = args;
  const params: Record<string, string | number> = { an_exercicio: exercicio, id_ente: codIbge };
  const familia = familiaDoTipo(forma.tipo);
  if (familia === "DCA") {
    if (anexo) params.no_anexo = anexo;
    return { path: "/dca", params };
  }
  if (!periodo) {
    throw new Error(
      familia === "RREO"
        ? "RREO exige 'periodo' (1..6 bimestres)."
        : "RGF exige 'periodo' (1..3 quadrimestres).",
    );
  }
  params.nr_periodo = periodo;
  params.co_tipo_demonstrativo = forma.tipo;
  if (familia === "RGF") {
    if (!forma.periodicidade || !poder) throw new Error("RGF exige periodicidade e poder.");
    params.in_periodicidade = forma.periodicidade;
    params.co_poder = poder;
  }
  if (anexo) params.no_anexo = anexo;
  return { path: familia === "RREO" ? "/rreo" : "/rgf", params };
}

export function urlDaConsulta(base: string, c: ConsultaSiconfi): string {
  const qs = new URLSearchParams(
    Object.entries(c.params).map(([k, v]) => [k, String(v)]),
  ).toString();
  return `${base}${c.path}?${qs}`;
}

export type ItemSiconfi = {
  cod_ibge?: string | number;
  instituicao?: string;
  uf?: string;
  exercicio?: number;
  periodo?: number;
  periodicidade?: string;
  co_poder?: string;
  anexo?: string;
  coluna?: string;
  cod_conta?: string;
  conta?: string;
  valor?: number | string;
};

/** Uma página da API (ORDS): `hasMore` indica que há mais itens após `offset + limit`. */
export type PaginaSiconfi<T = ItemSiconfi> = { items?: T[]; hasMore?: boolean };

export type BuscarSiconfi = <T = ItemSiconfi>(
  path: string,
  params: Record<string, string | number>,
) => Promise<PaginaSiconfi<T>>;

/** Maior página que a API entrega; acima disso ela pagina com `hasMore`. */
export const LIMITE_PAGINA = 5000;

/**
 * Todas as páginas de uma consulta. A API corta em 5.000 itens e sinaliza
 * `hasMore` — ignorar isso truncaria o RREO de um estado grande sem aviso.
 */
async function buscarTodas<T>(
  buscar: BuscarSiconfi,
  c: ConsultaSiconfi,
  contar: () => void,
): Promise<T[]> {
  const out: T[] = [];
  for (let offset = 0; ; offset += LIMITE_PAGINA) {
    contar();
    const pagina = await buscar<T>(c.path, {
      ...c.params,
      ...(offset > 0 ? { offset, limit: LIMITE_PAGINA } : {}),
    });
    const items = pagina.items ?? [];
    out.push(...items);
    if (!pagina.hasMore || items.length === 0) return out;
  }
}

export type ItemExtrato = {
  exercicio?: number;
  entregavel?: string;
  periodo?: number;
  periodicidade?: string;
  instituicao?: string;
};

/** O extrato registra entrega deste relatório/período? (qualquer poder, qualquer forma) */
export function extratoRegistraEntrega(
  itens: ItemExtrato[],
  familia: FamiliaRelatorio,
  exercicio: number,
  periodo?: number,
): boolean {
  return itens.some((i) => {
    const nome = i.entregavel ?? "";
    if (i.exercicio != null && Number(i.exercicio) !== exercicio) return false;
    if (familia === "DCA") return nome.includes("DCA");
    const prefixo =
      familia === "RGF"
        ? "Relatório de Gestão Fiscal"
        : "Relatório Resumido de Execução Orçamentária";
    return nome.startsWith(prefixo) && Number(i.periodo) === periodo;
  });
}

export type ResultadoConsulta =
  | {
      tipo: "dados";
      forma: FormaRelatorio;
      /** Itens com o poder que os trouxe (RGF) — o poder entra na chave do cache. */
      itens: Array<ItemSiconfi & { poder?: Poder }>;
      /** Poderes consultados sem retorno (RGF) — entrega parcial, não erro. */
      poderesSemDados: Poder[];
      endpoints: string[];
      requisicoes: number;
    }
  | { tipo: "nao_entregue"; endpoints: string[]; requisicoes: number };

/** Prefixo da mensagem de vazio inesperado — o teste e o log procuram por ele. */
export const PREFIXO_VAZIO_INESPERADO = "SICONFI: resposta vazia inesperada";

/**
 * Consulta um relatório (ente × exercício × período) e decide o que a
 * ausência significa.
 *
 * Caminho barato primeiro: no RGF, o Executivo decide a forma (todo ente que
 * entregou o RGF tem o do Executivo) e só então os demais poderes são pedidos
 * nessa forma. Se nenhuma forma trouxe nada, o extrato de entregas decide:
 * - não registra entrega → `nao_entregue` (vazio confirmado);
 * - registra entrega → tenta todos os poderes em todas as formas (o Executivo
 *   pode não ter entregado e outro poder sim); ainda vazio → erro definitivo.
 */
export async function consultarRelatorio(args: {
  buscar: BuscarSiconfi;
  base: string;
  codIbge: string;
  exercicio: number;
  periodo?: number;
  tipo: TipoRelatorio;
  populacao: number | null;
  anexo?: string;
}): Promise<ResultadoConsulta> {
  const { buscar, base, codIbge, exercicio, periodo, tipo, populacao, anexo } = args;
  const familia = familiaDoTipo(tipo);
  const formas = formasATentar(tipo, codIbge, populacao).filter(
    (f) => !f.periodos || !periodo || periodo <= f.periodos,
  );
  let requisicoes = 0;
  const contar = () => {
    requisicoes++;
  };
  const endpoints: string[] = [];

  const pedir = async (forma: FormaRelatorio, poder?: Poder) => {
    const c = montarConsulta({ codIbge, exercicio, periodo, forma, poder, anexo });
    endpoints.push(`GET ${urlDaConsulta(base, c)}`);
    const itens = await buscarTodas<ItemSiconfi>(buscar, c, contar);
    return itens.map((it) => (poder ? { ...it, poder } : it));
  };

  /** Pede os poderes indicados numa forma; devolve itens e os poderes sem retorno. */
  const pedirPoderes = async (forma: FormaRelatorio, poderes: Poder[]) => {
    const itens: Array<ItemSiconfi & { poder?: Poder }> = [];
    const vazios: Poder[] = [];
    for (const p of poderes) {
      const r = await pedir(forma, p);
      if (r.length === 0) vazios.push(p);
      itens.push(...r);
    }
    return { itens, vazios };
  };

  const dados = (
    forma: FormaRelatorio,
    itens: Array<ItemSiconfi & { poder?: Poder }>,
    poderesSemDados: Poder[] = [],
  ): ResultadoConsulta => ({
    tipo: "dados",
    forma,
    itens,
    poderesSemDados,
    endpoints,
    requisicoes,
  });

  const poderes = poderesDoEnte(codIbge);

  // 1ª passada: forma a forma, pelo Executivo (RGF) ou pelo relatório inteiro.
  for (const forma of formas) {
    if (familia !== "RGF") {
      const itens = await pedir(forma);
      if (itens.length > 0) return dados(forma, itens);
      continue;
    }
    const executivo = await pedir(forma, "E");
    if (executivo.length > 0) {
      const resto = await pedirPoderes(forma, poderes.slice(1));
      return dados(forma, [...executivo, ...resto.itens], resto.vazios);
    }
  }

  // Nenhuma forma trouxe nada: o extrato de entregas decide se é ausência real.
  contar();
  const extrato = await buscar<ItemExtrato>("/extrato_entregas", {
    id_ente: codIbge,
    an_referencia: exercicio,
  });
  endpoints.push(
    `GET ${urlDaConsulta(base, { path: "/extrato_entregas", params: { id_ente: codIbge, an_referencia: exercicio } })}`,
  );
  if (!extratoRegistraEntrega(extrato.items ?? [], familia, exercicio, periodo)) {
    return { tipo: "nao_entregue", endpoints, requisicoes };
  }

  // Entregue, mas o Executivo não respondeu: tenta os demais poderes.
  if (familia === "RGF") {
    for (const forma of formas) {
      const resto = await pedirPoderes(forma, poderes.slice(1));
      if (resto.itens.length > 0) return dados(forma, resto.itens, ["E", ...resto.vazios]);
    }
  }

  const rotulo = `${tipo}${periodo ? ` P${periodo}` : ""}/${exercicio} do ente ${codIbge}`;
  throw new Error(
    `${PREFIXO_VAZIO_INESPERADO}: o extrato de entregas registra ${rotulo} como entregue, ` +
      `mas nenhuma consulta trouxe linhas (formas tentadas: ${formas.map((f) => f.tipo + (f.periodicidade ? `/${f.periodicidade}` : "")).join(", ") || "nenhuma"}). ` +
      `Nada foi marcado como vazio.`,
  );
}
