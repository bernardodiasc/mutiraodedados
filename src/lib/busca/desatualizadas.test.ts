import { describe, expect, it } from "vitest";
import { CATALOGO_COBERTURA, entradaCatalogoCobertura } from "@/lib/data/cobertura-catalogo";
import { CATEGORIA_DA_COLECAO, categoriasDesatualizadas } from "./desatualizadas";
import { categoriaDasProjecoes } from "./migracoes-indice.test-util";

// ---------------------------------------------------------------------------
// "Coleção desatualizada" na /buscar: a categoria fica marcada quando uma
// fonte que alimenta alguma coleção dela está sem conferência aprovada há mais
// que o limiar do catálogo.
// ---------------------------------------------------------------------------

const AGORA = new Date("2026-09-26T12:00:00Z");
const dias = (n: number) => new Date(AGORA.getTime() - n * 86_400_000).toISOString();
const fonte = (id: string, ultima: string | null) => ({
  entrada: entradaCatalogoCobertura(id),
  ultima,
});

describe("categoriasDesatualizadas", () => {
  it("fonte mensal dentro do limiar de 45 dias não marca nada", () => {
    expect(categoriasDesatualizadas([fonte("pncp", dias(10))], AGORA)).toEqual({});
  });

  it("fonte além do limiar marca a categoria da coleção, com a data", () => {
    expect(categoriasDesatualizadas([fonte("pncp", dias(60))], AGORA)).toEqual({
      contratos: {
        fontes: [{ titulo: entradaCatalogoCobertura("pncp").titulo, ultima: dias(60) }],
      },
    });
  });

  it("fonte nunca conferida está desatualizada, sem data", () => {
    const r = categoriasDesatualizadas([fonte("cgu_licitacoes", null)], AGORA);
    expect(r.licitacoes).toEqual({
      fontes: [{ titulo: entradaCatalogoCobertura("cgu_licitacoes").titulo, ultima: null }],
    });
  });

  it("categoria alimentada por duas fontes: basta uma atrasada, e só ela aparece", () => {
    const r = categoriasDesatualizadas([fonte("pncp", dias(5)), fonte("cgu", dias(90))], AGORA);
    const cgu = { titulo: entradaCatalogoCobertura("cgu").titulo, ultima: dias(90) };
    expect(r.contratos?.fontes).toEqual([cgu]);
    // Os contratos da CGU também alimentam os fornecedores.
    expect(r.organizacoes?.fontes).toEqual([cgu]);
  });

  it("fonte anual usa o limiar de 400 dias", () => {
    expect(categoriasDesatualizadas([fonte("cgu_emendas", dias(300))], AGORA)).toEqual({});
  });
});

describe("coleções do índice × categorias", () => {
  it("toda coleção de uma fonte do catálogo tem categoria", () => {
    for (const c of CATALOGO_COBERTURA.flatMap((e) => e.indice)) {
      expect(CATEGORIA_DA_COLECAO[c], c).toBeTruthy();
    }
  });

  it("a categoria de cada coleção é a que a projeção SQL grava", () => {
    const gravadas = categoriaDasProjecoes();
    for (const [colecao, categoria] of Object.entries(CATEGORIA_DA_COLECAO)) {
      expect(gravadas.get(colecao), colecao).toBe(categoria);
    }
  });
});
