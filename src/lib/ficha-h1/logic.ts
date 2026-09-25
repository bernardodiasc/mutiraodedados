import { sanitizarTextoPublico } from "@/lib/sanitize";

/**
 * Texto do H1 de cada ficha de registro. A mesma função serve ao componente
 * (que renderiza o H1) e ao loader da rota (que monta o título da aba), para
 * os dois nunca divergirem.
 */

export function h1DoContrato(c: { objeto: string }): string {
  return sanitizarTextoPublico(c.objeto);
}

export function h1DoContratoPncp(c: { objeto: string | null; numero_controle_pncp: string }) {
  return c.objeto ? sanitizarTextoPublico(c.objeto) : `Contrato ${c.numero_controle_pncp}`;
}

export function h1DoConvenio(c: { objeto: string | null; numero: string | null; id: string }) {
  return c.objeto ? sanitizarTextoPublico(c.objeto) : `Convênio ${c.numero ?? c.id}`;
}

export function h1DaLicitacao(l: { objeto: string | null; numero: string | null }): string {
  return l.objeto ? sanitizarTextoPublico(l.objeto) : `Licitação ${l.numero ?? ""}`;
}

export function h1DaEmenda(e: { autor: string | null }): string {
  return e.autor ?? "Emenda";
}

type ComNome = { nome: string } | null | undefined;

/** Card curado das demais esferas > catálogo `orgaos_cache` > "Órgão {cod}". */
export function h1DoOrgao(o: { cod: string; curado: ComNome; catalogo: ComNome }): string {
  return o.curado?.nome ?? o.catalogo?.nome ?? `Órgão ${o.cod}`;
}

/**
 * H1 do órgão para o loader: o card curado não exige consulta; sem ele, busca
 * o nome no catálogo. Falha na consulta → `null` (título padrão da aba).
 */
export async function resolverH1DoOrgao(
  cod: string,
  curados: readonly { cod: string; nome: string }[],
  buscarNomeNoCatalogo: () => Promise<{ nome: string | null }>,
): Promise<string | null> {
  const curado = curados.find((o) => o.cod === cod);
  if (curado) return h1DoOrgao({ cod, curado, catalogo: null });
  try {
    const { nome } = await buscarNomeNoCatalogo();
    return h1DoOrgao({ cod, curado: null, catalogo: nome ? { nome } : null });
  } catch {
    return null;
  }
}
