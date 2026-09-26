import { describe, expect, it } from "vitest";
import { janelasPendentes, type ConferenciaGravada } from "./conferencia";

// Pendentes de fonte anual (emendas da CGU): uma janela por ano, ancorada no
// mês 1 como a célula anual da cobertura.

const HOJE = new Date(2026, 8, 26);

const conferida = (ano: number, estado: ConferenciaGravada["estado"]): ConferenciaGravada => ({
  ano,
  mes: 1,
  estado,
  motivo: estado,
  execucao_id: null,
  consultado_em: `${ano}-06-01T00:00:00Z`,
});

describe("janelasPendentes — granularidade anual", () => {
  it("do ano corrente ao início da fonte, pulando os anos aprovados", () => {
    const pendentes = janelasPendentes(
      "cgu_emendas",
      [conferida(2025, "aprovada"), conferida(2024, "reprovada")],
      HOJE,
      "ano",
    );
    expect(pendentes.map((j) => j.ano)).toEqual([
      2026, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015, 2014,
    ]);
    expect(pendentes[0]).toEqual({
      ano: 2026,
      mes: 1,
      dataInicio: "2026-01-01",
      dataFim: "2026-12-31",
      ultima: null,
    });
    expect(pendentes[1].ultima).toMatchObject({ estado: "reprovada" });
  });

  it("o ano corrente entra mesmo antes de dezembro", () => {
    expect(janelasPendentes("cgu_emendas", [], new Date(2026, 0, 5), "ano")[0].ano).toBe(2026);
  });
});
