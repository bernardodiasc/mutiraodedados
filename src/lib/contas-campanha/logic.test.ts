import { describe, expect, it } from "vitest";
import { deriveEstado } from "./logic";

describe("deriveEstado (contas de campanha)", () => {
  it("prioriza carregando e erro", () => {
    expect(deriveEstado({ carregando: true, temErro: false, temDados: false })).toBe("carregando");
    expect(deriveEstado({ carregando: false, temErro: true, temDados: true })).toBe("erro");
  });
  it("distingue pronto de vazio", () => {
    expect(deriveEstado({ carregando: false, temErro: false, temDados: true })).toBe("pronto");
    expect(deriveEstado({ carregando: false, temErro: false, temDados: false })).toBe("vazio");
  });
});
