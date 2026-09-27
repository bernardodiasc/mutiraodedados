import { describe, it, expect } from "vitest";
import {
  CATALOGO_COBERTURA,
  entradaCatalogoCobertura,
  limiarDefasagemDias,
} from "./cobertura-catalogo";
import { ORDEM } from "./automacao/dependencias";
import { ANO_INICIO_POR_FONTE } from "./janelas";
import { colecoesComGatilho } from "@/lib/busca/migracoes-indice.test-util";
import { COLECOES_EDITORIAIS } from "@/lib/busca/desatualizadas";
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

// O catálogo é a linha do modelo de cobertura estruturada: as tarefas da
// ferramenta, as coleções do índice e a janela têm que casar com as tabelas
// que as definem, senão a cobertura e a marca de coleção desatualizada leem
// a coisa errada em silêncio.
describe("catálogo de cobertura × ferramenta, índice e janelas", () => {
  it("toda tarefa da tabela de dependências está em exatamente uma entrada", () => {
    const donos = new Map<string, string[]>();
    for (const e of CATALOGO_COBERTURA)
      for (const t of e.tarefas) donos.set(t, [...(donos.get(t) ?? []), e.id]);
    for (const t of ORDEM) {
      expect(donos.get(t), `tarefa "${t}" fora do catálogo ou repetida`).toHaveLength(1);
    }
    for (const t of donos.keys()) expect(ORDEM, `tarefa "${t}" não existe`).toContain(t);
  });

  it("toda coleção do índice de busca de uma fonte existe no índice, e toda do índice tem fonte", () => {
    const doIndice = colecoesComGatilho();
    expect(doIndice.size).toBeGreaterThan(5);
    const declaradas = new Set(CATALOGO_COBERTURA.flatMap((e) => e.indice));
    for (const c of declaradas) expect(doIndice, `coleção "${c}"`).toContain(c);
    // Conteúdo editorial (artigos, perguntas, roadmap, lacunas) não é fonte importada.
    for (const c of doIndice) {
      if (!(c in COLECOES_EDITORIAIS)) {
        expect(declaradas, `coleção "${c}" sem fonte no catálogo`).toContain(c);
      }
    }
  });

  it("a janela de disponibilidade existe para toda série e falta só nos cadastros", () => {
    for (const e of CATALOGO_COBERTURA) {
      if (e.granularidade === "cadastro") expect(e.janela, e.id).toBeNull();
      else expect(ANO_INICIO_POR_FONTE[e.janela!], e.id).toBeGreaterThan(1980);
    }
  });

  it("limiar de defasagem: padrão por granularidade", () => {
    expect(limiarDefasagemDias(entradaCatalogoCobertura("pncp"))).toBe(45);
    expect(limiarDefasagemDias(entradaCatalogoCobertura("cgu_emendas"))).toBe(400);
    expect(limiarDefasagemDias(entradaCatalogoCobertura("ibge"))).toBe(30);
  });
});
