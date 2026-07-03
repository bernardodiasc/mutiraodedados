/**
 * Serialização canônica do snapshot de um item salvo: chaves ordenadas e
 * campos voláteis fora (updated_at/created_at mudam a cada re-ingestão sem o
 * dado ter mudado). A MESMA função roda no salvar (client) e no verificar
 * (server) — igualdade de string ⇒ igualdade de hash.
 */

const CHAVES_VOLATEIS = new Set(["updated_at", "created_at"]);

function canonizar(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canonizar);
  if (v && typeof v === "object") {
    const obj = v as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(obj).sort()) {
      if (CHAVES_VOLATEIS.has(k)) continue;
      out[k] = canonizar(obj[k]);
    }
    return out;
  }
  return v;
}

export function serializarSnapshot(valor: unknown): string {
  return JSON.stringify(canonizar(valor), null, 2);
}

/** Texto pronto para colar numa IA: título, fonte oficial e dados canônicos. */
export function textoCopiavelDeEntidade(
  titulo: string,
  fonteOficial: string | null | undefined,
  dados: unknown,
): string {
  const partes = [`# ${titulo}`];
  if (fonteOficial) partes.push(`Fonte oficial: ${fonteOficial}`);
  partes.push("", serializarSnapshot(dados));
  return partes.join("\n");
}

/** Tipos cuja verificação "ao vivo" é suportada (têm server fn por id).
 * `fornecedor` e `orgao` ficam DE FORA por decisão (jul/2026): o snapshot deles
 * é um agregado derivado (total recebido, nº de contratos) que muda a cada
 * re-ingestão — "verificar mudança" apitaria divergência sem mudança real
 * relevante (ruído). Só registros diretos entram aqui. */
export const TIPOS_VERIFICAVEIS = ["contrato", "emenda", "convenio", "licitacao"] as const;

export function tipoVerificavel(tipo: string): boolean {
  return (TIPOS_VERIFICAVEIS as readonly string[]).includes(tipo);
}
