/**
 * Referências de um artigo a registros e consultas (v0.16.0), lógica pura.
 *
 * As referências nascem de sugestões: ao salvar, o admin lê os links internos
 * do Markdown; cada ficha é resolvida pelo índice de busca (o `href_interno`
 * da linha) e cada link de /buscar vira uma consulta normalizada. O admin
 * confirma, e pode cadastrar referência que não está no texto.
 *
 * "Necessita revisão" é calculado na leitura: registro que sumiu do índice,
 * registro que mudou depois da verificação, consulta que ficou vazia. O texto
 * do artigo nunca é reescrito.
 */

const HOSTS_DO_SITE = ["mutiraodedados.com.br", "www.mutiraodedados.com.br"];

/** Link de arquivo estático, que não é ficha nem consulta. */
const ARQUIVO = /\.(png|jpe?g|gif|svg|webp|ico|pdf|csv|json|zip|txt)(\?|$)/i;

export type LinkInterno = { caminho: string; texto: string };

/**
 * Links internos do Markdown (`[texto](destino)`), relativos ou do domínio do
 * site, na ordem em que aparecem e sem repetir o caminho. Imagens, âncoras da
 * própria página e arquivos ficam de fora.
 */
export function extrairLinksInternos(markdown: string): LinkInterno[] {
  const vistos = new Set<string>();
  const out: LinkInterno[] = [];
  for (const m of markdown.matchAll(/(!?)\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g)) {
    if (m[1] === "!") continue;
    const caminho = caminhoInterno(m[3]);
    if (!caminho || caminho === "/" || ARQUIVO.test(caminho) || vistos.has(caminho)) continue;
    vistos.add(caminho);
    out.push({ caminho, texto: m[2].trim() });
  }
  return out;
}

function caminhoInterno(destino: string): string | null {
  if (destino.startsWith("/") && !destino.startsWith("//")) return destino;
  try {
    const u = new URL(destino);
    return HOSTS_DO_SITE.includes(u.hostname) ? u.pathname + u.search : null;
  } catch {
    return null;
  }
}

/** Parâmetros da /buscar que não mudam o que a consulta encontra. */
const FORA_DA_CONSULTA = new Set(["pagina", "itens", "ordem", "ate"]);

/**
 * Consulta de /buscar normalizada: parâmetros em ordem alfabética, sem página,
 * quantidade, ordem nem corte. `null` quando o caminho não é uma consulta
 * (outra rota, ou /buscar sem termo).
 */
export function normalizarConsulta(caminho: string): string | null {
  const [rota, busca = ""] = caminho.split("?");
  if (rota !== "/buscar") return null;
  const params = new URLSearchParams(busca);
  if (!params.get("q")?.trim()) return null;
  const pares = [...params.entries()]
    .filter(([k, v]) => !FORA_DA_CONSULTA.has(k) && v !== "")
    .sort(([a], [b]) => a.localeCompare(b));
  return `/buscar?${new URLSearchParams(pares).toString()}`;
}

export type MotivoRevisao = "sumiu" | "mudou" | "consulta_vazia";

export const ROTULO_MOTIVO_REVISAO: Record<MotivoRevisao, string> = {
  sumiu: "o registro citado não está mais no acervo público",
  mudou: "o registro citado mudou depois da última verificação",
  consulta_vazia: "a consulta citada não encontra mais nada",
};

export type SituacaoReferencia =
  | {
      tipo: "registro";
      verificadoEm: string | null;
      /** A linha no índice; null = não está (sumiu, despublicado ou limpo). */
      noIndice: { atualizadoEm: string } | null;
    }
  | {
      tipo: "consulta";
      verificadoEm: string | null;
      /** Total atual da consulta; null = contagem indisponível. */
      total: number | null;
    };

export function motivosDeRevisao(r: SituacaoReferencia): MotivoRevisao[] {
  if (r.tipo === "consulta") return r.total === 0 ? ["consulta_vazia"] : [];
  if (!r.noIndice) return ["sumiu"];
  if (!r.verificadoEm || r.noIndice.atualizadoEm > r.verificadoEm) return ["mudou"];
  return [];
}

/** Destino público de um artigo pela categoria (as mesmas rotas do índice). */
export function hrefDoArtigo(categoria: string, slug: string): string {
  const base = categoria === "mapa" ? "/mapas/" : categoria === "nota" ? "/notas/" : "/tutoriais/";
  return base + encodeURIComponent(slug);
}
