import { describe, it, expect } from "vitest";
import {
  aplicarAcao,
  envolverSelecao,
  imagemMarkdown,
  inserirBloco,
  inserirLink,
  prefixarLinha,
  TABELA_MODELO,
} from "./logic";

describe("envolverSelecao", () => {
  it("envolve o trecho selecionado", () => {
    const r = envolverSelecao("um dois tres", { start: 3, end: 7 }, "**");
    expect(r.value).toBe("um **dois** tres");
    expect(r.value.slice(r.cursor)).toBe("** tres");
  });
  it("usa placeholder quando não há seleção", () => {
    const r = envolverSelecao("", { start: 0, end: 0 }, "**", "negrito");
    expect(r.value).toBe("**negrito**");
  });
});

describe("prefixarLinha", () => {
  it("prefixa a linha do cursor sem afetar as anteriores", () => {
    const r = prefixarLinha("linha 1\nlinha 2", { start: 10, end: 10 }, "## ");
    expect(r.value).toBe("linha 1\n## linha 2");
  });
  it("prefixa a primeira linha", () => {
    const r = prefixarLinha("titulo", { start: 2, end: 2 }, "- ");
    expect(r.value).toBe("- titulo");
  });
});

describe("inserirLink", () => {
  it("usa a seleção como rótulo e deixa o cursor no href", () => {
    const r = inserirLink("veja aqui ok", { start: 5, end: 9 }, "https://");
    expect(r.value).toBe("veja [aqui](https://) ok");
    expect(r.value.slice(r.cursor)).toBe("https://) ok");
  });
  it("usa rótulo padrão sem seleção", () => {
    const r = inserirLink("", { start: 0, end: 0 });
    expect(r.value).toBe("[texto do link](https://)");
  });
});

describe("inserirBloco", () => {
  it("insere substituindo a seleção", () => {
    const r = inserirBloco("ab", { start: 1, end: 1 }, "X");
    expect(r.value).toBe("aXb");
    expect(r.cursor).toBe(2);
  });
});

describe("imagemMarkdown", () => {
  it("monta a marcação de imagem", () => {
    expect(imagemMarkdown("/img/x.png", "Legenda")).toBe("![Legenda](/img/x.png)");
  });
});

describe("aplicarAcao", () => {
  it("negrito envolve", () => {
    expect(aplicarAcao("negrito", "x", { start: 0, end: 1 }).value).toBe("**x**");
  });
  it("titulo2 prefixa", () => {
    expect(aplicarAcao("titulo2", "t", { start: 0, end: 0 }).value).toBe("## t");
  });
  it("tabela insere o modelo", () => {
    expect(aplicarAcao("tabela", "", { start: 0, end: 0 }).value).toBe(TABELA_MODELO);
  });
  it("fluxo insere o shortcode com o nome", () => {
    const r = aplicarAcao("fluxo", "", { start: 0, end: 0 }, { fluxo: "contrato-pncp" });
    expect(r.value).toContain(':::fluxo{nome="contrato-pncp"}:::');
  });
});
