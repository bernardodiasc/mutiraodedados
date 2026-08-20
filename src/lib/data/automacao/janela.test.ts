import { describe, it, expect } from "vitest";
import { janelaDoMesCorrente, resumoDoTique } from "./janela";

describe("janela do agendador", () => {
  it("mês corrente em UTC, com último dia certo", () => {
    expect(janelaDoMesCorrente(new Date("2026-02-10T12:00:00Z"))).toEqual({
      ano: 2026,
      mes: 2,
      dataInicial: "2026-02-01",
      dataFinal: "2026-02-28",
    });
    expect(janelaDoMesCorrente(new Date("2024-02-05T00:00:00Z")).dataFinal).toBe("2024-02-29");
  });

  it("virada de mês em UTC decide a janela — não o fuso local", () => {
    // 31/jan 23h UTC ainda é janeiro; 1º/fev 00h já é fevereiro.
    expect(janelaDoMesCorrente(new Date("2026-01-31T23:59:00Z")).mes).toBe(1);
    expect(janelaDoMesCorrente(new Date("2026-02-01T00:01:00Z")).mes).toBe(2);
  });

  it("resumo curto e legível", () => {
    expect(resumoDoTique({ importados: 12 })).toBe("12 importados");
    expect(resumoDoTique({ importados: 0, haMais: true, erros: 2 })).toBe(
      "0 importados · há mais · 2 erro(s)",
    );
  });
});
