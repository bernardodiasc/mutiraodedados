import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FONTES_ARTIGO, alternarFonte, eFonteArtigo } from "./fontes";

describe("fontes do artigo", () => {
  it("alternar mantém a ordem da lista controlada", () => {
    expect(alternarFonte(["TSE"], "CGU")).toEqual(["CGU", "TSE"]);
    expect(alternarFonte(["CGU", "TSE"], "CGU")).toEqual(["TSE"]);
  });

  it("reconhece só valores da lista", () => {
    expect(eFonteArtigo("PNCP")).toBe(true);
    expect(eFonteArtigo("pncp")).toBe(false);
    expect(eFonteArtigo("Lei 14.133/2021")).toBe(false);
  });

  it("a migration que normaliza os valores antigos mapeia para a lista e cobre cada rótulo", () => {
    const pasta = fileURLToPath(new URL("../../../drizzle/migrations/", import.meta.url));
    const sql = readFileSync(
      pasta + readdirSync(pasta).find((f) => f.endsWith("_artigos_fontes_controladas.sql"))!,
      "utf8",
    );
    const destinos = new Set([...sql.matchAll(/\('[^']+', '([^']+)'\)/g)].map((m) => m[1]));
    for (const d of destinos) expect(FONTES_ARTIGO, d).toContain(d);
    // Idempotente: todo rótulo da lista mapeia para ele mesmo.
    for (const f of FONTES_ARTIGO) {
      expect(sql, f).toContain(`('${f.toLowerCase()}', '${f}')`);
    }
  });
});
