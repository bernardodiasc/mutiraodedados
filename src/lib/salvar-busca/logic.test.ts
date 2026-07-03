import { describe, it, expect } from "vitest";
import { chaveDaBusca, resumoDaBusca } from "./logic";

describe("chaveDaBusca", () => {
  it("sem filtros ativos devolve só o path", () => {
    expect(chaveDaBusca("/emendas", {})).toBe("/emendas");
    expect(chaveDaBusca("/emendas", { uf: "", ano: 0, q: undefined })).toBe("/emendas");
  });

  it("ordena as chaves e ignora vazios/zero/false", () => {
    expect(
      chaveDaBusca("/emendas", { uf: "SP", ano: 2024, funcao: "", valorMin: 0, ativo: false }),
    ).toBe("/emendas?ano=2024&uf=SP");
  });

  it("é determinística independentemente da ordem de entrada", () => {
    const a = chaveDaBusca("/x", { b: "2", a: "1" });
    const b = chaveDaBusca("/x", { a: "1", b: "2" });
    expect(a).toBe(b);
    expect(a).toBe("/x?a=1&b=2");
  });
});

describe("resumoDaBusca", () => {
  it("formata rótulo + valor e junta por separador", () => {
    expect(
      resumoDaBusca([
        ["UF", "SP"],
        ["ano", 2024],
      ]),
    ).toBe("UF SP · ano 2024");
  });

  it("ignora filtros inativos", () => {
    expect(
      resumoDaBusca([
        ["UF", ""],
        ["ano", 0],
        ["busca", "merenda"],
      ]),
    ).toBe("busca merenda");
  });

  it("vazio quando nada ativo", () => {
    expect(resumoDaBusca([["UF", ""]])).toBe("");
  });
});
