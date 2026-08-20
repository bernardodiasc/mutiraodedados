import { describe, it, expect } from "vitest";
import { ehErroTransitorio, reacaoAoErro, reacaoAoErroDeLista } from "./erro-origem";

describe("erro-origem/classificação", () => {
  it("prefixo TRANSIENT é passageiro", () => {
    expect(ehErroTransitorio(new Error("TRANSIENT: PNCP 503 (indisponível)"))).toBe(true);
  });

  it("timeout e falhas de rede são passageiros mesmo sem prefixo", () => {
    expect(ehErroTransitorio(new Error("timeout após 240s"))).toBe(true);
    expect(ehErroTransitorio(new Error("fetch failed"))).toBe(true);
    expect(ehErroTransitorio(new Error("ECONNRESET"))).toBe(true);
  });

  it("404 é definitivo — insistir não resolve", () => {
    expect(ehErroTransitorio(new Error('Senado API 404: {"detail":"No static resource"}'))).toBe(
      false,
    );
  });

  it("erro de parse e de banco são definitivos", () => {
    expect(ehErroTransitorio(new Error("db: invalid input syntax"))).toBe(false);
    expect(ehErroTransitorio(new Error("JSON inválido"))).toBe(false);
  });

  it("valor não-Error não estoura", () => {
    expect(ehErroTransitorio(null)).toBe(false);
    expect(ehErroTransitorio("qualquer coisa")).toBe(false);
  });
});

describe("erro-origem/reação da varredura", () => {
  it("passageiro interrompe para refazer o item", () => {
    expect(reacaoAoErro(new Error("TRANSIENT: 503")).interromper).toBe(true);
  });

  it("definitivo NÃO interrompe — senão a varredura trava no mesmo item para sempre", () => {
    expect(reacaoAoErro(new Error("Senado API 404")).interromper).toBe(false);
  });
});

describe("erro-origem/erro ao buscar a lista", () => {
  it("passageiro refaz a busca da lista", () => {
    expect(reacaoAoErroDeLista(new Error("TRANSIENT: 503"))).toEqual({
      interromper: true,
      fim: false,
    });
  });

  it("definitivo encerra a rodada em vez de gastar centenas de tentativas", () => {
    expect(reacaoAoErroDeLista(new Error("Câmara API 404"))).toEqual({
      interromper: false,
      fim: true,
    });
  });
});
