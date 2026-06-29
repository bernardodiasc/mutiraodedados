import { describe, it, expect } from "vitest";
import {
  slugify,
  isValidSlug,
  buildSavePayload,
  filtrarPorAba,
  contarPorCategoria,
  rotaPublicaCategoria,
  aplicarTituloNoForm,
  formFromArtigo,
  FORM_INICIAL,
} from "./logic";
import type { Artigo } from "@/lib/data/artigos.functions";

const baseArtigo: Artigo = {
  id: "1",
  slug: "ex",
  titulo: "Exemplo",
  resumo: "r",
  conteudo_md: "c",
  categoria: "mapa",
  dificuldade: "iniciante",
  tempo_estimado_min: 5,
  fontes_usadas: ["PNCP", "CGU"],
  notas_internas: "n",
  publico: true,
  created_at: "2024-01-01",
  updated_at: "2024-01-02",
} as unknown as Artigo;

describe("admin-artigos/logic", () => {
  it("slugify normaliza acentos e espaços", () => {
    expect(slugify("Ação Cidadã!")).toBe("acao-cidada");
    expect(slugify("  Com   Espaços  ")).toBe("com-espacos");
  });

  it("isValidSlug aceita só minúsculas/dígitos/hífen", () => {
    expect(isValidSlug("foo-bar-2")).toBe(true);
    expect(isValidSlug("Foo-Bar")).toBe(false);
    expect(isValidSlug("-foo")).toBe(false);
  });

  it("buildSavePayload: nota zera dificuldade e tempo", () => {
    const p = buildSavePayload({
      ...FORM_INICIAL,
      titulo: " Título ",
      categoria: "nota",
      dificuldade: "avancado",
      tempo_estimado_min: "30",
      fontes_usadas: "A, B ,, C",
    });
    expect(p.dificuldade).toBeNull();
    expect(p.tempo_estimado_min).toBeNull();
    expect(p.fontes_usadas).toEqual(["A", "B", "C"]);
    expect(p.titulo).toBe("Título");
    expect(p.id).toBeUndefined();
  });

  it("buildSavePayload com editingId inclui id e usa slug do form", () => {
    const p = buildSavePayload(
      { ...FORM_INICIAL, slug: "meu-slug", titulo: "X", categoria: "mapa", tempo_estimado_min: "10" },
      "abc",
    );
    expect(p.id).toBe("abc");
    expect(p.slug).toBe("meu-slug");
    expect(p.tempo_estimado_min).toBe(10);
  });

  it("filtrarPorAba e contarPorCategoria", () => {
    const lista: Artigo[] = [
      { ...baseArtigo, id: "a", categoria: "mapa" },
      { ...baseArtigo, id: "b", categoria: "nota" },
      { ...baseArtigo, id: "c", categoria: "tutorial" },
    ];
    expect(filtrarPorAba(lista, "tudo")).toHaveLength(3);
    expect(filtrarPorAba(lista, "nota").map((a) => a.id)).toEqual(["b"]);
    expect(contarPorCategoria(lista)).toEqual({ tudo: 3, mapa: 1, tutorial: 1, nota: 1 });
  });

  it("rotaPublicaCategoria", () => {
    expect(rotaPublicaCategoria("mapa")).toBe("/mapas");
    expect(rotaPublicaCategoria("tutorial")).toBe("/tutoriais");
    expect(rotaPublicaCategoria("nota")).toBe("/notas");
  });

  it("aplicarTituloNoForm gera slug só quando novo e slug vazio", () => {
    const f1 = aplicarTituloNoForm(FORM_INICIAL, "Olá Mundo", false);
    expect(f1.slug).toBe("ola-mundo");
    const f2 = aplicarTituloNoForm({ ...FORM_INICIAL, slug: "fixo" }, "Outro", false);
    expect(f2.slug).toBe("fixo");
    const f3 = aplicarTituloNoForm(FORM_INICIAL, "Algo", true);
    expect(f3.slug).toBe("");
  });

  it("formFromArtigo preserva campos com fallback", () => {
    const f = formFromArtigo(baseArtigo);
    expect(f.fontes_usadas).toBe("PNCP, CGU");
    expect(f.tempo_estimado_min).toBe("5");
    expect(f.publico).toBe(true);
  });
});