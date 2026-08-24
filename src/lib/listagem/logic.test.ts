import { describe, expect, it } from "vitest";
import {
  ITENS_PADRAO,
  calcularTotalPaginas,
  decomporOrdem,
  intervaloExibido,
  montarIntervaloPaginas,
  normalizarAte,
  normalizarItens,
  offsetDaPagina,
  parseSearchListagem,
} from "./logic";

const ORDENS = [
  { valor: "data-desc", label: "Mais recentes" },
  { valor: "valor-desc", label: "Maior valor" },
];

describe("parseSearchListagem", () => {
  it("omite valores padrão para manter a URL limpa", () => {
    expect(parseSearchListagem({}, { ordens: ORDENS, ordemPadrao: "data-desc" })).toEqual({
      pagina: undefined,
      itens: undefined,
      ordem: undefined,
      ate: undefined,
    });
  });

  it("aceita página, itens permitidos, ordem conhecida e corte ISO", () => {
    expect(
      parseSearchListagem(
        { pagina: "3", itens: "250", ordem: "valor-desc", ate: "2026-08-24T10:00:00.000Z" },
        { ordens: ORDENS, ordemPadrao: "data-desc" },
      ),
    ).toEqual({ pagina: 3, itens: 250, ordem: "valor-desc", ate: "2026-08-24T10:00:00.000Z" });
  });

  it("descarta valores inválidos (página 0, itens fora das opções, ordem desconhecida)", () => {
    const r = parseSearchListagem(
      { pagina: "0", itens: "37", ordem: "hack-asc", ate: "ontem" },
      { ordens: ORDENS, ordemPadrao: "data-desc" },
    );
    expect(r).toEqual({ pagina: undefined, itens: undefined, ordem: undefined, ate: undefined });
    expect(normalizarItens("37")).toBe(ITENS_PADRAO);
    expect(normalizarAte("ontem")).toBeUndefined();
  });
});

describe("decomporOrdem", () => {
  it("separa campo e direção, com desc como padrão", () => {
    expect(decomporOrdem("data_assinatura-asc")).toEqual({
      campo: "data_assinatura",
      direcao: "asc",
    });
    expect(decomporOrdem("valor")).toEqual({ campo: "valor", direcao: "desc" });
  });
});

describe("paginação", () => {
  it("calcula total de páginas, offset e intervalo exibido", () => {
    expect(calcularTotalPaginas(1050, 100)).toBe(11);
    expect(offsetDaPagina(3, 100)).toBe(200);
    expect(intervaloExibido(11, 100, 1050)).toEqual({ de: 1001, ate: 1050 });
    expect(intervaloExibido(1, 100, 0)).toEqual({ de: 0, ate: 0 });
  });

  it("monta o intervalo com elipses ao redor da página atual", () => {
    expect(montarIntervaloPaginas(5, 12)).toEqual([1, "…", 4, 5, 6, "…", 12]);
    expect(montarIntervaloPaginas(2, 12)).toEqual([1, 2, 3, "…", 12]);
    expect(montarIntervaloPaginas(1, 5)).toEqual([1, 2, 3, 4, 5]);
  });
});
