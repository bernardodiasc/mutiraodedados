import { describe, it, expect } from "vitest";
import { formatarDataPt } from "./logic";

describe("formatarDataPt", () => {
  it("formata ISO em pt-BR", () => {
    expect(formatarDataPt("2026-03-15T12:00:00Z")).toMatch(/2026/);
  });
  it("devolve original quando inválida", () => {
    expect(formatarDataPt("xx")).toBe("xx");
  });
});
