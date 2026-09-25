import { describe, expect, it } from "vitest";
import { fmtBRL } from "@/lib/fmt";

describe("fmtBRL", () => {
  it("valor ausente é 'Não informado', nunca R$ 0,00", () => {
    expect(fmtBRL(null)).toBe("Não informado");
    expect(fmtBRL(undefined)).toBe("Não informado");
  });

  it("zero informado continua R$ 0,00", () => {
    expect(fmtBRL(0).replace(/\s/g, " ")).toBe("R$ 0,00");
  });
});
