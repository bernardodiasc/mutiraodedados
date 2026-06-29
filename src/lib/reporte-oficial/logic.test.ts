import { describe, it, expect } from "vitest";
import { buildIdentificacao, ORIGIN_FALLBACK, safeOrigin } from "./logic";
import type { AnomaliaInput } from "@/lib/anomalia";

const base: AnomaliaInput = {
  id: "A1",
  origem: "qa",
  fonte: "portal-cgu",
  severidade: "aviso",
  status: "aberto",
  regra: "r",
  resumo: "",
  entidade: { tipo: "contrato", id: "X", rotulo: "X" },
  trilha: [],
  detectado_em: "2026-01-01T00:00:00Z",
};

describe("buildIdentificacao", () => {
  it("inclui url_oficial quando presente", () => {
    const out = buildIdentificacao(
      { ...base, entidade: { ...base.entidade, url_oficial: "https://ex/contratos/X" } },
      "https://app",
    );
    expect(out).toContain("URL: https://ex/contratos/X");
    expect(out).toContain("Caso documentado: https://app/qualidade/A1");
  });
  it("omite linha de URL quando ausente", () => {
    const out = buildIdentificacao(base, "https://app");
    expect(out).not.toMatch(/^URL: /m);
  });
});

describe("safeOrigin", () => {
  it("devolve fallback fora do browser", () => {
    expect(safeOrigin()).toBe(ORIGIN_FALLBACK);
  });
});