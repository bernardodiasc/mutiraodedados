import { describe, it, expect } from "vitest";
import { serializarSnapshot, textoCopiavelDeEntidade, tipoVerificavel } from "./logic";

describe("serializarSnapshot", () => {
  it("ordena chaves e é determinística independentemente da ordem de entrada", () => {
    const a = serializarSnapshot({ b: 2, a: 1 });
    const b = serializarSnapshot({ a: 1, b: 2 });
    expect(a).toBe(b);
  });

  it("remove campos voláteis (updated_at/created_at)", () => {
    const s = serializarSnapshot({ valor: 100, updated_at: "x", created_at: "y" });
    expect(s).not.toContain("updated_at");
    expect(s).not.toContain("created_at");
    expect(s).toContain("valor");
  });

  it("normaliza aninhamentos e arrays recursivamente", () => {
    const a = serializarSnapshot({ lista: [{ z: 1, a: 2 }], updated_at: "1" });
    const b = serializarSnapshot({ lista: [{ a: 2, z: 1 }] });
    expect(a).toBe(b);
  });
});

describe("textoCopiavelDeEntidade", () => {
  it("inclui título, fonte oficial e dados serializados", () => {
    const t = textoCopiavelDeEntidade("Contrato X", "https://portal.gov/x", { valor: 10 });
    expect(t).toContain("# Contrato X");
    expect(t).toContain("Fonte oficial: https://portal.gov/x");
    expect(t).toContain("valor");
  });

  it("omite a linha de fonte quando ausente", () => {
    const t = textoCopiavelDeEntidade("Órgão Y", null, { cod: "1" });
    expect(t).not.toContain("Fonte oficial");
    expect(t).toContain("# Órgão Y");
  });
});

describe("tipoVerificavel", () => {
  it("verdadeiro para tipos com fn de detalhe por id", () => {
    expect(tipoVerificavel("contrato")).toBe(true);
    expect(tipoVerificavel("emenda")).toBe(true);
  });
  it("falso para tipos sem fn por id", () => {
    expect(tipoVerificavel("fornecedor")).toBe(false);
    expect(tipoVerificavel("orgao")).toBe(false);
  });
});
