import { describe, expect, it } from "vitest";
import { COLECOES_DO_INDICE, linhaDiagnostico, lerIds } from "./logic";

// ---------------------------------------------------------------------------
// Diagnóstico de busca por coleção: cache × publicáveis × índice, a
// defasagem da importação e a leitura dos ids do "reindexar recorte".
// ---------------------------------------------------------------------------

const AGORA = new Date("2026-09-26T12:00:00Z");
const dias = (n: number) => new Date(AGORA.getTime() - n * 86_400_000).toISOString();

const linha = (medidas: {
  cache: number | null;
  publicaveis: number | null;
  indice: number | null;
}) => linhaDiagnostico({ colecao: "cgu_licitacoes_cache", medidas, fontes: [] }, AGORA);

describe("linhaDiagnostico", () => {
  it("índice igual aos publicáveis: conciliada", () => {
    expect(linha({ cache: 120, publicaveis: 100, indice: 100 })).toMatchObject({
      situacao: "conciliada",
      diferenca: 0,
      foraDaBusca: 20,
    });
  });

  it("faltam linhas no índice", () => {
    expect(linha({ cache: 100, publicaveis: 100, indice: 97 })).toMatchObject({
      situacao: "faltam",
      diferenca: -3,
    });
  });

  it("sobram linhas no índice (registro removido ou despublicado)", () => {
    expect(linha({ cache: 100, publicaveis: 100, indice: 101 })).toMatchObject({
      situacao: "sobram",
      diferenca: 1,
    });
  });

  it("medida que estourou o tempo: indisponível, sem inventar diferença", () => {
    expect(linha({ cache: 100, publicaveis: null, indice: 100 })).toMatchObject({
      situacao: "indisponivel",
      diferenca: null,
      foraDaBusca: null,
    });
  });

  it("defasagem pela fonte mais atrasada; fonte nunca conferida conta como desatualizada", () => {
    const l = linhaDiagnostico(
      {
        colecao: "contratos_cache",
        medidas: { cache: 1, publicaveis: 1, indice: 1 },
        fontes: [
          { titulo: "CGU", ultima: dias(3), limiarDias: 45 },
          { titulo: "PNCP", ultima: dias(60), limiarDias: 45 },
        ],
      },
      AGORA,
    );
    expect(l.fontes).toEqual([
      { titulo: "CGU", ultima: dias(3), defasagemDias: 3, desatualizada: false },
      { titulo: "PNCP", ultima: dias(60), defasagemDias: 60, desatualizada: true },
    ]);
    expect(l.desatualizada).toBe(true);
    expect(
      linhaDiagnostico(
        {
          colecao: "x",
          medidas: { cache: 0, publicaveis: 0, indice: 0 },
          fontes: [{ titulo: "TSE", ultima: null, limiarDias: 400 }],
        },
        AGORA,
      ).fontes[0],
    ).toEqual({ titulo: "TSE", ultima: null, defasagemDias: null, desatualizada: true });
  });
});

describe("lerIds", () => {
  it("aceita ids separados por vírgula, espaço ou linha, sem repetir", () => {
    expect(lerIds(" 123, 456\n789 123 ")).toEqual(["123", "456", "789"]);
    expect(lerIds("  ")).toEqual([]);
  });
});

describe("coleções do índice", () => {
  it("inclui os artigos e as coleções das fontes", () => {
    expect(COLECOES_DO_INDICE).toContain("artigos");
    expect(COLECOES_DO_INDICE).toContain("pncp_contratos_cache");
    expect(new Set(COLECOES_DO_INDICE).size).toBe(COLECOES_DO_INDICE.length);
  });
});
