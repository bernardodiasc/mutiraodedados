import { describe, it, expect } from "vitest";
import {
  anoDeEvidencia,
  buildCurlsSinal,
  ordenarPorSeveridade,
  filtrarSinais,
  hrefSinal,
  regrasUnicas,
  contarPorSeveridade,
} from "./logic";
import type { Anomalia } from "@/lib/data/types";

const base = (over: Partial<Anomalia>): Anomalia => ({
  id: "x",
  entidadeTipo: "contrato",
  entidadeId: "1",
  entidadeNome: "n",
  regra: "fracionamento",
  severidade: "media",
  titulo: "t",
  explicacao: "e",
  evidencia: {},
  ...over,
});

describe("admin-sinais/logic", () => {
  it("ano fallback usa now quando ausente", () => {
    expect(anoDeEvidencia({}, new Date("2030-06-01"))).toBe(2030);
    expect(anoDeEvidencia({ ano: 2021 })).toBe(2021);
    expect(anoDeEvidencia({ ano_anterior: 2019 })).toBe(2019);
  });

  it("buildCurlsSinal cobre contrato/orgao/contrato_alto/undefined", () => {
    expect(buildCurlsSinal(base({ entidadeTipo: "contrato", entidadeId: "abc" }))![0].nota).toContain("id=abc");
    const o = buildCurlsSinal(
      base({ entidadeTipo: "orgao", entidadeId: "26000", evidencia: { ano: 2022 } }),
    )!;
    expect(o[0].nota).toContain("codigoOrgao=26000");
    expect(o[0].nota).toContain("31/12/2022");
    const f = buildCurlsSinal(
      base({ entidadeTipo: "fornecedor", evidencia: { contrato_alto: "9" } }),
    )!;
    expect(f[0].nota).toContain("id=9");
    expect(buildCurlsSinal(base({ entidadeTipo: "fornecedor", evidencia: {} }))).toBeUndefined();
  });

  it("ordena por severidade e filtra", () => {
    const list = [
      base({ id: "1", severidade: "baixa" }),
      base({ id: "2", severidade: "alta" }),
      base({ id: "3", severidade: "media", regra: "concentracao" }),
    ];
    expect(ordenarPorSeveridade(list).map((x) => x.id)).toEqual(["2", "3", "1"]);
    expect(filtrarSinais(list, "concentracao", null).map((x) => x.id)).toEqual(["3"]);
    expect(filtrarSinais(list, null, "alta").map((x) => x.id)).toEqual(["2"]);
    expect(filtrarSinais(list, null, null).length).toBe(3);
  });

  it("href, regras únicas e contadores", () => {
    expect(hrefSinal(base({ entidadeTipo: "orgao", entidadeId: "1" }))).toBe("/orgaos/1");
    expect(hrefSinal(base({ entidadeTipo: "fornecedor", entidadeId: "2" }))).toBe("/fornecedores/2");
    expect(hrefSinal(base({ entidadeTipo: "contrato", entidadeId: "3" }))).toBe("/contratos/3");
    const list = [base({ regra: "a", severidade: "alta" }), base({ regra: "a", severidade: "alta" }), base({ regra: "b", severidade: "baixa" })];
    expect(regrasUnicas(list)).toEqual(["a", "b"]);
    expect(contarPorSeveridade(list, "alta")).toBe(2);
  });
});