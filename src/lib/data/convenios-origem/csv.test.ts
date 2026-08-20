import { describe, it, expect } from "vitest";
import {
  dividirLinhaCsv,
  parseDataBR,
  parseValorBR,
  resolverColunas,
  mapearLinhaOrigem,
} from "./csv";

describe("csv da origem SICONV", () => {
  it("divide por ; e respeita aspas", () => {
    expect(dividirLinhaCsv("a;b;c")).toEqual(["a", "b", "c"]);
    expect(dividirLinhaCsv('a;"x;y";c')).toEqual(["a", "x;y", "c"]);
    expect(dividirLinhaCsv('a;"diz ""oi""";c')).toEqual(["a", 'diz "oi"', "c"]);
  });

  it("data DD/MM/YYYY vira ISO; lixo vira null", () => {
    expect(parseDataBR("17/09/2021")).toBe("2021-09-17");
    expect(parseDataBR("")).toBeNull();
    expect(parseDataBR("2021-09-17")).toBeNull();
  });

  it("números no formato MISTO do arquivo — o caso real que motivou o parser", () => {
    expect(parseValorBR("98191,86")).toBe(98191.86);
    expect(parseValorBR("1.234.567,89")).toBe(1234567.89);
    expect(parseValorBR("688.44")).toBe(688.44); // decimal com PONTO, mesmo arquivo
    expect(parseValorBR("")).toBeNull();
  });

  it("resolve colunas pelo cabeçalho, com BOM, à prova de reordenação", () => {
    const cab = "﻿NR_CONVENIO;X;SIT_CONVENIO;DIA_ASSIN_CONV;VL_EMPENHADO_CONV;VL_DESEMBOLSADO_CONV";
    const cols = resolverColunas(cab);
    expect(cols).toEqual({ nr: 0, sit: 2, assin: 3, empenhado: 4, desembolsado: 5 });
    expect(resolverColunas("A;B;C")).toBeNull();
  });

  it("mapeia uma linha real e recusa código inválido", () => {
    const cols = { nr: 0, sit: 1, assin: 2, empenhado: 3, desembolsado: 4 };
    expect(mapearLinhaOrigem("926898;Assinado;17/09/2021;98093,67;100.5", cols)).toEqual({
      codigo_siconv: "926898",
      situacao_origem: "Assinado",
      data_assinatura: "2021-09-17",
      valor_empenhado: 98093.67,
      valor_desembolsado: 100.5,
    });
    expect(mapearLinhaOrigem(";;;;", cols)).toBeNull();
  });
});
