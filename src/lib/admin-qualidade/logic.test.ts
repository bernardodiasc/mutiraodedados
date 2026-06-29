import { describe, expect, it } from "vitest";
import { buildCurlsQualidade, isoToBR, FONTES_QA, type FindingAdmin } from "./logic";

describe("admin-qualidade logic", () => {
  it("isoToBR converte data ISO em BR", () => {
    expect(isoToBR("2024-05-09")).toBe("09/05/2024");
  });

  it("FONTES_QA contém as 6 fontes esperadas", () => {
    expect(FONTES_QA).toContain("cgu");
    expect(FONTES_QA).toHaveLength(6);
  });

  it("buildCurlsQualidade retorna curls para CGU/contrato com contexto", () => {
    const f = {
      id: "f1",
      fonte: "cgu",
      entidade: { tipo: "contrato", id: "12345" },
      contexto_origem: { orgao_cod: "26000", data_assinatura: "2024-05-09" },
    } as unknown as FindingAdmin;
    const r = buildCurlsQualidade(f);
    expect(r).toBeDefined();
    expect(r!.length).toBe(2);
    expect(r![0].url).toContain("swagger-ui");
    expect(r![0].nota).toContain("09/05/2024");
  });

  it("buildCurlsQualidade retorna undefined para fonte/tipo não suportado", () => {
    const f = {
      id: "x",
      fonte: "siconfi",
      entidade: { tipo: "outro", id: "1" },
    } as unknown as FindingAdmin;
    expect(buildCurlsQualidade(f)).toBeUndefined();
  });
});