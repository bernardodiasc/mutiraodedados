import { describe, expect, it } from "vitest";
import { destinoSeguro } from "./destino-seguro";

describe("destinoSeguro", () => {
  it("aceita caminho interno com busca e âncora", () => {
    expect(destinoSeguro("/admin/dados?aba=tse#topo")).toBe("/admin/dados?aba=tse#topo");
  });

  it("usa /minhas-marcacoes quando não há destino", () => {
    expect(destinoSeguro(undefined)).toBe("/minhas-marcacoes");
    expect(destinoSeguro("")).toBe("/minhas-marcacoes");
  });

  it("aceita só rotas internas", () => {
    for (const valor of [
      "https://exemplo.com/",
      "//exemplo.com",
      "/\\exemplo.com",
      "\\\\exemplo.com",
      "javascript:alert(1)",
      "admin",
    ]) {
      expect(destinoSeguro(valor)).toBe("/minhas-marcacoes");
    }
  });
});
