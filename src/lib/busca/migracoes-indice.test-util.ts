/**
 * Leitura das migrations do índice de busca para os testes-guarda: quais
 * tabelas têm gatilho de índice e que categoria cada projeção grava. Lê todas
 * as migrations em ordem — a definição mais recente vale.
 */
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const PASTA = fileURLToPath(new URL("../../../drizzle/migrations/", import.meta.url));

function migracoes(): string[] {
  return readdirSync(PASTA)
    .filter((f) => /^\d{4}_.*\.sql$/.test(f))
    .sort()
    .map((f) => readFileSync(PASTA + f, "utf8"));
}

/**
 * Tabelas com gatilho de índice: os blocos VALUES dos laços que criavam os
 * gatilhos (até a 0017) e as chamadas a `busca_registrar_colecao` (desde a 0021).
 */
export function colecoesComGatilho(): Set<string> {
  const r = new Set<string>();
  for (const sql of migracoes()) {
    for (const m of sql.matchAll(/busca_registrar_colecao\(\s*'([a-z_]+)'/g)) r.add(m[1]);
    const ini = sql.indexOf("FOR alvo IN SELECT");
    if (ini < 0) continue;
    const bloco = sql.slice(ini, sql.indexOf(") AS t(tabela, chave)", ini));
    for (const m of bloco.matchAll(/\('([a-z_]+)',/g)) r.add(m[1]);
  }
  return r;
}

/** Categoria gravada por projeção: `SELECT '<coleção>', <id>, '<categoria>'`. */
export function categoriaDasProjecoes(): Map<string, string> {
  const r = new Map<string, string>();
  for (const sql of migracoes()) {
    for (const m of sql.matchAll(/SELECT '([a-z_]+)', [^\n]*?, '([a-z_]+)'/g)) r.set(m[1], m[2]);
  }
  return r;
}
