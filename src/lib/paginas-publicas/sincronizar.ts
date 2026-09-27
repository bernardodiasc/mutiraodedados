/**
 * Sincronização lista do código → tabela `paginas_publicas`, lógica pura.
 * Só as linhas novas ou alteradas são gravadas (os gatilhos reindexam o que
 * muda), e as que saíram da lista são apagadas (e saem do índice).
 */
import type { LinhaPaginaPublica } from "./lista";

export type PlanoSincronizacao = {
  novas: LinhaPaginaPublica[];
  alteradas: LinhaPaginaPublica[];
  /** Ids na tabela que não estão mais na lista. */
  removidas: string[];
  iguais: number;
};

const CAMPOS = ["rota", "ancora", "pagina", "titulo", "resumo", "palavras", "texto"] as const;

function iguais(a: LinhaPaginaPublica, b: LinhaPaginaPublica): boolean {
  return CAMPOS.every((c) => (a[c] ?? null) === (b[c] ?? null));
}

export function planoSincronizacao(
  codigo: readonly LinhaPaginaPublica[],
  banco: readonly LinhaPaginaPublica[],
): PlanoSincronizacao {
  const noBanco = new Map(banco.map((l) => [l.id, l]));
  const noCodigo = new Set(codigo.map((l) => l.id));
  const plano: PlanoSincronizacao = { novas: [], alteradas: [], removidas: [], iguais: 0 };
  for (const l of codigo) {
    const atual = noBanco.get(l.id);
    if (!atual) plano.novas.push(l);
    else if (!iguais(l, atual)) plano.alteradas.push(l);
    else plano.iguais++;
  }
  plano.removidas = banco.filter((l) => !noCodigo.has(l.id)).map((l) => l.id);
  return plano;
}

/** Resumo do plano, para a tela: contagens e os ids que mudam. */
export type ResumoSincronizacao = {
  novas: string[];
  alteradas: string[];
  removidas: string[];
  iguais: number;
};

export function resumoSincronizacao(p: PlanoSincronizacao): ResumoSincronizacao {
  return {
    novas: p.novas.map((l) => l.id),
    alteradas: p.alteradas.map((l) => l.id),
    removidas: p.removidas,
    iguais: p.iguais,
  };
}

export function emDia(r: ResumoSincronizacao): boolean {
  return r.novas.length + r.alteradas.length + r.removidas.length === 0;
}
