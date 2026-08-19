import { describe, expect, it } from "vitest";
import {
  cguAindaSuspeito,
  findingValorCorrigidoListagem,
  razaoEscala,
  regrasCgu,
  valorAutoritativoCgu,
} from "@/lib/data/qa";

describe("regrasCgu", () => {
  it("não cria valor_muito_baixo para contrato com valor alto", () => {
    const findings = regrasCgu([
      { id: "contrato-600k", valor: 600000, valor_inicial: 600000, orgao_cod: "26000" },
    ]);

    expect(findings.some((f) => f.regra === "valor_muito_baixo")).toBe(false);
  });

  it("cria valor_muito_baixo quando o valor final realmente está abaixo de R$ 100", () => {
    const findings = regrasCgu([
      { id: "contrato-80", valor: 80, valor_inicial: 80, orgao_cod: "26000" },
    ]);

    expect(findings).toMatchObject([
      { regra: "valor_muito_baixo", tipo: "qualidade", valor_armazenado: 80 },
    ]);
  });

  it("cria discrepancia_extrema_inicial_final crítico quando o final infla ≥1000×", () => {
    const findings = regrasCgu([
      { id: "c1", valor: 5_000_000, valor_inicial: 5_000, orgao_cod: "26000" },
    ]);
    expect(findings).toMatchObject([
      {
        regra: "discrepancia_extrema_inicial_final",
        tipo: "qualidade",
        severidade: "critico",
        valor_armazenado: 5_000_000,
        valor_esperado: 5_000,
      },
    ]);
  });

  it("cria discrepancia_extrema_inicial_final aviso quando o inicial é ≥1000× o final (redução pode ser legítima)", () => {
    const findings = regrasCgu([
      { id: "c2", valor: 500, valor_inicial: 5_000_000, orgao_cod: "26000" },
    ]);
    expect(findings).toMatchObject([
      { regra: "discrepancia_extrema_inicial_final", severidade: "aviso" },
    ]);
  });

  it("não cria discrepância para razão abaixo de 1000×", () => {
    const findings = regrasCgu([
      { id: "c3", valor: 999_000, valor_inicial: 1_000, orgao_cod: "26000" },
    ]);
    expect(findings.some((f) => f.regra === "discrepancia_extrema_inicial_final")).toBe(false);
  });
});

describe("razaoEscala", () => {
  it("identifica as escalas do bug ponto-fixo da CGU", () => {
    expect(razaoEscala(576, 57_600)).toBe(100);
    expect(razaoEscala(576, 576_000)).toBe(1000);
    expect(razaoEscala(576, 5_760_000)).toBe(10000);
    // Ordem dos argumentos não importa.
    expect(razaoEscala(5_760_000, 576)).toBe(10000);
  });

  it("tolera até 2% de desvio da potência exata", () => {
    expect(razaoEscala(100, 101 * 100)).toBe(100);
    expect(razaoEscala(100, 103 * 100)).toBeNull();
  });

  it("retorna null para razões que não são escala de ponto-fixo", () => {
    expect(razaoEscala(100, 100)).toBeNull();
    expect(razaoEscala(100, 5_000)).toBeNull();
    expect(razaoEscala(0, 1000)).toBeNull();
    expect(razaoEscala(-5, 1000)).toBeNull();
  });
});

describe("valorAutoritativoCgu", () => {
  it("listagem truncada: vence o detalhe (maior), registra truncado e razão", () => {
    const r = valorAutoritativoCgu(576, 5_760_000);
    expect(r).toEqual({ valor: 5_760_000, truncado: 576, razao: 10000 });
  });

  it("detalhe truncado: vence a listagem (maior)", () => {
    const r = valorAutoritativoCgu(5_760_000, 576);
    expect(r).toEqual({ valor: 5_760_000, truncado: 576, razao: 10000 });
  });

  it("razão ≥100 mas fora das potências de 10: corrige mesmo assim (razao null)", () => {
    const r = valorAutoritativoCgu(1_000, 500_000);
    expect(r).toEqual({ valor: 500_000, truncado: 1_000, razao: null });
  });

  it("leituras compatíveis: confia no detalhe", () => {
    const r = valorAutoritativoCgu(123_400, 123_456);
    expect(r).toEqual({ valor: 123_456, truncado: null, razao: null });
  });

  it("ambos truncados na mesma escala (razão ≈ 1): indetectável — passa o detalhe (limitação documentada)", () => {
    const r = valorAutoritativoCgu(576, 576);
    expect(r).toEqual({ valor: 576, truncado: null, razao: null });
  });

  it("só uma leitura disponível: usa a que existe, sem marcar truncamento", () => {
    expect(valorAutoritativoCgu(0, 576)).toEqual({ valor: 576, truncado: null, razao: null });
    expect(valorAutoritativoCgu(576, 0)).toEqual({ valor: 576, truncado: null, razao: null });
    expect(valorAutoritativoCgu(0, 0)).toEqual({ valor: 0, truncado: null, razao: null });
  });
});

describe("findingValorCorrigidoListagem", () => {
  it("nasce info, resolvido (corrigido_automaticamente) e com evidência bruta", () => {
    const f = findingValorCorrigidoListagem({
      id: "c1",
      orgao_cod: "26000",
      valor_truncado: 576,
      valor_correto: 5_760_000,
      valor_listagem: 576,
      valor_detalhe: 5_760_000,
      pagina_varredura: 3,
      razao: 10000,
      evidencia_bruta: [
        { origem: "listagem", valorFinal: 576, valorInicial: 0, em: "2026-01-01T00:00:00Z" },
        {
          origem: "detalhe",
          valorFinal: 5_760_000,
          valorInicial: 0,
          em: "2026-01-01T00:00:01Z",
          rawSnippet: '{"valorFinalCompra":5760000}',
        },
      ],
    });
    expect(f.severidade).toBe("info");
    expect(f.tipo).toBe("qualidade");
    expect(f.status).toBe("corrigido_automaticamente");
    expect(f.valor_armazenado).toBe(576);
    expect(f.valor_esperado).toBe(5_760_000);
    expect(f.detalhes?.razao_escala).toBe(10000);
    expect(f.detalhes?.evidencia_bruta).toHaveLength(2);
  });
});

describe("cguAindaSuspeito (fonte única das re-checagens)", () => {
  it("discrepancia_extrema_inicial_final segue os limiares de 1000×", () => {
    expect(cguAindaSuspeito("discrepancia_extrema_inicial_final", 5_000_000, 5_000)).toBe(true);
    expect(cguAindaSuspeito("discrepancia_extrema_inicial_final", 5_000, 5_000_000)).toBe(true);
    expect(cguAindaSuspeito("discrepancia_extrema_inicial_final", 900_000, 1_000)).toBe(false);
  });

  it("valor_muito_baixo segue o limite de R$ 100", () => {
    expect(cguAindaSuspeito("valor_muito_baixo", 80, 0)).toBe(true);
    expect(cguAindaSuspeito("valor_muito_baixo", 100, 0)).toBe(false);
    expect(cguAindaSuspeito("valor_muito_baixo", 0, 0)).toBe(false);
  });

  it("regra aposentada valor_final_truncado_suspeito mantém a semântica original", () => {
    expect(cguAindaSuspeito("valor_final_truncado_suspeito", 80, 5_000)).toBe(true);
    expect(cguAindaSuspeito("valor_final_truncado_suspeito", 80, 500)).toBe(false);
  });

  it("valor_corrigido_listagem nunca é reaberto", () => {
    expect(cguAindaSuspeito("valor_corrigido_listagem", 1, 1)).toBe(false);
  });

  it("regra desconhecida: conservadora por default; a re-checagem manual decide pela API", () => {
    expect(cguAindaSuspeito("possivel_ponto_fixo", 80, 0)).toBe(true);
    expect(
      cguAindaSuspeito("possivel_ponto_fixo", 80, 0, { regraDesconhecidaContaComoSuspeita: false }),
    ).toBe(false);
  });
});
