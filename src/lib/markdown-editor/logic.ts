/**
 * Funções puras do MarkdownEditor: inserção de marcações no texto a partir da
 * seleção atual do textarea. Nenhuma dependência de DOM aqui — o Container lê a
 * seleção do elemento e passa os índices.
 */

export type AbaEditor = "escrever" | "visualizar";

export type Selecao = { start: number; end: number };

export type ResultadoInsercao = { value: string; cursor: number };

/** Envolve a seleção com um marcador (ex.: `**` → **negrito**). */
export function envolverSelecao(
  texto: string,
  sel: Selecao,
  marcador: string,
  placeholder = "",
): ResultadoInsercao {
  const selecionado = texto.slice(sel.start, sel.end) || placeholder;
  const value =
    texto.slice(0, sel.start) + marcador + selecionado + marcador + texto.slice(sel.end);
  const cursor = sel.start + marcador.length + selecionado.length;
  return { value, cursor };
}

/** Insere um bloco de texto substituindo a seleção. O cursor fica ao fim do bloco. */
export function inserirBloco(texto: string, sel: Selecao, bloco: string): ResultadoInsercao {
  const value = texto.slice(0, sel.start) + bloco + texto.slice(sel.end);
  return { value, cursor: sel.start + bloco.length };
}

/** Prefixa o início da linha onde está o cursor (títulos, citação, lista). */
export function prefixarLinha(texto: string, sel: Selecao, prefixo: string): ResultadoInsercao {
  const inicioLinha = texto.lastIndexOf("\n", sel.start - 1) + 1;
  const value = texto.slice(0, inicioLinha) + prefixo + texto.slice(inicioLinha);
  return { value, cursor: sel.start + prefixo.length };
}

/** Cria um link markdown usando a seleção como rótulo. */
export function inserirLink(texto: string, sel: Selecao, href = "https://"): ResultadoInsercao {
  const rotulo = texto.slice(sel.start, sel.end) || "texto do link";
  const bloco = `[${rotulo}](${href})`;
  const value = texto.slice(0, sel.start) + bloco + texto.slice(sel.end);
  // Cursor posicionado dentro dos parênteses, sobre o href, para edição imediata.
  const cursor = sel.start + rotulo.length + 3;
  return { value, cursor };
}

/** Monta o markdown de uma imagem da galeria. */
export function imagemMarkdown(url: string, alt: string): string {
  return `![${alt}](${url})`;
}

/** Modelo de tabela GFM inserido pela toolbar. */
export const TABELA_MODELO =
  "\n\n| Coluna A | Coluna B |\n| --- | --- |\n| valor | valor |\n| valor | valor |\n\n";

export type AcaoToolbar =
  | "negrito"
  | "italico"
  | "titulo2"
  | "titulo3"
  | "lista"
  | "listaNumerada"
  | "citacao"
  | "codigo"
  | "link"
  | "tabela"
  | "fluxo";

/** Aplica uma ação da toolbar sobre o texto/seleção — resultado puro e testável. */
export function aplicarAcao(
  acao: AcaoToolbar,
  texto: string,
  sel: Selecao,
  extras?: { fluxo?: string; href?: string },
): ResultadoInsercao {
  switch (acao) {
    case "negrito":
      return envolverSelecao(texto, sel, "**", "negrito");
    case "italico":
      return envolverSelecao(texto, sel, "_", "itálico");
    case "titulo2":
      return prefixarLinha(texto, sel, "## ");
    case "titulo3":
      return prefixarLinha(texto, sel, "### ");
    case "lista":
      return prefixarLinha(texto, sel, "- ");
    case "listaNumerada":
      return prefixarLinha(texto, sel, "1. ");
    case "citacao":
      return prefixarLinha(texto, sel, "> ");
    case "codigo":
      return envolverSelecao(texto, sel, "`", "código");
    case "link":
      return inserirLink(texto, sel, extras?.href);
    case "tabela":
      return inserirBloco(texto, sel, TABELA_MODELO);
    case "fluxo":
      return inserirBloco(texto, sel, `\n\n:::fluxo{nome="${extras?.fluxo ?? ""}"}:::\n\n`);
  }
}
