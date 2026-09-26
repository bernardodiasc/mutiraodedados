import { describe, expect, it } from "vitest";
import type { ConferenciaGravada } from "@/lib/data/automacao/conferencia";
import {
  arquivoDoEscopo,
  arquivosDaEleicao,
  arquivosPendentes,
  eleicoesNaJanela,
} from "@/lib/data/tse/matriz";

// ---------------------------------------------------------------------------
// A matriz tipo × ano × UF do TSE: o que existe em cada eleição, na ordem de
// importação (candidatos primeiro), e quais arquivos ainda estão pendentes.
// ---------------------------------------------------------------------------

const HOJE = new Date(2026, 8, 26);

const conferencia = (
  escopo: string,
  estado: ConferenciaGravada["estado"],
  consultado_em = "2026-09-01T00:00:00Z",
): ConferenciaGravada => ({
  ano: Number(escopo.slice(0, 4)),
  mes: 1,
  escopo,
  estado,
  motivo: estado,
  execucao_id: "e",
  consultado_em,
});

describe("matriz do TSE", () => {
  it("numa eleição geral: candidatos antes dos demais tipos, 28 UFs com BR", () => {
    const arquivos = arquivosDaEleicao(2022);
    expect(arquivos).toHaveLength(5 * 28);
    expect(arquivos[0]).toEqual({ tipo: "candidatos", uf: "AC" });
    expect(arquivos[27]).toEqual({ tipo: "candidatos", uf: "BR" });
    expect(arquivos[28]).toEqual({ tipo: "bens", uf: "AC" });
    expect(arquivos.at(-1)).toEqual({ tipo: "resultados", uf: "BR" });
  });

  it("numa eleição municipal não há BR; antes de 2006 não há bens nem contas", () => {
    expect(arquivosDaEleicao(2024).some((a) => a.uf === "BR")).toBe(false);
    expect(new Set(arquivosDaEleicao(2004).map((a) => a.tipo))).toEqual(
      new Set(["candidatos", "resultados"]),
    );
  });

  it("na eleição em curso só o que o TSE já publicou", () => {
    expect(new Set(arquivosDaEleicao(2026).map((a) => a.tipo))).toEqual(
      new Set(["candidatos", "bens"]),
    );
  });

  it("ano sem eleição não tem arquivo", () => {
    expect(arquivosDaEleicao(2023)).toEqual([]);
  });

  it("filtra por tipo e por UF", () => {
    expect(arquivosDaEleicao(2022, { tipo: "bens", uf: "SP" })).toEqual([
      { tipo: "bens", uf: "SP" },
    ]);
  });

  it("as eleições da janela, da mais recente à mais antiga", () => {
    const anos = eleicoesNaJanela(HOJE);
    expect(anos[0]).toBe(2026);
    expect(anos.at(-1)).toBe(1998);
    expect(anos).toHaveLength(15);
  });

  it("o escopo da janela volta a ser o arquivo", () => {
    expect(arquivoDoEscopo("bens/AC")).toEqual({ tipo: "bens", uf: "AC" });
    expect(arquivoDoEscopo("PL")).toBeNull();
    expect(arquivoDoEscopo(undefined)).toBeNull();
  });
});

describe("arquivos pendentes", () => {
  it("tira os aprovados, mantém reprovados e inconclusivos com a última conferência", () => {
    const pendentes = arquivosPendentes(
      {
        candidatos: [
          conferencia("2026-AC", "reprovada", "2026-09-01T00:00:00Z"),
          conferencia("2026-AC", "aprovada", "2026-09-02T00:00:00Z"),
          conferencia("2026-AL", "inconclusiva"),
        ],
      },
      { tipo: "candidatos" },
      HOJE,
    );
    expect(pendentes[0]).toMatchObject({
      ano: 2026,
      mes: 1,
      dataInicio: "2026-01-01",
      dataFim: "2026-12-31",
      escopo: "candidatos/AL",
      ultima: { estado: "inconclusiva" },
    });
    expect(pendentes.some((p) => p.ano === 2026 && p.escopo === "candidatos/AC")).toBe(false);
    expect(pendentes.find((p) => p.escopo === "candidatos/AM")?.ultima).toBeNull();
  });

  it("a matriz inteira, nunca conferida, na ordem de importação", () => {
    const pendentes = arquivosPendentes({}, {}, HOJE);
    expect(pendentes.slice(0, 2).map((p) => `${p.ano} ${p.escopo}`)).toEqual([
      "2026 candidatos/AC",
      "2026 candidatos/AL",
    ]);
    const de2022 = pendentes.filter((p) => p.ano === 2022);
    expect(de2022[0].escopo).toBe("candidatos/AC");
    expect(de2022).toHaveLength(140);
  });
});
