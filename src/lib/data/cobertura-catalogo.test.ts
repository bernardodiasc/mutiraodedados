import { describe, it, expect } from "vitest";
import { CATALOGO_COBERTURA, entradaCatalogoCobertura } from "./cobertura-catalogo";
import { FONTES_COM_HISTORICO, FONTE_LABEL } from "./fonte-rotulos";

/**
 * A lista-espelho que faltava: três fontes gravavam rodada e não apareciam
 * em /cobertura (camara_props, senado_mat, orgaos_siafi) — ninguém cobrava.
 * Mesmo padrão dos guardas de limpeza e sinais.
 */
describe("catálogo de cobertura × fontes com histórico", () => {
  it("toda fonte que grava rodada aparece no catálogo", () => {
    const ids = new Set(CATALOGO_COBERTURA.map((e) => e.id));
    for (const id of FONTES_COM_HISTORICO) {
      expect(ids.has(id), `fonte "${id}" grava rodada mas não está em /cobertura`).toBe(true);
    }
  });

  it("todo id do catálogo tem rótulo de fonte", () => {
    for (const e of CATALOGO_COBERTURA) {
      expect(FONTE_LABEL[e.id], `catálogo tem "${e.id}" sem rótulo`).toBeTruthy();
    }
  });

  it("ids únicos e rota presente", () => {
    const ids = CATALOGO_COBERTURA.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const e of CATALOGO_COBERTURA) {
      if (e.rota !== null) expect(e.rota.startsWith("/"), `rota de ${e.id}`).toBe(true);
    }
  });

  it("cadastros não fingem série temporal", () => {
    for (const id of ["camara_deputados", "senado_senadores", "orgaos_siafi", "ibge"]) {
      expect(entradaCatalogoCobertura(id).granularidade).toBe("cadastro");
    }
  });

  it("id fora do catálogo estoura em vez de renderizar fonte sem nome", () => {
    expect(() => entradaCatalogoCobertura("nao_existe")).toThrow(/fora do catálogo/);
  });
});
