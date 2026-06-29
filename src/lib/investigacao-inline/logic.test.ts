import { describe, it, expect } from "vitest";
import { chaveQueryKey, candidatoParaPromocao, passaStatusFilter } from "./logic";

const c = {
  fonte: "portal-cgu",
  entidade_tipo: "contrato",
  entidade_id: "X",
  regra: "r",
  origem: "sinal" as const,
};

describe("chaveQueryKey", () => {
  it("inclui todos componentes na ordem certa", () => {
    expect(chaveQueryKey(c)).toEqual([
      "finding-chave", "portal-cgu", "contrato", "X", "r", "sinal",
    ]);
  });
});

describe("candidatoParaPromocao", () => {
  it("default severidade=aviso, valores=null", () => {
    const p = candidatoParaPromocao(c);
    expect(p.severidade).toBe("aviso");
    expect(p.valor_armazenado).toBeNull();
    expect(p.valor_esperado).toBeNull();
  });
  it("preserva severidade explícita", () => {
    expect(candidatoParaPromocao({ ...c, severidade: "critico" }).severidade).toBe("critico");
  });
});

describe("passaStatusFilter", () => {
  it("sem filtro → true", () => expect(passaStatusFilter(null)).toBe(true));
  it("pré-promoção é aberto", () => expect(passaStatusFilter(null, "aberto")).toBe(true));
  it("status diferente → false", () => expect(passaStatusFilter("confirmado", "aberto")).toBe(false));
  it("status igual → true", () => expect(passaStatusFilter("confirmado", "confirmado")).toBe(true));
});