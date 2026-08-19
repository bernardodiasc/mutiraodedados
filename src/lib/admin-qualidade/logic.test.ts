import { describe, expect, it } from "vitest";
import { buildCurlsQualidade, isoToBR, FONTES_QA, type FindingAdmin } from "./logic";

describe("admin-qualidade logic", () => {
  it("isoToBR converte data ISO em BR", () => {
    expect(isoToBR("2024-05-09")).toBe("09/05/2024");
  });

  it("FONTES_QA (derivada do catálogo) contém todas as fontes com regras persistidas", () => {
    for (const f of [
      "cgu",
      "cgu_licitacoes",
      "cgu_emendas",
      "cgu_convenios",
      "pncp",
      "camara_ceap",
      "senado_ceaps",
      "transferegov",
      "siconfi",
      "tse",
      "tse-cruzamento",
    ]) {
      expect(FONTES_QA).toContain(f);
    }
  });

  it("buildCurlsQualidade retorna curls para CGU/contrato com contexto", () => {
    const f = {
      id: "f1",
      fonte: "cgu",
      entidade: { tipo: "contrato", id: "12345" },
      // A CGU filtra /contratos por vigência, não por assinatura — a nota usa o
      // codigoOrgao da varredura (sem dataInicial/dataFinal), não a data.
      contexto_origem: { orgao_cod: "26000" },
    } as unknown as FindingAdmin;
    const r = buildCurlsQualidade(f);
    expect(r).toBeDefined();
    expect(r!.length).toBe(2);
    expect(r![0].url).toContain("swagger-ui");
    expect(r![0].nota).toContain("codigoOrgao=26000");
    expect(r![0].nota).toContain("sem dataInicial/dataFinal");
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
