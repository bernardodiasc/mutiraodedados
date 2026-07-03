import { describe, it, expect } from "vitest";
import { mesclarOrdemFiltrada, moverPara, ordemMudou } from "./logic";

describe("moverPara", () => {
  const ids = ["a", "b", "c", "d"];
  it("move para baixo", () => {
    expect(moverPara(ids, "a", "c")).toEqual(["b", "c", "a", "d"]);
  });
  it("move para cima", () => {
    expect(moverPara(ids, "d", "b")).toEqual(["a", "d", "b", "c"]);
  });
  it("mover para o mesmo lugar não muda", () => {
    expect(moverPara(ids, "b", "b")).toEqual(ids);
  });
  it("id inexistente devolve original", () => {
    expect(moverPara(ids, "x", "b")).toEqual(ids);
  });
  it("mover primeiro para o último", () => {
    expect(moverPara(ids, "a", "d")).toEqual(["b", "c", "d", "a"]);
  });
});

describe("mesclarOrdemFiltrada", () => {
  it("mantém ocultos fixos e recoloca os visíveis", () => {
    // visíveis eram B,C,E; reordenados para E,B,C
    expect(mesclarOrdemFiltrada(["A", "B", "C", "D", "E"], ["E", "B", "C"])).toEqual([
      "A",
      "E",
      "B",
      "D",
      "C",
    ]);
  });
  it("sem filtro (todos visíveis) devolve a nova ordem", () => {
    expect(mesclarOrdemFiltrada(["A", "B", "C"], ["C", "A", "B"])).toEqual(["C", "A", "B"]);
  });
  it("reordenar um único item visível não muda nada", () => {
    expect(mesclarOrdemFiltrada(["A", "B", "C"], ["B"])).toEqual(["A", "B", "C"]);
  });
});

describe("ordemMudou", () => {
  it("detecta mudança", () => {
    expect(ordemMudou(["a", "b"], ["b", "a"])).toBe(true);
  });
  it("igual não mudou", () => {
    expect(ordemMudou(["a", "b"], ["a", "b"])).toBe(false);
  });
});
