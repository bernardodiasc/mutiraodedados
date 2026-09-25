import { describe, expect, it } from "vitest";
import { tituloDaPagina } from "./logic";

describe("tituloDaPagina", () => {
  it("usa o H1 seguido do nome do site", () => {
    expect(tituloDaPagina("Sinais investigativos")).toBe(
      "Sinais investigativos — Mutirão de Dados",
    );
  });

  it("cai no padrão quando o H1 ainda não existe", () => {
    expect(tituloDaPagina(null, "Contrato")).toBe("Contrato — Mutirão de Dados");
    expect(tituloDaPagina("   ", "Contrato")).toBe("Contrato — Mutirão de Dados");
  });

  it("sem H1 nem padrão, fica só o nome do site", () => {
    expect(tituloDaPagina(undefined)).toBe("Mutirão de Dados");
  });

  it("encurta H1 longo sem cortar palavra", () => {
    const h1 =
      "Aquisição de equipamentos de informática para as unidades regionais do órgão federal";
    const t = tituloDaPagina(h1);
    expect(t.endsWith("… — Mutirão de Dados")).toBe(true);
    expect(t.length).toBeLessThanOrEqual(80 + " — Mutirão de Dados".length);
    expect(h1.startsWith(t.replace("… — Mutirão de Dados", ""))).toBe(true);
  });
});
