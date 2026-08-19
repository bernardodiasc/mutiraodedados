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

  it("sinaliza certame abandonado como sinal INVESTIGATIVO nascendo aviso", () => {
    const findings = regrasCguLicitacoes([
      { ...base, situacao: "Evento de Revogação Publicado" },
    ]);
    const f = findings.find((x) => x.regra === "licitacao_sem_desfecho");
    expect(f).toBeDefined();
    expect(f?.tipo).toBe("investigativo");
    expect(f?.severidade).toBe("aviso");
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

  it("sinaliza valor ínfimo (>0 e <R$100) como suspeita de truncamento por escala", () => {
    const findings = regrasCguLicitacoes([{ ...base, valor: 57.6 }]);
    expect(findings).toMatchObject([
      { regra: "valor_truncado_suspeito", tipo: "qualidade", severidade: "aviso", valor_armazenado: 57.6 },
    ]);
    // Limite exato e zero não disparam.
    expect(regrasCguLicitacoes([{ ...base, valor: 100 }])).toEqual([]);
    expect(regrasCguLicitacoes([{ ...base, valor: 0 }])).toEqual([]);
  });
});
