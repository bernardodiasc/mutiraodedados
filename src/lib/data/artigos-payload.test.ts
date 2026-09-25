import { describe, it, expect } from "vitest";
import { montarPayloadArtigo, publicadoEmAoSalvar } from "./artigos-payload";

const base = {
  slug: "meu-artigo",
  titulo: "Meu artigo",
  conteudo_md: "texto",
  categoria: "tutorial" as const,
  fontes_usadas: [],
  publico: false,
};

describe("montarPayloadArtigo — capa", () => {
  it("sem capa_url não mexe na capa existente", () => {
    const payload = montarPayloadArtigo(base);
    expect(payload).not.toHaveProperty("capa_url");
  });

  it("com capa_url grava a url", () => {
    const payload = montarPayloadArtigo({ ...base, capa_url: "https://ex.com/capa.png" });
    expect(payload.capa_url).toBe("https://ex.com/capa.png");
  });

  it("com capa_url null remove a capa", () => {
    const payload = montarPayloadArtigo({ ...base, capa_url: null });
    expect(payload).toHaveProperty("capa_url", null);
  });
});

describe("publicadoEmAoSalvar", () => {
  const agora = "2026-09-25T12:00:00.000Z";

  it("público que já tinha data mantém a data de publicação", () => {
    expect(publicadoEmAoSalvar(true, "2026-04-15T12:00:00.000Z", agora)).toBe(
      "2026-04-15T12:00:00.000Z",
    );
  });

  it("público sem data recebe agora", () => {
    expect(publicadoEmAoSalvar(true, null, agora)).toBe(agora);
  });

  it("não público fica sem data", () => {
    expect(publicadoEmAoSalvar(false, "2026-04-15T12:00:00.000Z", agora)).toBeNull();
  });
});
