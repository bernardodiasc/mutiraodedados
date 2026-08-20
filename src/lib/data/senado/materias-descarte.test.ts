import { describe, it, expect } from "vitest";
import { alertaDeDescarte, parseIdentificacao } from "./materias.functions";

/**
 * O caso real: a API passou a devolver campos planos, `numero` saiu 0 e as
 * 902 matérias do ano foram descartadas em silêncio. O Histórico registrou
 * "consultado, sem dados" — indistinguível de um ano legitimamente vazio.
 */
describe("alertaDeDescarte", () => {
  it("sem descarte, não inventa aviso", () => {
    expect(alertaDeDescarte(10, { semCodigo: 0, semNumero: 0 })).toBeNull();
  });

  it("tudo descartado vira ERRO, não info — é falha nossa de leitura", () => {
    const m = alertaDeDescarte(0, { semCodigo: 0, semNumero: 902 });
    expect(m).not.toMatch(/^info:/);
    expect(m).toContain("902");
    expect(m).toContain("formato");
  });

  it("descarte parcial é só informativo", () => {
    const m = alertaDeDescarte(880, { semCodigo: 1, semNumero: 1 });
    expect(m).toMatch(/^info:/);
    expect(m).toContain("2 matérias descartadas");
  });

  it("o detalhe diz qual guarda barrou", () => {
    expect(alertaDeDescarte(0, { semCodigo: 3, semNumero: 0 })).toContain("3 sem código");
    expect(alertaDeDescarte(0, { semCodigo: 0, semNumero: 4 })).toContain("4 sem número");
  });
});

describe("parseIdentificacao (/processo)", () => {
  it("lê a identificação padrão", () => {
    expect(parseIdentificacao("PL 8/2025")).toEqual({ sigla: "PL", numero: 8, ano: 2025 });
    expect(parseIdentificacao("PEC 45/2019")).toEqual({ sigla: "PEC", numero: 45, ano: 2019 });
  });

  it("recusa formatos que não sabe ler — o descarte precisa ser contado", () => {
    expect(parseIdentificacao("")).toBeNull();
    expect(parseIdentificacao(null)).toBeNull();
    expect(parseIdentificacao("PL 0/2025")).toBeNull();
    expect(parseIdentificacao("PL 8")).toBeNull();
  });
});
