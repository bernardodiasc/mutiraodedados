import { describe, expect, it } from "vitest";
import type { ItemBusca, ResumoBusca } from "@/lib/busca/consulta";
import {
  CHAVES_ESPECIFICAS,
  PARAMETROS_RESERVADOS,
  alternarValor,
  aplicarFiltros,
  atualizarResultados,
  chipsDaSearch,
  deriveEstado,
  filtrosDaSearch,
  formatarData,
  gruposAbertosIniciais,
  gruposDoResumo,
  incompativeis,
  intervaloDaPagina,
  irParaCategoria,
  paramDaFaceta,
  searchDaPagina,
  validarBuscarSearch,
} from "./logic";

describe("validarBuscarSearch", () => {
  it("mantém só o contrato e descarta categoria inativa, ordem e itens inválidos", () => {
    expect(
      validarBuscarSearch({
        q: "  merenda ",
        tipo: "normas",
        tipo_emenda: "Individual",
        ordem: "valor",
        itens: 30,
        pagina: "3",
        fonte: "PNCP|CGU",
        modalidade: "Pregão",
        inventado: "x",
        ate: "2026-09-26T19:00:00.000Z",
      }),
    ).toEqual({
      q: "merenda",
      pagina: 3,
      fonte: "PNCP|CGU",
      modalidade: "Pregão",
      tipo_emenda: "Individual",
      ate: "2026-09-26T19:00:00.000Z",
    });
  });

  it("aceita categoria ativa e ano numérico", () => {
    expect(validarBuscarSearch({ tipo: "contratos", ano: 2024, itens: 50 })).toEqual({
      tipo: "contratos",
      ano: "2024",
      itens: 50,
    });
  });
});

describe("parâmetros de faceta", () => {
  it("nenhum colide com os reservados da URL", () => {
    const params = [...CHAVES_ESPECIFICAS.map(paramDaFaceta), "fonte", "uf", "ano"];
    for (const r of PARAMETROS_RESERVADOS) expect(params).not.toContain(r);
  });

  it("tipo de emenda vai para tipo_emenda sem virar categoria", () => {
    expect(validarBuscarSearch({ tipo_emenda: "Individual" })).toEqual({
      tipo_emenda: "Individual",
    });
    expect(filtrosDaSearch({ tipo_emenda: "Individual" }).especificas).toEqual({
      tipo: ["Individual"],
    });
  });
});

describe("filtros e navegação", () => {
  const base = { q: "merenda", pagina: 3, ate: "2026-09-26T19:00:00Z", fonte: "PNCP" };

  it("separa universais e próprias", () => {
    expect(filtrosDaSearch({ ...base, modalidade: "Pregão|Dispensa" })).toEqual({
      fonte: ["PNCP"],
      uf: [],
      ano: [],
      especificas: { modalidade: ["Pregão", "Dispensa"] },
    });
  });

  it("alternar um valor volta à página 1 e tira o corte", () => {
    expect(alternarValor(base, "fonte", "CGU")).toEqual({ q: "merenda", fonte: "PNCP|CGU" });
    expect(alternarValor(base, "fonte", "PNCP")).toEqual({ q: "merenda" });
  });

  it("aplica o rascunho do painel de uma vez", () => {
    expect(aplicarFiltros(base, { uf: ["SP"], modalidade: ["Pregão"] })).toEqual({
      q: "merenda",
      uf: "SP",
      modalidade: "Pregão",
    });
  });

  it("paginar leva o corte da resposta; atualizar o tira", () => {
    const pagina2 = searchDaPagina({ q: "merenda" }, 2, "2026-09-26T19:00:00Z");
    expect(pagina2).toEqual({ q: "merenda", pagina: 2, ate: "2026-09-26T19:00:00Z" });
    expect(atualizarResultados(pagina2)).toEqual({ q: "merenda" });
  });
});

describe("troca de categoria", () => {
  const search = { q: "merenda", modalidade: "Pregão", funcao: "Educação", fonte: "PNCP" };

  it("aponta os filtros que não valem no destino", () => {
    expect(incompativeis(search, "artigos").map((x) => x.chave)).toEqual(["modalidade", "funcao"]);
    expect(incompativeis(search, "contratos").map((x) => x.chave)).toEqual(["funcao"]);
    expect(incompativeis(search, null)).toEqual([]);
  });

  it("ir para a categoria retira só os incompatíveis", () => {
    expect(irParaCategoria(search, "contratos")).toEqual({
      q: "merenda",
      tipo: "contratos",
      modalidade: "Pregão",
      fonte: "PNCP",
    });
  });
});

describe("chipsDaSearch", () => {
  it("na visão geral, filtro próprio avisa onde vale", () => {
    expect(chipsDaSearch({ q: "x", modalidade: "Pregão", uf: "__vazio__" })).toEqual([
      { chave: "uf", valor: "__vazio__", texto: "UF: Sem informação", aviso: null },
      {
        chave: "modalidade",
        valor: "Pregão",
        texto: "Modalidade: Pregão",
        aviso: "só em Contratos e Licitações",
      },
    ]);
  });

  it("dentro da categoria, sem aviso", () => {
    expect(chipsDaSearch({ tipo: "contratos", modalidade: "Pregão" })[0].aviso).toBeNull();
  });
});

describe("visão geral", () => {
  const item = { id: "1" } as ItemBusca;
  const resumo: ResumoBusca = {
    corte: "2026-09-26T19:00:00Z",
    contado: true,
    exato: null,
    categorias: [
      { categoria: "artigos", total: 2, previas: [item] },
      { categoria: "contratos", total: 150, previas: [item, item, item] },
      { categoria: "emendas", total: 5, previas: [item] },
    ],
  };

  it("lista todas as categorias ativas na ordem fixa, com zero nas vazias", () => {
    const grupos = gruposDoResumo(resumo);
    expect(grupos.map((g) => [g.categoria, g.total])).toEqual([
      ["pessoas", 0],
      ["organizacoes", 0],
      ["contratos", 150],
      ["licitacoes", 0],
      ["emendas", 5],
      ["convenios", 0],
      ["artigos", 2],
    ]);
    expect(gruposAbertosIniciais(grupos)).toEqual(["contratos", "emendas"]);
  });

  it("sem contagem, totais nulos", () => {
    expect(gruposDoResumo({ ...resumo, contado: false })[2].total).toBeNull();
  });
});

describe("estados e formatação", () => {
  it("deriveEstado", () => {
    const b = { temConsulta: true, carregando: false, temErro: false, temResultados: true };
    expect(deriveEstado({ ...b, temConsulta: false })).toBe("inicial");
    expect(deriveEstado({ ...b, carregando: true })).toBe("carregando");
    expect(deriveEstado({ ...b, temErro: true })).toBe("erro");
    expect(deriveEstado({ ...b, temResultados: false })).toBe("vazio");
    expect(deriveEstado(b)).toBe("pronto");
  });

  it("data na precisão da fonte", () => {
    expect(formatarData({ valor: "2026-03-10", natureza: "assinatura", precisao: "dia" })).toBe(
      "10/03/2026",
    );
    expect(formatarData({ valor: "2022-01-01", natureza: "eleicao", precisao: "ano" })).toBe(
      "2022",
    );
  });

  it("intervalo da página", () => {
    expect(intervaloDaPagina(2, 20, 20, 179)).toBe("21–40 de 179");
    expect(intervaloDaPagina(2, 20, 20, null)).toBe("21–40");
  });
});
