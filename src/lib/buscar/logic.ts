/**
 * Lógica pura da página /buscar: contrato da URL, filtros, chips, troca de
 * categoria e estados. A consulta em si (filtros SQL, respostas) fica em
 * `src/lib/busca/consulta.ts`.
 *
 * URL: `q`, `tipo` (categoria), facetas universais `fonte`, `uf`, `ano` e as
 * próprias de cada categoria pela chave do registro (`modalidade`, `orgao`…),
 * com vários valores separados por "|"; `ordem`, `pagina`, `itens` e o corte
 * `ate`. Só o estado aplicado vai para a URL; rascunhos ficam na tela.
 */
import {
  CATEGORIAS_BUSCA,
  ROTULO_NATUREZA_DATA,
  categoriaBusca,
  type CategoriaBuscaId,
  type NaturezaData,
} from "@/lib/busca/categorias";
import {
  FACETAS_UNIVERSAIS,
  ITENS_BUSCA,
  ITENS_BUSCA_PADRAO,
  ORDENS_BUSCA,
  VALOR_VAZIO,
  type FiltrosBusca,
  type ItemBusca,
  type OrdemBusca,
  type ResumoBusca,
} from "@/lib/busca/consulta";

export const SEPARADOR_VALORES = "|";

/** Chaves de facetas próprias conhecidas (união do registro de categorias). */
export const CHAVES_ESPECIFICAS: readonly string[] = [
  ...new Set(CATEGORIAS_BUSCA.flatMap((c) => c.facetas.map((f) => f.chave))),
];

const CHAVES_FACETA = [...FACETAS_UNIVERSAIS, ...CHAVES_ESPECIFICAS];

/** Parâmetros da URL que não são facetas. */
export const PARAMETROS_RESERVADOS = ["q", "tipo", "ordem", "pagina", "itens", "ate"] as const;

const PARAM_DA_CHAVE = new Map<string, string>(
  CATEGORIAS_BUSCA.flatMap((c) => c.facetas.map((f) => [f.chave, f.param ?? f.chave] as const)),
);

/** Nome na URL da faceta de chave `chave` (a chave, salvo colisão com reservado). */
export function paramDaFaceta(chave: string): string {
  return PARAM_DA_CHAVE.get(chave) ?? chave;
}

export type BuscarSearch = {
  q?: string;
  tipo?: CategoriaBuscaId;
  ordem?: OrdemBusca;
  pagina?: number;
  itens?: number;
  ate?: string;
} & { [faceta: string]: string | number | undefined };

const ATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})$/;

/** `validateSearch` da rota: descarta o que não é do contrato. */
export function validarBuscarSearch(s: Record<string, unknown>): BuscarSearch {
  const texto = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
  const out: BuscarSearch = {};
  const q = texto(s.q);
  if (q) out.q = q.slice(0, 200);
  const tipo = texto(s.tipo);
  if (tipo && categoriaBusca(tipo)?.ativa) out.tipo = tipo as CategoriaBuscaId;
  const ordem = texto(s.ordem);
  if (ordem && (ORDENS_BUSCA as readonly string[]).includes(ordem)) out.ordem = ordem as OrdemBusca;
  const pagina = Math.floor(Number(s.pagina));
  if (pagina > 1) out.pagina = pagina;
  const itens = Number(s.itens);
  if ((ITENS_BUSCA as readonly number[]).includes(itens) && itens !== ITENS_BUSCA_PADRAO) {
    out.itens = itens;
  }
  const ate = texto(s.ate);
  if (ate && ATE_RE.test(ate)) out.ate = ate;
  for (const chave of CHAVES_FACETA) {
    const param = paramDaFaceta(chave);
    const v = typeof s[param] === "number" ? String(s[param]) : texto(s[param]);
    if (v) out[param] = v;
  }
  return out;
}

export function valoresDaFaceta(search: BuscarSearch, chave: string): string[] {
  const v = search[paramDaFaceta(chave)];
  return typeof v === "string" && v ? v.split(SEPARADOR_VALORES).filter(Boolean) : [];
}

export function filtrosDaSearch(search: BuscarSearch): FiltrosBusca {
  const especificas: Record<string, string[]> = {};
  for (const chave of CHAVES_ESPECIFICAS) {
    const v = valoresDaFaceta(search, chave);
    if (v.length) especificas[chave] = v;
  }
  return {
    fonte: valoresDaFaceta(search, "fonte"),
    uf: valoresDaFaceta(search, "uf"),
    ano: valoresDaFaceta(search, "ano"),
    ...(Object.keys(especificas).length ? { especificas } : {}),
  };
}

/** Busca nova a partir do estado atual: página 1, sem corte (ao vivo). */
function recomecar(search: BuscarSearch, patch: Partial<BuscarSearch>): BuscarSearch {
  const prox: BuscarSearch = { ...search, ...patch, pagina: undefined, ate: undefined };
  for (const k of Object.keys(prox)) if (prox[k] === undefined || prox[k] === "") delete prox[k];
  return prox;
}

export function alternarValor(search: BuscarSearch, chave: string, valor: string): BuscarSearch {
  const atuais = valoresDaFaceta(search, chave);
  const prox = atuais.includes(valor) ? atuais.filter((v) => v !== valor) : [...atuais, valor];
  return recomecar(search, { [paramDaFaceta(chave)]: prox.join(SEPARADOR_VALORES) || undefined });
}

/** Aplica de uma vez um conjunto de filtros (painel mobile). */
export function aplicarFiltros(
  search: BuscarSearch,
  filtros: Record<string, string[]>,
): BuscarSearch {
  const patch: Partial<BuscarSearch> = {};
  for (const chave of CHAVES_FACETA) {
    patch[paramDaFaceta(chave)] = (filtros[chave] ?? []).join(SEPARADOR_VALORES) || undefined;
  }
  return recomecar(search, patch);
}

export function limparFiltros(search: BuscarSearch): BuscarSearch {
  return aplicarFiltros(search, {});
}

export function novaConsulta(search: BuscarSearch, q: string): BuscarSearch {
  return recomecar(search, { q: q.trim() || undefined });
}

export function mudarOrdem(search: BuscarSearch, ordem: OrdemBusca): BuscarSearch {
  return recomecar(search, { ordem: ordem === "relevancia" ? undefined : ordem });
}

export function mudarItens(search: BuscarSearch, itens: number): BuscarSearch {
  return recomecar(search, { itens: itens === ITENS_BUSCA_PADRAO ? undefined : itens });
}

/** Tira o corte: mostra os resultados novos. */
export function atualizarResultados(search: BuscarSearch): BuscarSearch {
  return recomecar(search, {});
}

/** Página `pagina` com o corte da resposta, para todas as páginas mostrarem o mesmo recorte. */
export function searchDaPagina(search: BuscarSearch, pagina: number, corte: string): BuscarSearch {
  return { ...search, pagina: pagina > 1 ? pagina : undefined, ate: corte };
}

// ---------------------------------------------------------------------------
// Troca de categoria

export type Incompativel = { chave: string; rotulo: string; valores: string[] };

/** Filtros próprios que deixam de valer ao ir para `destino` (null = visão geral). */
export function incompativeis(
  search: BuscarSearch,
  destino: CategoriaBuscaId | null,
): Incompativel[] {
  if (!destino) return [];
  const aceitas = new Set(categoriaBusca(destino)!.facetas.map((f) => f.chave));
  return CHAVES_ESPECIFICAS.filter((c) => !aceitas.has(c))
    .map((chave) => ({
      chave,
      rotulo: rotuloFaceta(chave),
      valores: valoresDaFaceta(search, chave),
    }))
    .filter((x) => x.valores.length > 0);
}

/** Vai para a categoria (ou a visão geral), retirando os filtros incompatíveis. */
export function irParaCategoria(
  search: BuscarSearch,
  destino: CategoriaBuscaId | null,
): BuscarSearch {
  const patch: Partial<BuscarSearch> = { tipo: destino ?? undefined };
  for (const x of incompativeis(search, destino)) patch[paramDaFaceta(x.chave)] = undefined;
  return recomecar(search, patch);
}

// ---------------------------------------------------------------------------
// Rótulos e chips

const ROTULOS_UNIVERSAIS: Record<string, string> = { fonte: "Fonte", uf: "UF", ano: "Ano" };

export function rotuloFaceta(chave: string): string {
  if (ROTULOS_UNIVERSAIS[chave]) return ROTULOS_UNIVERSAIS[chave];
  for (const c of CATEGORIAS_BUSCA) {
    const f = c.facetas.find((x) => x.chave === chave);
    if (f) return f.rotulo;
  }
  return chave;
}

export function rotuloValor(valor: string): string {
  return valor === VALOR_VAZIO ? "Sem informação" : valor;
}

/** Categorias ativas em que uma faceta própria vale (para o aviso do chip). */
export function categoriasDaFaceta(chave: string): string[] {
  return CATEGORIAS_BUSCA.filter((c) => c.ativa && c.facetas.some((f) => f.chave === chave)).map(
    (c) => c.rotulo,
  );
}

export type Chip = { chave: string; valor: string; texto: string; aviso: string | null };

/**
 * Chips dos filtros aplicados. Na visão geral, filtro próprio de algumas
 * categorias ganha o aviso "só em …".
 */
export function chipsDaSearch(search: BuscarSearch): Chip[] {
  return CHAVES_FACETA.flatMap((chave) =>
    valoresDaFaceta(search, chave).map((valor) => {
      const especifica = !(FACETAS_UNIVERSAIS as readonly string[]).includes(chave);
      return {
        chave,
        valor,
        texto: `${rotuloFaceta(chave)}: ${rotuloValor(valor)}`,
        aviso:
          especifica && !search.tipo ? `só em ${juntarLista(categoriasDaFaceta(chave))}` : null,
      };
    }),
  );
}

function juntarLista(itens: string[]): string {
  if (itens.length <= 1) return itens[0] ?? "";
  return `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`;
}

// ---------------------------------------------------------------------------
// Visão geral e estados

export type GrupoResumo = {
  categoria: CategoriaBuscaId;
  rotulo: string;
  total: number | null;
  previas: ItemBusca[];
};

/**
 * Todas as categorias ativas na ordem fixa do produto, inclusive as sem
 * resultado (título e contagem zero). Com a contagem indisponível, a
 * categoria sem prévia fica com total nulo.
 */
export function gruposDoResumo(resumo: ResumoBusca): GrupoResumo[] {
  const porCategoria = new Map(resumo.categorias.map((c) => [c.categoria, c]));
  return CATEGORIAS_BUSCA.filter((c) => c.ativa).map((c) => {
    const r = porCategoria.get(c.id);
    return {
      categoria: c.id,
      rotulo: c.rotulo,
      total: resumo.contado ? (r?.total ?? 0) : null,
      previas: r?.previas ?? [],
    };
  });
}

/** Os dois primeiros grupos com resultado começam abertos. */
export function gruposAbertosIniciais(grupos: GrupoResumo[]): CategoriaBuscaId[] {
  return grupos
    .filter((g) => g.previas.length > 0)
    .slice(0, 2)
    .map((g) => g.categoria);
}

export type EstadoBuscar = "inicial" | "carregando" | "erro" | "vazio" | "pronto";

export function deriveEstado(input: {
  temConsulta: boolean;
  carregando: boolean;
  temErro: boolean;
  temResultados: boolean;
}): EstadoBuscar {
  if (!input.temConsulta) return "inicial";
  if (input.carregando) return "carregando";
  if (input.temErro) return "erro";
  return input.temResultados ? "pronto" : "vazio";
}

export function temFiltros(search: BuscarSearch): boolean {
  return CHAVES_FACETA.some((c) => valoresDaFaceta(search, c).length > 0);
}

// ---------------------------------------------------------------------------
// Formatação

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Data com a precisão que a fonte tem: ano, mês/ano ou dia. */
export function formatarData(data: NonNullable<ItemBusca["data"]>): string {
  const [ano, mes, dia] = data.valor.slice(0, 10).split("-");
  if (data.precisao === "ano") return ano;
  if (data.precisao === "mes") return `${MESES[Number(mes) - 1]}/${ano}`;
  return `${dia}/${mes}/${ano}`;
}

/** Rótulo da data: o da categoria, ou a natureza quando o significado varia. */
export function rotuloData(item: ItemBusca): string {
  const daCategoria = categoriaBusca(item.categoria)?.rotuloData;
  if (daCategoria) return daCategoria;
  const natureza = item.data?.natureza as NaturezaData | undefined;
  return natureza ? ROTULO_NATUREZA_DATA[natureza] : "Data";
}

export function formatarValor(valor: NonNullable<ItemBusca["valor"]>): string {
  if (valor.unidade === "BRL") {
    return valor.n.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    });
  }
  return `${valor.n.toLocaleString("pt-BR")} ${valor.unidade}`;
}

export function formatarTotal(total: number | null): string {
  return total === null ? "contagem indisponível" : total.toLocaleString("pt-BR");
}

/** "21–40 de 179" (ou "21–40" quando o total não está disponível). */
export function intervaloDaPagina(
  pagina: number,
  itens: number,
  quantidade: number,
  total: number | null,
): string {
  if (quantidade === 0) return total === null ? "0" : `0 de ${total.toLocaleString("pt-BR")}`;
  const de = (pagina - 1) * itens + 1;
  const ate = de + quantidade - 1;
  const faixa = `${de.toLocaleString("pt-BR")}–${ate.toLocaleString("pt-BR")}`;
  return total === null ? faixa : `${faixa} de ${total.toLocaleString("pt-BR")}`;
}
