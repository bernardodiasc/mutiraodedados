import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { CATEGORIAS_BUSCA, ROTULO_NATUREZA_DATA } from "./categorias";

const PASTA_MIGRATIONS = join(__dirname, "../../../drizzle/migrations");

/** Lista entre parênteses que segue `trecho` na migration do índice. */
function listaDoCheck(sql: string, trecho: string): string[] {
  const inicio = sql.indexOf(trecho);
  const lista = sql.slice(inicio + trecho.length, sql.indexOf(")", inicio + trecho.length));
  return [...lista.matchAll(/'([a-z]+)'/g)].map((m) => m[1]);
}

const sql = readFileSync(
  join(
    PASTA_MIGRATIONS,
    readdirSync(PASTA_MIGRATIONS).find((f) => f.endsWith("_busca_indice.sql"))!,
  ),
  "utf8",
);

describe("categorias da busca", () => {
  it("têm ids únicos e são as 20 da taxonomia", () => {
    const ids = CATEGORIAS_BUSCA.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(20);
  });

  it("batem, na mesma ordem, com o CHECK de busca_indice.categoria", () => {
    expect(listaDoCheck(sql, "CHECK (categoria IN (")).toEqual(CATEGORIAS_BUSCA.map((c) => c.id));
  });

  it("naturezas de data batem com o CHECK de busca_indice.data_natureza", () => {
    expect(listaDoCheck(sql, "CHECK (data_natureza IN\n    (")).toEqual(
      Object.keys(ROTULO_NATUREZA_DATA),
    );
  });

  it("toda categoria ativa tem projeção na migration", () => {
    const ativas = CATEGORIAS_BUSCA.filter((c) => c.ativa).map((c) => c.id);
    for (const id of ativas) expect(sql).toMatch(new RegExp(`, '${id}', `));
  });

  it("chaves de faceta são únicas dentro de cada categoria", () => {
    for (const c of CATEGORIAS_BUSCA) {
      const chaves = c.facetas.map((f) => f.chave);
      expect(new Set(chaves).size).toBe(chaves.length);
    }
  });
});
