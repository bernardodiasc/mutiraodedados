import { describe, it, expect } from "vitest";
import {
  slugifyNome,
  extrairExtensao,
  nomeBase,
  buildStoragePath,
  validarArquivo,
} from "./logic";

describe("slugifyNome", () => {
  it("remove acentos e normaliza", () => {
    expect(slugifyNome("Açaí Maçã.png")).toBe("acai-maca.png");
  });
  it("limita a 80 chars", () => {
    expect(slugifyNome("a".repeat(200)).length).toBe(80);
  });
  it("substitui caracteres não-permitidos por hífen", () => {
    expect(slugifyNome("foo bar!@#")).toBe("foo-bar");
  });
});

describe("extrairExtensao", () => {
  it("retorna extensão minúscula", () => {
    expect(extrairExtensao("foto.JPG")).toBe("JPG");
  });
  it("retorna 'bin' quando não há extensão", () => {
    expect(extrairExtensao("semponto")).toBe("bin");
  });
  it("pega a última extensão", () => {
    expect(extrairExtensao("a.b.c.png")).toBe("png");
  });
});

describe("nomeBase", () => {
  it("remove a extensão final", () => {
    expect(nomeBase("foto.png")).toBe("foto");
    expect(nomeBase("a.b.c.png")).toBe("a.b.c");
  });
});

describe("buildStoragePath", () => {
  it("monta path userId/uuid-slug.ext", () => {
    expect(buildStoragePath("u1", "uu", "Foto Brasil.png")).toBe("u1/uu-foto-brasil.png");
  });
});

describe("validarArquivo", () => {
  const lim = { MAX_BYTES: 5 * 1024 * 1024, MIMES_OK: ["image/png", "image/jpeg"] };
  it("aceita mime/tamanho válidos", () => {
    expect(validarArquivo({ name: "a.png", type: "image/png", size: 100 }, lim)).toEqual({ ok: true });
  });
  it("rejeita mime", () => {
    const r = validarArquivo({ name: "a.svg", type: "image/svg+xml", size: 100 }, lim);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toBe("mime");
  });
  it("rejeita tamanho", () => {
    const r = validarArquivo({ name: "a.png", type: "image/png", size: 10 * 1024 * 1024 }, lim);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toBe("tamanho");
  });
});