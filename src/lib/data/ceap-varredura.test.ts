import { describe, it, expect } from "vitest";
import { chaveVarreduraCeap, parlamentarNoCursor } from "./ceap-varredura";

describe("ceap-varredura/chave", () => {
  it("separa casa, ano e mês", () => {
    expect(chaveVarreduraCeap("camara_ceap", 2024, 3)).toBe("camara_ceap#2024#03");
    expect(chaveVarreduraCeap("senado_ceaps", 2019, 11)).toBe("senado_ceaps#2019#11");
  });

  it("preenche o mês com zero à esquerda para as chaves ordenarem", () => {
    expect(chaveVarreduraCeap("camara_ceap", 2024, 1)).toBe("camara_ceap#2024#01");
    expect(chaveVarreduraCeap("camara_ceap", 2024, 12)).toBe("camara_ceap#2024#12");
  });

  it("importar um parlamentar é uma varredura à parte", () => {
    expect(chaveVarreduraCeap("camara_ceap", 2024, 3, 204554)).toBe("camara_ceap#2024#03#204554");
    expect(chaveVarreduraCeap("camara_ceap", 2024, 3)).not.toBe(
      chaveVarreduraCeap("camara_ceap", 2024, 3, 204554),
    );
  });
});

describe("ceap-varredura/cursor", () => {
  const ids = [10, 20, 30];

  it("o cursor 1 é o primeiro da lista", () => {
    expect(parlamentarNoCursor(ids, 1)).toEqual({ id: 10, fim: false });
  });

  it("percorre todos sem pular nem repetir", () => {
    const vistos = [1, 2, 3].map((c) => parlamentarNoCursor(ids, c).id);
    expect(vistos).toEqual(ids);
  });

  it("o cursor no último ainda entrega — não encerra cedo", () => {
    expect(parlamentarNoCursor(ids, 3)).toEqual({ id: 30, fim: false });
  });

  it("passar do último encerra a varredura", () => {
    expect(parlamentarNoCursor(ids, 4)).toEqual({ id: null, fim: true });
  });

  it("lista vazia encerra na primeira tentativa", () => {
    expect(parlamentarNoCursor([], 1)).toEqual({ id: null, fim: true });
  });

  it("cursor inválido não estoura", () => {
    expect(parlamentarNoCursor(ids, 0)).toEqual({ id: null, fim: true });
    expect(parlamentarNoCursor(ids, -5)).toEqual({ id: null, fim: true });
  });

  it("retomar do meio continua de onde parou", () => {
    // Rodada anterior parou no cursor 1; esta começa no 2.
    expect(parlamentarNoCursor(ids, 2).id).toBe(20);
  });
});
