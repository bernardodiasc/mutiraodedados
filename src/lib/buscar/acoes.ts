/**
 * Lógica pura das ações sobre os resultados da /buscar: busca salva (ao vivo),
 * seleção sem misturar recortes, referências e exportação com o corte
 * registrado.
 */
import { categoriaBusca } from "@/lib/busca/categorias";
import type { ItemBusca } from "@/lib/busca/consulta";
import type { EntidadeTipo } from "@/lib/itens-salvos.functions";
import { chipsDaSearch, formatarData, formatarValor, rotuloData, type BuscarSearch } from "./logic";

/** Máximo de linhas no "conjunto completo" da exportação daqui. */
export const LIMITE_EXPORTACAO = 1000;

export type EscopoAcao = "pagina" | "selecao" | "conjunto";

export const ROTULO_ESCOPO: Record<EscopoAcao, string> = {
  pagina: "esta página",
  selecao: "a seleção",
  conjunto: `o conjunto completo, até ${LIMITE_EXPORTACAO.toLocaleString("pt-BR")}`,
};

/**
 * Busca salva: a consulta e os filtros, sem página nem corte — reabre sempre
 * ao vivo.
 */
export function searchParaSalvar(search: BuscarSearch): BuscarSearch {
  const { pagina: _p, ate: _a, ...resto } = search;
  return resto;
}

export function filtrosParaSalvar(search: BuscarSearch): Array<[string, unknown]> {
  const categoria = search.tipo ? categoriaBusca(search.tipo)!.rotulo : null;
  return [
    ["busca", search.q],
    ["categoria", categoria],
    ...chipsDaSearch(search).map(
      (c) => [c.texto.split(": ")[0], c.texto.split(": ")[1]] as [string, unknown],
    ),
  ];
}

/**
 * Identidade do recorte (consulta + categoria + filtros), para a seleção
 * nunca misturar itens de buscas diferentes.
 */
export function chaveDoRecorte(search: BuscarSearch): string {
  const { pagina: _p, ate: _a, ordem: _o, itens: _i, ...resto } = search;
  return JSON.stringify(
    Object.keys(resto)
      .sort()
      .map((k) => [k, resto[k]]),
  );
}

export function chaveDoItem(item: ItemBusca): string {
  return `${item.colecao}:${item.id}`;
}

/**
 * Tipo do item no caderno. Resultados da busca vão como link, sem snapshot:
 * o item do índice é uma projeção, não o registro completo — a prova fica na
 * ficha.
 */
export function tipoNoCaderno(item: ItemBusca): EntidadeTipo {
  switch (item.colecao) {
    case "pncp_contratos_cache":
    case "contratos_cache":
      return "contrato";
    case "cgu_licitacoes_cache":
      return "licitacao";
    case "cgu_transferegov_emendas_cache":
      return "emenda";
    case "convenios_cache":
      return "convenio";
    case "fornecedores_cache":
      return "fornecedor";
    case "tse_candidatos_cache":
      return "candidatura";
    case "tse_bens_candidato_cache":
      return "bem_declarado";
    case "tse_receitas_campanha_cache":
      return "receita_campanha";
    case "tse_despesas_campanha_cache":
      return "despesa_campanha";
    case "tse_resultados_cache":
      return "resultado_eleitoral";
    case "camara_deputados_cache":
    case "senado_senadores_cache":
      return "parlamentar";
    case "orgaos_cache":
      return "orgao";
    case "ibge_municipios_cache":
      return "ente";
    case "perguntas":
      return "pergunta";
    case "pergunta_modelos":
      return "modelo_pergunta";
    case "roadmap_itens":
    case "paginas_publicas":
      return "pagina";
    case "lacunas":
      return "lacuna";
    case "mapa_prompts":
      return "prompt";
    case "camara_proposicoes_cache":
      return "proposicao";
    case "senado_materias_cache":
      return "materia";
    case "camara_votacoes_cache":
    case "senado_votacoes_cache":
      return "votacao";
    case "camara_votos_cache":
    case "senado_votos_cache":
      return "voto";
    case "siconfi_relatorios":
      return "relatorio_fiscal";
    case "qa_findings":
      return "alerta_qualidade";
    case "camara_despesas_cache":
    case "senado_despesas_cache":
      return "despesa";
    default:
      return item.subtipo === "mapa" ? "mapa" : item.subtipo === "tutorial" ? "tutorial" : "artigo";
  }
}

/**
 * Id do item no caderno. O prompt do Kit entra no índice uma vez por mapa
 * (`<prompt>:<mapa>`), mas no caderno é o mesmo item salvo pelo Kit do mapa:
 * o id do prompt.
 */
export function idNoCaderno(item: ItemBusca): string {
  return item.colecao === "mapa_prompts" ? item.id.split(":")[0] : item.id;
}

export type ContextoExportacao = {
  consulta: string;
  categoria: string | null;
  filtros: string[];
  escopo: EscopoAcao;
  corte: string;
  geradoEm: string;
  /** Total da busca (null = contagem indisponível). */
  total: number | null;
  /** O conjunto passou do limite e foi cortado. */
  truncado: boolean;
  origem: string;
};

function linhaDeCabecalho(ctx: ContextoExportacao, quantidade: number): string[] {
  const linhas = [
    `Consulta: "${ctx.consulta}"${ctx.categoria ? ` em ${ctx.categoria}` : ""}`,
    `Filtros: ${ctx.filtros.length ? ctx.filtros.join("; ") : "nenhum"}`,
    `Itens: ${quantidade.toLocaleString("pt-BR")} (${ROTULO_ESCOPO[ctx.escopo]})${
      ctx.total !== null ? ` de ${ctx.total.toLocaleString("pt-BR")} na busca` : ""
    }`,
    `Corte do índice: ${ctx.corte} · gerado em ${ctx.geradoEm}`,
  ];
  if (ctx.truncado) {
    linhas.push(
      `Atenção: o conjunto passou de ${LIMITE_EXPORTACAO.toLocaleString("pt-BR")} itens e foi cortado; refine a busca para exportar o restante.`,
    );
  }
  return linhas;
}

/** Referências em Markdown, com consulta, corte e totais no topo. */
export function referenciasMarkdown(itens: ItemBusca[], ctx: ContextoExportacao): string {
  const cabecalho = linhaDeCabecalho(ctx, itens.length).map((l) => `> ${l}`);
  const corpo = itens.map((i) => {
    const partes = [i.fonte, i.identificador];
    if (i.data) partes.push(`${rotuloData(i)}: ${formatarData(i.data)}`);
    if (i.valor) partes.push(`${i.valor.natureza}: ${formatarValor(i.valor)}`);
    const fonteOficial = i.urlOficial ? ` · [fonte oficial](${i.urlOficial})` : "";
    return `- [${i.titulo}](${ctx.origem}${i.href}) — ${partes.filter(Boolean).join(" · ")}${fonteOficial}`;
  });
  return [`# Busca no Mutirão de Dados`, "", ...cabecalho, "", ...corpo, ""].join("\n");
}

/** Linhas do CSV: uma por item, com os campos do cartão e os links. */
export function linhasCsv(itens: ItemBusca[], origem: string): Array<Record<string, unknown>> {
  return itens.map((i) => ({
    categoria: categoriaBusca(i.categoria)?.rotulo ?? i.categoria,
    fonte: i.fonte,
    titulo: i.titulo,
    identificador: i.identificador,
    data: i.data?.valor.slice(0, 10) ?? null,
    data_tipo: i.data ? rotuloData(i) : null,
    valor: i.valor?.n ?? null,
    valor_natureza: i.valor?.natureza ?? null,
    uf: i.uf,
    resumo: i.resumo,
    link: `${origem}${i.href}`,
    fonte_oficial: i.urlOficial,
  }));
}

/** Linhas de comentário (#) com o contexto, para abrir o CSV sem perder a proveniência. */
export function cabecalhoCsv(ctx: ContextoExportacao, quantidade: number): string {
  return linhaDeCabecalho(ctx, quantidade)
    .map((l) => `# ${l}`)
    .join("\n");
}

export function nomeDoArquivo(consulta: string, geradoEm: string, extensao: "csv" | "md"): string {
  const slug =
    consulta
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "busca";
  return `busca-${slug}-${geradoEm.slice(0, 10)}.${extensao}`;
}
