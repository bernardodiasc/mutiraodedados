import { describe, it, expect } from "vitest";
import { deriveItemEstado } from "./logic";

const base = {
  hasUser: true,
  authLoading: false,
  verificacaoLoading: false,
  jaSalvo: false,
  isPending: false,
};

describe("deriveItemEstado", () => {
  it("verificando quando auth carrega", () => {
    expect(deriveItemEstado({ ...base, authLoading: true })).toBe("verificando");
  });
  it("deslogado quando sem user", () => {
    expect(deriveItemEstado({ ...base, hasUser: false })).toBe("deslogado");
  });
  it("salvo tem prioridade sobre salvando", () => {
    expect(deriveItemEstado({ ...base, jaSalvo: true, isPending: true })).toBe("salvo");
  });
  it("salvando enquanto mutação roda", () => {
    expect(deriveItemEstado({ ...base, isPending: true })).toBe("salvando");
  });
  it("default: salvar", () => {
    expect(deriveItemEstado(base)).toBe("salvar");
  });
  it("verificando enquanto query de status carrega", () => {
    expect(deriveItemEstado({ ...base, jaSalvo: undefined, verificacaoLoading: true })).toBe(
      "verificando",
    );
  });
});
