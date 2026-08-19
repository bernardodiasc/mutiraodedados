import {
  CATEGORIAS_BEM_ORDEM,
  ROTULO_CATEGORIA_BEM,
  type AgregadoCategoria,
  type CategoriaBem,
} from "@/lib/data/tse/categorias-bens";

export type Estado = "carregando" | "erro" | "nao-encontrado" | "pronto";

export function deriveEstado(input: {
  carregando: boolean;
  temErro: boolean;
  encontrado: boolean;
}): Estado {
  if (input.carregando) return "carregando";
  if (input.temErro) return "erro";
  if (!input.encontrado) return "nao-encontrado";
  return "pronto";
}

export type BemDeclarado = {
  ordem: number;
  tipo: string;
  descricao: string;
  valor: number | null;
};

export type CandidaturaAnterior = {
  ano: number;
  cargo: string;
  situacao: string;
  sq: string;
};

/** Soma dos bens listados (fallback quando o agregado ainda não foi calculado). */
export function somaBens(bens: Array<{ valor: number | null }>): number {
  return bens.reduce((s, b) => s + (b.valor ?? 0), 0);
}

/**
 * Patrimônio a exibir para uma candidatura.
 *
 * `null` e `0` NÃO são a mesma coisa: null é "o TSE não divulgou, ou a
 * importação de bens ainda não rodou"; 0 é "declarou patrimônio zero". Devolver
 * 0 no primeiro caso — que era o comportamento antigo, `total ?? somaBens([])` —
 * afirma ao leitor um fato que a fonte não sustenta.
 */
export function totalPatrimonio(
  total: number | null | undefined,
  bens: Array<{ valor: number | null }>,
): number | null {
  if (total != null) return total;
  if (bens.length === 0) return null;
  return somaBens(bens);
}

// ---------------------------------------------------------------------------
// Histórico de candidaturas e evolução patrimonial
// ---------------------------------------------------------------------------

export type MotivoSemVariacao =
  | "sem-anterior"
  | "anterior-ausente"
  | "atual-ausente"
  | "anterior-zero";

/**
 * Variação entre duas declarações.
 *
 * `fracao` é nula sempre que o percentual seria indefinido ou enganoso, e
 * `motivo` diz por quê — nunca `Infinity`, nunca `NaN`. O `delta` sobrevive
 * quando os dois lados existem, inclusive partindo de zero: sair de R$ 0 para
 * R$ 500 mil é informação real, só não é uma porcentagem.
 */
export type Variacao = {
  delta: number | null;
  fracao: number | null;
  motivo: MotivoSemVariacao | null;
};

export function variacaoEntre(anterior: number | null, atual: number | null): Variacao {
  if (atual == null) return { delta: null, fracao: null, motivo: "atual-ausente" };
  if (anterior == null) return { delta: null, fracao: null, motivo: "anterior-ausente" };
  const delta = atual - anterior;
  // Base <= 0 não gera percentual: dividir por zero explode e dividir por
  // negativo inverte o sinal do crescimento.
  if (anterior <= 0) return { delta, fracao: null, motivo: "anterior-zero" };
  return { delta, fracao: delta / anterior, motivo: null };
}

export type CandidaturaHistorico = {
  sq: string;
  ano: number;
  turno: number;
  cargo: string | null;
  uf: string | null;
  partido: string | null;
  situacao: string | null;
  bensTotal: number | null;
  atual: boolean;
};

/** Mais recente primeiro; no mesmo ano, turno mais alto primeiro. */
export function ordenarHistorico(rows: CandidaturaHistorico[]): CandidaturaHistorico[] {
  return [...rows].sort((a, b) => b.ano - a.ano || b.turno - a.turno || a.sq.localeCompare(b.sq));
}

/**
 * Um ponto por ano, para o gráfico e para a variação.
 *
 * Dois `sq` distintos no mesmo ano são anomalia de dado (registro anulado,
 * substituição), não os dois turnos — turno é coluna, não linha. Quando
 * acontece, elege um representante em vez de plotar duas barras no mesmo ano:
 * maior turno, desempatando por quem tem patrimônio declarado.
 */
export function agruparPorAno(rows: CandidaturaHistorico[]): Array<{
  ano: number;
  representante: CandidaturaHistorico;
  outras: CandidaturaHistorico[];
}> {
  const porAno = new Map<number, CandidaturaHistorico[]>();
  for (const r of rows) porAno.set(r.ano, [...(porAno.get(r.ano) ?? []), r]);

  return [...porAno.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([ano, lista]) => {
      const ordenada = [...lista].sort(
        (a, b) =>
          b.turno - a.turno ||
          Number(b.bensTotal != null) - Number(a.bensTotal != null) ||
          b.sq.localeCompare(a.sq),
      );
      return { ano, representante: ordenada[0], outras: ordenada.slice(1) };
    });
}

/** Série ascendente por ano. `null` sobrevive como `null`. */
export function serieBens(
  rows: CandidaturaHistorico[],
): Array<{ ano: number; total: number | null }> {
  return agruparPorAno(rows)
    .map((g) => ({ ano: g.ano, total: g.representante.bensTotal }))
    .sort((a, b) => a.ano - b.ano);
}

export type CandidaturaAnotada = CandidaturaHistorico & {
  variacao: Variacao;
  outrasNoMesmoAno: number;
};

/**
 * Anexa a variação contra a candidatura IMEDIATAMENTE anterior.
 *
 * Se a anterior não tem patrimônio declarado, o resultado é "anterior-ausente" —
 * e não um salto para o ano mais antigo que tenha dado. Comparar 2014 com 2022
 * rotulando como se fossem consecutivos seria mais enganoso do que não comparar.
 */
export function anotarVariacoes(rows: CandidaturaHistorico[]): CandidaturaAnotada[] {
  const grupos = agruparPorAno(rows); // desc por ano
  return grupos.map((g, i) => {
    const anterior = grupos[i + 1]; // o próximo na lista desc é o ano anterior
    return {
      ...g.representante,
      outrasNoMesmoAno: g.outras.length,
      variacao: anterior
        ? variacaoEntre(anterior.representante.bensTotal, g.representante.bensTotal)
        : { delta: null, fracao: null, motivo: "sem-anterior" as const },
    };
  });
}

export type BarraPatrimonio = {
  ano: number;
  total: number | null;
  alturaPct: number;
  /** Sem dado: renderizar lacuna, jamais uma barra rente ao chão. */
  ausente: boolean;
  /** Declarou zero: renderizar traço na linha de base. */
  zero: boolean;
};

/** Geometria do minigráfico. Altura mínima visível de 4% para barras não-nulas. */
export function barrasPatrimonio(
  serie: Array<{ ano: number; total: number | null }>,
): BarraPatrimonio[] {
  const maximo = Math.max(0, ...serie.map((p) => p.total ?? 0));
  return serie.map((p) => {
    const ausente = p.total == null;
    const zero = p.total === 0;
    const positivo = p.total != null && p.total > 0;
    return {
      ano: p.ano,
      total: p.total,
      alturaPct: positivo && maximo > 0 ? Math.max(4, ((p.total as number) / maximo) * 100) : 0,
      ausente,
      zero,
    };
  });
}

/**
 * Candidatura que o comparador abre por padrão: a mais recente ANTES da atual.
 * Não havendo anterior (a atual é a estreia), oferece a mais próxima à frente —
 * comparar para trás no tempo ainda responde "quanto mudou entre as duas".
 */
export function candidaturaComparacaoPadrao(
  rows: CandidaturaHistorico[],
  anoAtual: number,
): CandidaturaHistorico | null {
  const grupos = agruparPorAno(rows).map((g) => g.representante);
  const anteriores = grupos.filter((c) => c.ano < anoAtual);
  if (anteriores.length > 0) return anteriores[0]; // já desc por ano
  const posteriores = grupos.filter((c) => c.ano > anoAtual);
  return posteriores.length > 0 ? posteriores[posteriores.length - 1] : null;
}

export type LinhaDiffCategoria = {
  categoria: CategoriaBem;
  rotulo: string;
  totalA: number;
  totalB: number;
  variacao: Variacao;
};

/**
 * Diff por categoria entre duas candidaturas (A = mais antiga, B = mais nova).
 *
 * Devolve a união dos dois lados na ordem de CATEGORIAS_BEM_ORDEM — é isso que
 * mantém as colunas alinhadas linha a linha, independentemente da ordem em que
 * as categorias apareceram em cada declaração.
 */
export function diffCategorias(
  a: AgregadoCategoria[],
  b: AgregadoCategoria[],
): LinhaDiffCategoria[] {
  const mapaA = new Map(a.map((x) => [x.categoria, x.total]));
  const mapaB = new Map(b.map((x) => [x.categoria, x.total]));
  return CATEGORIAS_BEM_ORDEM.filter((c) => mapaA.has(c) || mapaB.has(c)).map((categoria) => {
    const totalA = mapaA.get(categoria) ?? 0;
    const totalB = mapaB.get(categoria) ?? 0;
    return {
      categoria,
      rotulo: ROTULO_CATEGORIA_BEM[categoria],
      totalA,
      totalB,
      variacao: variacaoEntre(totalA, totalB),
    };
  });
}

/** Rótulo curto da ficha: "Senador · AC · PSB · 2022". */
export function subtituloFicha(c: {
  cargo_nome: string | null;
  uf: string | null;
  partido_sigla: string | null;
  ano_eleicao: number;
}): string {
  return [c.cargo_nome, c.uf, c.partido_sigla, String(c.ano_eleicao)].filter(Boolean).join(" · ");
}
