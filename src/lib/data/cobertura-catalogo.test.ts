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
      // O TSE grava uma rodada por tipo de arquivo (`tse_candidatos`,
      // `tse_bens`…), mas /cobertura mostra a fonte inteira numa entrada `tse`.
      const entrada = id.startsWith("tse_") ? "tse" : id;
      expect(ids.has(entrada), `fonte "${id}" grava rodada mas não está em /cobertura`).toBe(true);
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

  it("proposições e matérias são séries anuais, não mensais", () => {
    for (const id of ["camara_props", "senado_mat"]) {
      expect(entradaCatalogoCobertura(id).granularidade, id).toBe("ano");
    }
  });

  it("id fora do catálogo estoura em vez de renderizar fonte sem nome", () => {
    expect(() => entradaCatalogoCobertura("nao_existe")).toThrow(/fora do catálogo/);
  });
});
