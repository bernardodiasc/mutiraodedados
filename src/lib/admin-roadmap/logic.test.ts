import { describe, it, expect } from "vitest";
import {
  formFromItem,
  ordenarItens,
  ordenarConcluidos,
  itensVisiveis,
  filtrarPorAba,
  contarPorStatus,
  buildSavePayload,
  vizinhoParaTroca,
  itemParaLinhaCsv,
  itemParaTextoCopiavel,
  FORM_INICIAL,
} from "./logic";
import type { RoadmapItem } from "@/lib/data/roadmap.functions";

const base = (over: Partial<RoadmapItem> = {}): RoadmapItem => ({
  id: "1",
  titulo: "t",
  descricao: null,
  status: "planejado",
  ordem: 0,
  publico: true,
  notas: null,
  concluido_em: null,
  created_at: "2024-01-01",
  updated_at: "2024-01-01",
  ...over,
});

describe("admin-roadmap/logic", () => {
  it("formFromItem mapeia nulos para string vazia", () => {
    const f = formFromItem(base({ titulo: "X" }));
    expect(f.titulo).toBe("X");
    expect(f.descricao).toBe("");
    expect(f.notas).toBe("");
  });

  it("ordenarItens usa ordem + created_at", () => {
    const r = ordenarItens([
      base({ id: "a", ordem: 1, created_at: "2024-02-01" }),
      base({ id: "b", ordem: 0, created_at: "2024-01-02" }),
    ]);
    expect(r.map((x) => x.id)).toEqual(["b", "a"]);
  });

  it("filtrarPorAba", () => {
    const items = [base({ id: "1", status: "planejado" }), base({ id: "2", status: "concluido" })];
    expect(filtrarPorAba(items, "tudo")).toHaveLength(2);
    expect(filtrarPorAba(items, "concluido")).toHaveLength(1);
  });

  it("ordenarConcluidos: data desc, e mesmo dia pela ordem manual", () => {
    const items = [
      base({ id: "d10-b", status: "concluido", concluido_em: "2026-01-10", ordem: 5 }),
      base({ id: "d05-a", status: "concluido", concluido_em: "2026-01-05", ordem: 0 }),
      base({ id: "d10-a", status: "concluido", concluido_em: "2026-01-10", ordem: 1 }),
      base({ id: "d05-b", status: "concluido", concluido_em: "2026-01-05", ordem: 9 }),
    ];
    // dia mais recente primeiro; dentro do dia, ordem manual asc
    expect(ordenarConcluidos(items).map((x) => x.id)).toEqual(["d10-a", "d10-b", "d05-a", "d05-b"]);
  });

  it("itensVisiveis: concluídos por data, demais por ordem", () => {
    const porOrdem = ordenarItens([
      base({ id: "p", status: "planejado", ordem: 0 }),
      base({ id: "c-novo", status: "concluido", ordem: 1, concluido_em: "2026-02-01" }),
      base({ id: "c-velho", status: "concluido", ordem: 2, concluido_em: "2026-01-01" }),
    ]);
    expect(itensVisiveis(porOrdem, "concluido").map((x) => x.id)).toEqual(["c-novo", "c-velho"]);
    expect(itensVisiveis(porOrdem, "planejado").map((x) => x.id)).toEqual(["p"]);
    expect(itensVisiveis(porOrdem, "tudo")).toHaveLength(3);
  });

  it("contarPorStatus", () => {
    const c = contarPorStatus([
      base({ status: "planejado" }),
      base({ status: "concluido" }),
      base({ status: "em_andamento" }),
    ]);
    expect(c).toEqual({ tudo: 3, em_andamento: 1, planejado: 1, concluido: 1 });
  });

  it("buildSavePayload novo usa total como ordem", () => {
    const p = buildSavePayload({ ...FORM_INICIAL, titulo: " Oi " }, null, 5);
    expect(p.ordem).toBe(5);
    expect(p.titulo).toBe("Oi");
    expect("id" in p).toBe(false);
  });

  it("buildSavePayload edit reusa ordem do editing", () => {
    const p = buildSavePayload({ ...FORM_INICIAL, titulo: "T" }, base({ id: "z", ordem: 9 }), 99);
    expect(p.ordem).toBe(9);
    expect((p as { id?: string }).id).toBe("z");
  });

  it("vizinhoParaTroca", () => {
    const sorted = [base({ id: "a" }), base({ id: "b" }), base({ id: "c" })];
    expect(vizinhoParaTroca(sorted, "a", -1)).toBeNull();
    expect(vizinhoParaTroca(sorted, "a", 1)?.id).toBe("b");
    expect(vizinhoParaTroca(sorted, "c", 1)).toBeNull();
  });

  it("itemParaLinhaCsv traduz status e publico", () => {
    const l = itemParaLinhaCsv(
      base({ titulo: "X", status: "concluido", publico: false, concluido_em: "2026-01" }),
    );
    expect(l.status).toBe("Concluído");
    expect(l.publico).toBe("não");
    expect(l.concluido_em).toBe("2026-01");
  });

  it("itemParaTextoCopiavel inclui status, descrição e notas", () => {
    const txt = itemParaTextoCopiavel(
      base({ titulo: "T", descricao: "desc", notas: "nota", status: "em_andamento" }),
    );
    expect(txt).toContain("# T");
    expect(txt).toContain("Status: Em andamento");
    expect(txt).toContain("desc");
    expect(txt).toContain("Notas internas: nota");
  });
});
