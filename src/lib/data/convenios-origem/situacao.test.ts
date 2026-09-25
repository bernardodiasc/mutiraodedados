import { describe, expect, it } from "vitest";
import { situacoesDivergem } from "./situacao";

describe("situacoesDivergem — aviso de situação na ficha do convênio", () => {
  it("origem diferente do espelho → exibe o aviso com as duas situações", () => {
    expect(situacoesDivergem("Rescindido", "Em execução")).toBe(true);
  });

  it("mesma situação em caixa diferente não é divergência", () => {
    expect(situacoesDivergem("EM EXECUÇÃO", "Em execução")).toBe(false);
  });

  it("sem um dos lados não há o que comparar", () => {
    expect(situacoesDivergem(null, "Em execução")).toBe(false);
    expect(situacoesDivergem("Rescindido", null)).toBe(false);
    expect(situacoesDivergem("", "Em execução")).toBe(false);
  });
});
