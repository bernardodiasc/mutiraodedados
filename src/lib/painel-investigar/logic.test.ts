import { describe, expect, it } from "vitest";
import { passosParaAnomalia } from "./logic";

describe("passosParaAnomalia", () => {
  it("inclui o link de consulta do CNPJ quando a entidade é fornecedor", () => {
    const passos = passosParaAnomalia({
      entidadeTipo: "fornecedor",
      entidadeId: "00.000.000/0001-91",
    });
    const passoCnpj = passos.find((p) => p.linkLabel === "Abrir CNPJ.biz");
    expect(passoCnpj?.link).toBe("https://cnpj.biz/00000000000191");
  });

  it("omite o link de CNPJ para outras entidades, mantendo os 5 passos", () => {
    const passos = passosParaAnomalia({ entidadeTipo: "contrato", entidadeId: "123" });
    expect(passos).toHaveLength(5);
    expect(passos.find((p) => p.linkLabel === "Abrir CNPJ.biz")?.link).toBeNull();
  });
});
