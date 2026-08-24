import { describe, expect, it } from "vitest";
import type { FichaFornecedor } from "@/lib/data/fornecedores.functions";
import { calcularRadar, derivarEstadoFicha, montarNosGrafo, serieAnualDe } from "./logic";

const contrato = (over: Partial<FichaFornecedor["contratos"][number]> = {}) => ({
  id: "c1",
  orgao_cod: "26000",
  orgao_sigla: "MS",
  orgao_nome: "Ministério da Saúde",
  numero: "1",
  objeto: "Compra",
  modalidade: "pregao",
  valor: 100_000,
  ano: 2024,
  data_assinatura: "2024-05-01",
  ...over,
});

const fichaVazia: FichaFornecedor = {
  cadastro: null,
  contratos: [],
  totalContratos: 0,
  pncp: { total: 0 },
  ceapCamara: { total: 0 },
  ceapSenado: { total: 0 },
  doacoes: { total: 0 },
};

describe("derivarEstadoFicha", () => {
  it("é completo com contratos CGU", () => {
    expect(derivarEstadoFicha({ ...fichaVazia, contratos: [contrato()] })).toBe("completo");
  });
  it("degrada quando só há presença em outra fonte (doador de campanha)", () => {
    expect(derivarEstadoFicha({ ...fichaVazia, doacoes: { total: 3 } })).toBe("degradado");
    expect(derivarEstadoFicha({ ...fichaVazia, ceapCamara: { total: 5 } })).toBe("degradado");
  });
  it("é inexistente quando nenhuma fonte conhece o CNPJ", () => {
    expect(derivarEstadoFicha(fichaVazia)).toBe("inexistente");
  });
});

describe("agregações puras", () => {
  it("monta série anual e grafo por órgão", () => {
    const contratos = [
      contrato(),
      contrato({ id: "c2", ano: 2023, valor: 50_000 }),
      contrato({ id: "c3", orgao_cod: "20000", orgao_sigla: "PR", valor: 10_000 }),
    ];
    expect(serieAnualDe(contratos)).toEqual([
      { ano: 2023, valor: 50_000 },
      { ano: 2024, valor: 110_000 },
    ]);
    expect(montarNosGrafo(contratos)).toHaveLength(2);
  });

  it("radar tem 4 eixos com valores em 0..1", () => {
    const eixos = calcularRadar([contrato({ modalidade: "dispensa", valor: 60_000 })], String);
    expect(eixos).toHaveLength(4);
    for (const e of eixos) {
      expect(e.valor).toBeGreaterThanOrEqual(0);
      expect(e.valor).toBeLessThanOrEqual(1);
    }
  });
});
