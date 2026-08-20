import { describe, it, expect } from "vitest";
import {
  UFS,
  PRESETS,
  UF_LIST,
  sanitizeIbge,
  monthRange,
  isMunicipio,
  isUF,
  tamanhoDoConjunto,
  estimativaVarredura,
  percentualVarredura,
  escopoDoEnte,
  rotuloEscopo,
  periodoFiscalDoMes,
  nomePeriodoFiscal,
  rotuloPeriodoFiscal,
  rodadaEsteril,
  paradaPorOrigem,
  MAX_RODADAS_ESTEREIS,
} from "./logic";

describe("UFS", () => {
  it("tem 28 entradas (vazio + 27 UFs)", () => {
    expect(UFS).toHaveLength(28);
    expect(UFS[0]).toBe("");
    expect(UFS).toContain("SP");
    expect(UFS).toContain("DF");
  });
});

describe("PRESETS", () => {
  it("contém códigos IBGE conhecidos", () => {
    expect(PRESETS.find((p) => p.codigo === "3550308")).toBeDefined();
    expect(PRESETS.find((p) => p.codigo === "53")?.tipo).toBe("UF");
  });
});

describe("UF_LIST", () => {
  it("contém 27 estados todos marcados como UF", () => {
    expect(UF_LIST).toHaveLength(27);
    expect(UF_LIST.every((e) => e.tipo === "UF")).toBe(true);
    expect(UF_LIST.find((e) => e.uf === "SP")?.codigo).toBe("35");
  });
});

describe("sanitizeIbge", () => {
  it("remove não-dígitos", () => {
    expect(sanitizeIbge("35-50.308")).toBe("3550308");
  });
  it("limita a 7 caracteres", () => {
    expect(sanitizeIbge("12345678901")).toBe("1234567");
  });
  it("aceita vazio", () => {
    expect(sanitizeIbge("abc")).toBe("");
  });
});

describe("monthRange", () => {
  it("fevereiro não-bissexto", () => {
    expect(monthRange(2025, 2)).toEqual({ ini: "2025-02-01", fim: "2025-02-28" });
  });
  it("fevereiro bissexto", () => {
    expect(monthRange(2024, 2)).toEqual({ ini: "2024-02-01", fim: "2024-02-29" });
  });
  it("preenche zero à esquerda em janeiro", () => {
    expect(monthRange(2026, 1)).toEqual({ ini: "2026-01-01", fim: "2026-01-31" });
  });
});

describe("isMunicipio / isUF", () => {
  it("identifica 7 dígitos como município", () => {
    expect(isMunicipio("3550308")).toBe(true);
    expect(isMunicipio("35")).toBe(false);
    expect(isMunicipio("355030a")).toBe(false);
  });
  it("identifica 2 dígitos como UF", () => {
    expect(isUF("35")).toBe(true);
    expect(isUF("3550308")).toBe(false);
    expect(isUF("a5")).toBe(false);
  });
});

describe("tamanhoDoConjunto", () => {
  it("UFs e capitais são 27, exatos", () => {
    expect(tamanhoDoConjunto("ufs")).toEqual({ n: 27, exato: true });
    expect(tamanhoDoConjunto("capitais")).toEqual({ n: 27, exato: true });
  });

  it("ente único é 1", () => {
    expect(tamanhoDoConjunto("ente")).toEqual({ n: 1, exato: true });
  });

  it("municípios é estimativa, não número exato", () => {
    expect(tamanhoDoConjunto("municipios").exato).toBe(false);
  });
});

describe("estimativaVarredura", () => {
  it("mostra o produto das três dimensões", () => {
    expect(estimativaVarredura("ufs", 2013, 2026)).toBe(
      "27 entes × 14 exercícios × 10 relatórios = 3.780 consultas",
    );
  });

  it("marca com ~ quando o número de entes é estimado", () => {
    expect(estimativaVarredura("municipios", 2024, 2024)).toContain("~206 entes");
    expect(estimativaVarredura("municipios", 2024, 2024)).toContain("~2.060 consultas");
  });

  it("singular quando é um só", () => {
    expect(estimativaVarredura("ente", 2024, 2024)).toBe(
      "1 ente × 1 exercício × 10 relatórios = 10 consultas",
    );
  });

  it("intervalo invertido avisa em vez de calcular", () => {
    expect(estimativaVarredura("ufs", 2026, 2013)).toContain("inválido");
  });
});

describe("percentualVarredura", () => {
  it("calcula o percentual", () => {
    expect(percentualVarredura(1890, 3780)).toBe(50);
  });

  it("nunca passa de 100", () => {
    expect(percentualVarredura(4000, 3780)).toBe(100);
  });

  it("total zero não estoura", () => {
    expect(percentualVarredura(0, 0)).toBe(0);
  });
});

describe("escopoDoEnte", () => {
  it("2 dígitos é UF e traz a sigla", () => {
    expect(escopoDoEnte("35")).toEqual({ tipo: "uf", codigoIbge: "35", sigla: "SP" });
    expect(escopoDoEnte("43")).toEqual({ tipo: "uf", codigoIbge: "43", sigla: "RS" });
  });

  it("7 dígitos é município", () => {
    expect(escopoDoEnte("3550308")).toEqual({ tipo: "municipio", codigoIbge: "3550308" });
  });

  it("vazio ou inválido não tem escopo", () => {
    expect(escopoDoEnte("")).toEqual({ tipo: "nenhum" });
    expect(escopoDoEnte("123")).toEqual({ tipo: "nenhum" });
  });

  it("limpa o que o usuário digita", () => {
    expect(escopoDoEnte(" 35 ")).toEqual({ tipo: "uf", codigoIbge: "35", sigla: "SP" });
  });
});

describe("rotuloEscopo", () => {
  it("sem ente, a importação é do país", () => {
    expect(rotuloEscopo({ tipo: "nenhum" })).toBe("Brasil inteiro");
  });

  it("prefere o nome do ente quando conhecido", () => {
    expect(rotuloEscopo({ tipo: "uf", codigoIbge: "35", sigla: "SP" }, "São Paulo (estado)")).toBe(
      "São Paulo (estado)",
    );
  });

  it("cai para a sigla quando não sabe o nome", () => {
    expect(rotuloEscopo({ tipo: "uf", codigoIbge: "35", sigla: "SP" })).toBe("UF SP");
  });
});

describe("periodoFiscalDoMes", () => {
  it("RREO é bimestral: o mês determina o bimestre", () => {
    expect(periodoFiscalDoMes(1, "RREO")).toBe(1);
    expect(periodoFiscalDoMes(2, "RREO")).toBe(1);
    expect(periodoFiscalDoMes(3, "RREO")).toBe(2);
    expect(periodoFiscalDoMes(12, "RREO")).toBe(6);
  });

  it("RGF é quadrimestral: 4 meses cada, 3 no ano", () => {
    expect(periodoFiscalDoMes(1, "RGF")).toBe(1);
    expect(periodoFiscalDoMes(4, "RGF")).toBe(1);
    expect(periodoFiscalDoMes(5, "RGF")).toBe(2);
    expect(periodoFiscalDoMes(8, "RGF")).toBe(2);
    expect(periodoFiscalDoMes(9, "RGF")).toBe(3);
    expect(periodoFiscalDoMes(12, "RGF")).toBe(3);
  });

  it("DCA é anual — não tem período", () => {
    expect(periodoFiscalDoMes(5, "DCA")).toBeUndefined();
  });

  it("mês fora da faixa não estoura", () => {
    expect(periodoFiscalDoMes(0, "RREO")).toBe(1);
    expect(periodoFiscalDoMes(99, "RREO")).toBe(6);
  });
});

describe("nomePeriodoFiscal", () => {
  it("nomeia o período de cada relatório", () => {
    expect(nomePeriodoFiscal("RREO")).toBe("bimestre");
    expect(nomePeriodoFiscal("RGF")).toBe("quadrimestre");
    expect(nomePeriodoFiscal("DCA")).toBe("exercício");
  });
});

describe("rotuloPeriodoFiscal", () => {
  it("maio é o 3º bimestre e o 2º quadrimestre — os meses tiram a dúvida", () => {
    expect(rotuloPeriodoFiscal(5, "RREO")).toBe("3 (mai–jun)");
    expect(rotuloPeriodoFiscal(5, "RGF")).toBe("2 (mai–ago)");
  });

  it("cobre as pontas do ano", () => {
    expect(rotuloPeriodoFiscal(1, "RREO")).toBe("1 (jan–fev)");
    expect(rotuloPeriodoFiscal(12, "RREO")).toBe("6 (nov–dez)");
    expect(rotuloPeriodoFiscal(1, "RGF")).toBe("1 (jan–abr)");
    expect(rotuloPeriodoFiscal(12, "RGF")).toBe("3 (set–dez)");
  });

  it("os 6 bimestres cobrem os 12 meses sem buraco nem sobreposição", () => {
    const vistos = new Set<string>();
    for (let m = 1; m <= 12; m++) vistos.add(rotuloPeriodoFiscal(m, "RREO"));
    expect(vistos.size).toBe(6);
  });

  it("os 3 quadrimestres cobrem os 12 meses", () => {
    const vistos = new Set<string>();
    for (let m = 1; m <= 12; m++) vistos.add(rotuloPeriodoFiscal(m, "RGF"));
    expect(vistos.size).toBe(3);
  });

  it("DCA é anual — não tem período dentro do ano", () => {
    expect(rotuloPeriodoFiscal(5, "DCA")).toBe("ano inteiro");
  });
});

describe("varredura travada na origem", () => {
  it("rodada com importação não é estéril, mesmo com erro", () => {
    expect(rodadaEsteril(3, ["p2: falhou"])).toBe(false);
  });

  it("rodada vazia sem erro não é estéril — pode ser fim legítimo", () => {
    expect(rodadaEsteril(0, [])).toBe(false);
    expect(rodadaEsteril(0, undefined)).toBe(false);
  });

  it("rodada vazia com erro é estéril", () => {
    expect(rodadaEsteril(0, ["p1: TRANSIENT: PNCP 504"])).toBe(true);
  });

  it("uma rodada estéril não para a varredura", () => {
    expect(paradaPorOrigem(1, "504")).toBeNull();
  });

  it("duas seguidas param, e a mensagem culpa a origem e cita o erro", () => {
    const m = paradaPorOrigem(MAX_RODADAS_ESTEREIS, "p1: TRANSIENT: PNCP 504");
    expect(m).toContain("a origem não respondeu");
    expect(m).toContain("retoma de onde parou");
    expect(m).toContain("PNCP 504");
  });
});
