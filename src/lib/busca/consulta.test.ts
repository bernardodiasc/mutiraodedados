import { describe, expect, it } from "vitest";
import {
  FiltroIncompativelError,
  facetasDaCategoria,
  montarFiltrosSql,
  paginaPermitida,
  segmentosDoTrecho,
} from "./consulta";

describe("montarFiltrosSql", () => {
  it("passa as facetas universais sem vazios nem repetidos", () => {
    expect(montarFiltrosSql({ fonte: ["PNCP", " ", "PNCP"], uf: [], ano: ["2024"] }, null)).toEqual(
      {
        fonte: ["PNCP"],
        ano: ["2024"],
      },
    );
  });

  it("na visão geral, faceta própria vale só nas categorias ativas que a têm", () => {
    const sql = montarFiltrosSql({ especificas: { modalidade: ["Pregão"] } }, null);
    expect(sql.por_categoria).toEqual({
      contratos: { modalidade: ["Pregão"] },
      licitacoes: { modalidade: ["Pregão"] },
    });
  });

  it("numa categoria, aplica só nela", () => {
    const sql = montarFiltrosSql({ especificas: { modalidade: ["Pregão"] } }, "contratos");
    expect(sql.por_categoria).toEqual({ contratos: { modalidade: ["Pregão"] } });
  });

  it("recusa com motivo faceta que a categoria não tem", () => {
    expect(() => montarFiltrosSql({ especificas: { modalidade: ["Pregão"] } }, "artigos")).toThrow(
      new FiltroIncompativelError('O filtro "modalidade" não se aplica a Artigos.'),
    );
  });

  it("recusa faceta que nenhuma categoria tem", () => {
    expect(() => montarFiltrosSql({ especificas: { inventada: ["x"] } }, null)).toThrow(
      FiltroIncompativelError,
    );
  });

  it("ignora faceta própria sem valores", () => {
    expect(montarFiltrosSql({ especificas: { modalidade: [] } }, "artigos")).toEqual({});
  });
});

describe("paginaPermitida", () => {
  it("vai até o resultado 10.000", () => {
    expect(paginaPermitida(500, 20)).toBe(true);
    expect(paginaPermitida(501, 20)).toBe(false);
    expect(paginaPermitida(100, 100)).toBe(true);
    expect(paginaPermitida(0, 20)).toBe(false);
  });
});

describe("facetasDaCategoria", () => {
  it("segue a ordem do registro", () => {
    expect(facetasDaCategoria("emendas")).toEqual(["tipo", "funcao", "autor"]);
  });
});

describe("segmentosDoTrecho", () => {
  it("separa os destaques sem interpretar HTML", () => {
    expect(segmentosDoTrecho("Compra de [[merenda]] <b>escolar</b>")).toEqual([
      { texto: "Compra de ", destaque: false },
      { texto: "merenda", destaque: true },
      { texto: " <b>escolar</b>", destaque: false },
    ]);
  });
});
