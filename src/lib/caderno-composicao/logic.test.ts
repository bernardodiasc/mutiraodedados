import { describe, it, expect } from "vitest";
import {
  slugDeUrlArtigo,
  agruparParaComposicao,
  montarTextoComposicao,
  chaveSnapshot,
} from "./logic";
import type { PerguntaItem } from "@/lib/pergunta-itens.functions";

const item = (over: Partial<PerguntaItem>): PerguntaItem => ({
  id: "i",
  pergunta_id: "p",
  user_id: "u",
  tipo: "link",
  ref_id: null,
  titulo: "Item",
  url: null,
  nota: null,
  ordem: 0,
  created_at: "2026-01-01",
  ...over,
});

describe("slugDeUrlArtigo", () => {
  it("extrai o slug de urls internas de artigo", () => {
    expect(slugDeUrlArtigo("/mapas/auditar-cota-parlamentar")).toBe("auditar-cota-parlamentar");
    expect(slugDeUrlArtigo("/tutoriais/usar-busca")).toBe("usar-busca");
  });
  it("devolve null para url externa, nula ou de outra rota", () => {
    expect(slugDeUrlArtigo(null)).toBeNull();
    expect(slugDeUrlArtigo("https://x.gov/y")).toBeNull();
    expect(slugDeUrlArtigo("/contratos/123")).toBeNull();
  });
});

describe("chaveSnapshot", () => {
  it("compõe tipo:ref_id", () => {
    expect(chaveSnapshot("contrato", "abc")).toBe("contrato:abc");
  });
});

describe("agruparParaComposicao", () => {
  it("separa procedimentos (artigo interno), prompts e dados", () => {
    const g = agruparParaComposicao([
      item({ id: "1", tipo: "link", url: "/mapas/x" }),
      item({ id: "2", tipo: "prompt", ref_id: "pm1" }),
      item({ id: "3", tipo: "contrato", url: "/contratos/9" }),
    ]);
    expect(g.procedimentos.map((i) => i.id)).toEqual(["1"]);
    expect(g.prompts.map((i) => i.id)).toEqual(["2"]);
    expect(g.dados.map((i) => i.id)).toEqual(["3"]);
  });
});

describe("montarTextoComposicao", () => {
  it("monta na ordem procedimento → dados → prompt com conteúdos resolvidos", () => {
    const grupos = agruparParaComposicao([
      item({ id: "1", tipo: "link", url: "/mapas/mapa-x", titulo: "Mapa X" }),
      item({ id: "2", tipo: "contrato", ref_id: "c9", titulo: "Contrato 9", url: "/contratos/9" }),
      item({ id: "3", tipo: "prompt", ref_id: "pm1", titulo: "Prompt 1" }),
    ]);
    const texto = montarTextoComposicao(
      { titulo: "Minha investigação", contexto: "contexto aqui" },
      grupos,
      {
        artigosPorSlug: new Map([["mapa-x", "CONTEUDO DO MAPA"]]),
        promptsPorId: new Map([["pm1", "TEMPLATE DO PROMPT"]]),
        snapshotsPorItem: new Map([
          [chaveSnapshot("contrato", "c9"), { conteudo: '{"valor":9}', em: "2026-02-01" }],
        ]),
      },
    );
    expect(texto).toContain("# Investigação: Minha investigação");
    expect(texto).toContain("CONTEUDO DO MAPA");
    expect(texto).toContain("TEMPLATE DO PROMPT");
    expect(texto).toContain('{"valor":9}');
    // ordem: procedimento antes de dados antes de prompt
    expect(texto.indexOf("CONTEUDO DO MAPA")).toBeLessThan(texto.indexOf('{"valor":9}'));
    expect(texto.indexOf('{"valor":9}')).toBeLessThan(texto.indexOf("TEMPLATE DO PROMPT"));
  });

  it("cai no bloco de referência quando o artigo não foi resolvido", () => {
    const grupos = agruparParaComposicao([
      item({ id: "1", tipo: "link", url: "/mapas/sumiu", titulo: "Mapa sumido" }),
    ]);
    const texto = montarTextoComposicao({ titulo: "T", contexto: null }, grupos, {
      artigosPorSlug: new Map(),
      promptsPorId: new Map(),
    });
    expect(texto).toContain("Mapa sumido");
  });
});
