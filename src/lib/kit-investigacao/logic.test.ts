import { describe, it, expect } from "vitest";
import { normalizarVariavel, descreverVariaveis } from "./logic";

describe("normalizarVariavel", () => {
  it("objeto com dica e link interno é preservado", () => {
    const v = normalizarVariavel({
      nome: "cole_o_csv",
      dica: "Exporte em Emendas.",
      href: "/emendas",
      hrefLabel: "Emendas",
    });
    expect(v.rotulo).toBe("Cole o csv");
    expect(v.dica).toBe("Exporte em Emendas.");
    expect(v.href).toBe("/emendas");
    expect(v.hrefLabel).toBe("Emendas");
  });

  it("string legada vira objeto com defaults", () => {
    const v = normalizarVariavel("ano");
    expect(v.nome).toBe("ano");
    expect(v.rotulo).toBe("Ano");
    expect(v.dica).toMatch(/preencha/i);
    expect(v.href).toBeUndefined();
  });

  it("descarta link externo (só rotas internas)", () => {
    const v = normalizarVariavel({ nome: "x", href: "https://evil.com" });
    expect(v.href).toBeUndefined();
    expect(v.hrefLabel).toBeUndefined();
  });

  it("href sem hrefLabel ganha rótulo padrão", () => {
    const v = normalizarVariavel({ nome: "x", href: "/emendas" });
    expect(v.hrefLabel).toBe("Abrir");
  });
});

describe("descreverVariaveis", () => {
  it("mapeia lista mista preservando a ordem", () => {
    const r = descreverVariaveis(["parlamentar", { nome: "ano", dica: "Ano." }]);
    expect(r.map((v) => v.nome)).toEqual(["parlamentar", "ano"]);
  });
  it("tolera null/undefined", () => {
    expect(descreverVariaveis(null)).toEqual([]);
    expect(descreverVariaveis(undefined)).toEqual([]);
  });
});
