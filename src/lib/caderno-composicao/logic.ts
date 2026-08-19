import type { PerguntaItem } from "@/lib/pergunta-itens.functions";

/**
 * Composição da pasta ("copiar selecionados"): monta um único texto para a IA
 * do usuário a partir dos itens marcados, na ordem procedimento (mapas/artigos)
 * → dados coletados → prompts.
 */

const URL_ARTIGO_RE = /^\/(mapas|tutoriais|notas)\/([a-z0-9]+(?:-[a-z0-9]+)*)$/;

/** Extrai o slug se a URL do item apontar para um artigo interno. */
export function slugDeUrlArtigo(url: string | null): string | null {
  if (!url) return null;
  const m = url.match(URL_ARTIGO_RE);
  return m ? m[2] : null;
}

export type GrupoComposicao = {
  procedimentos: PerguntaItem[]; // links para mapas/tutoriais/notas
  dados: PerguntaItem[]; // entidades, links externos, notas, buscas
  prompts: PerguntaItem[];
};

export function agruparParaComposicao(itens: PerguntaItem[]): GrupoComposicao {
  const procedimentos: PerguntaItem[] = [];
  const dados: PerguntaItem[] = [];
  const prompts: PerguntaItem[] = [];
  for (const it of itens) {
    if (it.tipo === "prompt") prompts.push(it);
    else if (slugDeUrlArtigo(it.url)) procedimentos.push(it);
    else dados.push(it);
  }
  return { procedimentos, dados, prompts };
}

export type SnapshotResolvido = { conteudo: string; em: string | null };

export type ConteudosResolvidos = {
  /** Texto copiável do artigo, por slug (só os públicos encontrados). */
  artigosPorSlug: Map<string, string>;
  /** prompt_template por id de prompt_modelo. */
  promptsPorId: Map<string, string>;
  /** Snapshot do item salvo correspondente, por chave "tipo:ref_id". */
  snapshotsPorItem?: Map<string, SnapshotResolvido>;
};

export function chaveSnapshot(tipo: string, refId: string): string {
  return `${tipo}:${refId}`;
}

function blocoItemDado(it: PerguntaItem, snapshot?: SnapshotResolvido): string {
  const linhas = [`- **${it.titulo}** (${it.tipo})`];
  if (it.url) linhas.push(`  Fonte: ${it.url}`);
  if (it.nota) linhas.push(`  Anotação: ${it.nota}`);
  if (snapshot) {
    linhas.push(
      `  Dados no momento da coleta${snapshot.em ? ` (snapshot de ${snapshot.em.slice(0, 10)})` : ""}:`,
      "  ```json",
      ...snapshot.conteudo.split("\n").map((l) => `  ${l}`),
      "  ```",
    );
  }
  return linhas.join("\n");
}

export function montarTextoComposicao(
  pergunta: { titulo: string; contexto: string | null },
  grupos: GrupoComposicao,
  conteudos: ConteudosResolvidos,
): string {
  const partes: string[] = [`# Investigação: ${pergunta.titulo}`];
  if (pergunta.contexto) partes.push("", pergunta.contexto);

  if (grupos.procedimentos.length > 0) {
    partes.push("", "---", "", "## Procedimento (mapas e artigos)");
    for (const it of grupos.procedimentos) {
      const slug = slugDeUrlArtigo(it.url);
      const texto = slug ? conteudos.artigosPorSlug.get(slug) : undefined;
      if (texto) {
        partes.push("", texto);
      } else {
        // Artigo despublicado ou não resolvido: mantém a referência.
        partes.push("", blocoItemDado(it));
      }
    }
  }

  if (grupos.dados.length > 0) {
    partes.push("", "---", "", "## Dados e itens coletados");
    partes.push(
      "",
      ...grupos.dados.map((it) =>
        blocoItemDado(
          it,
          it.ref_id
            ? conteudos.snapshotsPorItem?.get(chaveSnapshot(it.tipo, it.ref_id))
            : undefined,
        ),
      ),
    );
  }

  if (grupos.prompts.length > 0) {
    partes.push("", "---", "", "## Prompt");
    for (const it of grupos.prompts) {
      const template = it.ref_id ? conteudos.promptsPorId.get(it.ref_id) : undefined;
      partes.push("", `### ${it.titulo}`, "", template ?? blocoItemDado(it));
    }
  }

  partes.push(
    "",
    "---",
    "",
    "_Material montado no Mutirão de Dados (mutirão de dados de dados públicos). " +
      "Os dados apontam sinais para verificar na fonte oficial — não são prova de irregularidade._",
  );
  return partes.join("\n");
}
