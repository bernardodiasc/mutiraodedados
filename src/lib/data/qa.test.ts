import { describe, expect, it } from "vitest";
import { regrasCgu } from "@/lib/data/qa";

describe("regrasCgu", () => {
  it("não cria valor_muito_baixo para contrato com valor alto", () => {
    const findings = regrasCgu([
      { id: "contrato-600k", valor: 600000, valor_inicial: 600000, orgao_cod: "26000" },
    ]);

    expect(findings.some((f) => f.regra === "valor_muito_baixo")).toBe(false);
  });

  it("cria valor_muito_baixo quando o valor final realmente está abaixo de R$ 100", () => {
    const findings = regrasCgu([
      { id: "contrato-80", valor: 80, valor_inicial: 80, orgao_cod: "26000" },
    ]);

    expect(findings).toMatchObject([
      { regra: "valor_muito_baixo", valor_armazenado: 80 },
    ]);
  });
});