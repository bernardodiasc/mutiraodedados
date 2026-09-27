import { describe, expect, it } from "vitest";
import type { LinhaPaginaPublica } from "./lista";
import { emDia, planoSincronizacao, resumoSincronizacao } from "./sincronizar";

const linha = (id: string, extra: Partial<LinhaPaginaPublica> = {}): LinhaPaginaPublica => ({
  id,
  rota: id.split("#")[0],
  ancora: id.includes("#") ? id.split("#")[1] : null,
  pagina: "Página",
  titulo: `Título ${id}`,
  resumo: null,
  palavras: null,
  texto: null,
  ...extra,
});

describe("planoSincronizacao", () => {
  it("tabela vazia: tudo é novo", () => {
    const p = planoSincronizacao([linha("/sobre"), linha("/trilhas#a")], []);
    expect(p.novas.map((l) => l.id)).toEqual(["/sobre", "/trilhas#a"]);
    expect(p.alteradas).toEqual([]);
    expect(p.removidas).toEqual([]);
  });

  it("separa iguais, alteradas e removidas", () => {
    const p = planoSincronizacao(
      [linha("/sobre"), linha("/termos", { resumo: "novo" })],
      [linha("/sobre"), linha("/termos", { resumo: "antigo" }), linha("/saiu")],
    );
    expect(p.iguais).toBe(1);
    expect(p.alteradas.map((l) => l.id)).toEqual(["/termos"]);
    expect(p.removidas).toEqual(["/saiu"]);
    expect(p.novas).toEqual([]);
  });

  it("em dia quando nada muda", () => {
    const r = resumoSincronizacao(planoSincronizacao([linha("/sobre")], [linha("/sobre")]));
    expect(emDia(r)).toBe(true);
    expect(r.iguais).toBe(1);
  });
});
