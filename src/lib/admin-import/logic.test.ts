import { describe, it, expect } from "vitest";
import {
  MONTHS,
  yearList,
  defaultMonth,
  monthRange,
  monthLabel,
  buildLimpezaPayload,
  resumirLimpeza,
} from "./logic";

describe("MONTHS", () => {
  it("tem 12 meses em pt-BR", () => {
    expect(MONTHS).toHaveLength(12);
    expect(MONTHS[0]).toBe("Janeiro");
    expect(MONTHS[11]).toBe("Dezembro");
  });
});

describe("yearList", () => {
  it("é decrescente e termina em 2014", () => {
    const ys = yearList(2026);
    expect(ys[0]).toBe(2026);
    expect(ys[ys.length - 1]).toBe(2014);
    expect(ys).toHaveLength(2026 - 2014 + 1);
  });
});

describe("defaultMonth", () => {
  it("retorna mês 3 meses atrás", () => {
    const r = defaultMonth(new Date("2026-06-15T00:00:00Z"));
    expect(r.ano).toBe(2026);
    expect(r.mes).toBe(3);
    expect(r.ini).toBe("2026-03-01");
    expect(r.fim).toBe("2026-03-31");
  });
  it("atravessa a virada do ano", () => {
    const r = defaultMonth(new Date("2026-02-10T00:00:00Z"));
    expect(r.ano).toBe(2025);
    expect(r.mes).toBe(11);
  });
});

describe("monthRange", () => {
  it("fevereiro não-bissexto termina em 28", () => {
    expect(monthRange(2025, 2)).toEqual({ ini: "2025-02-01", fim: "2025-02-28" });
  });
  it("fevereiro bissexto termina em 29", () => {
    expect(monthRange(2024, 2)).toEqual({ ini: "2024-02-01", fim: "2024-02-29" });
  });
  it("preenche zero à esquerda", () => {
    expect(monthRange(2026, 1)).toEqual({ ini: "2026-01-01", fim: "2026-01-31" });
  });
});

describe("monthLabel", () => {
  it("formata 'Mês/Ano'", () => {
    expect(monthLabel(2026, 3)).toBe("Março/2026");
  });
});

describe("buildLimpezaPayload", () => {
  const base = {
    confirm: "APAGAR",
    fontes: ["cgu"],
    usarPeriodo: false,
    anoIni: 2024,
    anoFim: 2026,
  };
  it("monta payload mínimo", () => {
    expect(buildLimpezaPayload(base)).toEqual({ confirm: "APAGAR", fontes: ["cgu"] });
  });
  it("inclui período quando solicitado", () => {
    const p = buildLimpezaPayload({ ...base, usarPeriodo: true });
    expect(p.anoIni).toBe(2024);
    expect(p.anoFim).toBe(2026);
  });
  it("rejeita confirmação inválida", () => {
    expect(() => buildLimpezaPayload({ ...base, confirm: "ok" })).toThrow(/APAGAR/);
  });
  it("rejeita lista vazia", () => {
    expect(() => buildLimpezaPayload({ ...base, fontes: [] })).toThrow(/fonte/i);
  });
  it("rejeita intervalo invertido", () => {
    expect(() =>
      buildLimpezaPayload({ ...base, usarPeriodo: true, anoIni: 2027, anoFim: 2025 }),
    ).toThrow(/maior/);
  });
  it("aceita Set como fontes", () => {
    const p = buildLimpezaPayload({ ...base, fontes: new Set(["cgu", "senado_vot"]) });
    expect(p.fontes.sort()).toEqual(["cgu", "senado_vot"]);
  });
});

describe("resumirLimpeza", () => {
  it("tudo certo: lista o que saiu e omite os zeros", () => {
    const r = resumirLimpeza({
      removed: { tse_candidatos_cache: 492899, tse_bens_candidato_cache: 0 },
    });
    expect(r.ok).toBe(true);
    expect(r.detalhe).toContain("tse_candidatos_cache: 492899");
    expect(r.detalhe).not.toContain("tse_bens_candidato_cache");
  });

  it("nada a apagar não vira mensagem vazia", () => {
    expect(resumirLimpeza({ removed: {} }).detalhe).toBe("nada a apagar");
    expect(resumirLimpeza({ removed: { a: 0 } }).detalhe).toBe("nada a apagar");
  });

  it("uma falha não esconde o que foi apagado de verdade", () => {
    const r = resumirLimpeza({
      removed: { tse_bens_candidato_cache: 120 },
      falhas: { "TSE — candidatos": "canceling statement due to statement timeout" },
    });
    expect(r.ok).toBe(false);
    expect(r.titulo).toMatch(/^1 fonte falhou/);
    expect(r.detalhe).toContain("TSE — candidatos: canceling statement");
    expect(r.detalhe).toContain("tse_bens_candidato_cache: 120");
  });

  it("pluraliza e nomeia todas as fontes que falharam", () => {
    const r = resumirLimpeza({
      removed: {},
      falhas: { "TSE — candidatos": "timeout", "TSE — receitas de campanha": "timeout" },
    });
    expect(r.titulo).toMatch(/^2 fontes falharam/);
    expect(r.detalhe).toContain("TSE — receitas de campanha");
  });
});
