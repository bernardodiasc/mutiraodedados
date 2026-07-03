import { describe, expect, it } from "vitest";
import { regrasCguLicitacoes } from "@/lib/data/qa";

const base = {
  id: "lic-1",
  valor: 100000,
  situacao: "Publicado",
  data_abertura: "2024-01-30",
  ano: 2024,
  orgao_cod: "26000",
};

describe("regrasCguLicitacoes", () => {
  it("não gera findings para licitação publicada e bem-formada", () => {
    expect(regrasCguLicitacoes([base])).toEqual([]);
  });

  it("sinaliza certame abandonado (revogada/anulada/fracassada/deserta)", () => {
    const findings = regrasCguLicitacoes([
      { ...base, situacao: "Evento de Revogação Publicado" },
    ]);
    expect(findings.some((f) => f.regra === "licitacao_sem_desfecho")).toBe(true);
  });

  it("sinaliza data de abertura ausente", () => {
    const findings = regrasCguLicitacoes([{ ...base, data_abertura: null }]);
    expect(findings).toMatchObject([{ regra: "data_abertura_ausente", severidade: "aviso" }]);
  });

  it("sinaliza ano implausível (anterior a 1988)", () => {
    const findings = regrasCguLicitacoes([
      { ...base, data_abertura: "1900-01-01", ano: 1900 },
    ]);
    expect(findings.some((f) => f.regra === "ano_invalido")).toBe(true);
  });

  it("sinaliza valor negativo como crítico", () => {
    const findings = regrasCguLicitacoes([{ ...base, valor: -1 }]);
    expect(findings).toMatchObject([{ regra: "valor_negativo", severidade: "critico" }]);
  });
});
