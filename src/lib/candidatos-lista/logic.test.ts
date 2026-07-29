import { describe, expect, it } from "vitest";
import { classeSituacao, deriveEstado, paraItens } from "./logic";

describe("deriveEstado", () => {
  it("prioridade carregando > erro > pronto > vazio", () => {
    expect(deriveEstado({ carregando: true, temErro: true, temDados: true })).toBe("carregando");
    expect(deriveEstado({ carregando: false, temErro: true, temDados: true })).toBe("erro");
    expect(deriveEstado({ carregando: false, temErro: false, temDados: true })).toBe("pronto");
    expect(deriveEstado({ carregando: false, temErro: false, temDados: false })).toBe("vazio");
  });
});

describe("paraItens", () => {
  it("aplica fallbacks de nome e strings vazias", () => {
    const [item] = paraItens([
      {
        sq_candidato: "123",
        ano_eleicao: 2022,
        nome_urna: null,
        nome_completo: "MARIA DA SILVA",
        cargo_nome: null,
        uf: null,
        partido_sigla: null,
        numero_candidato: null,
        situacao_totalizacao: null,
        bens_total_declarado: null,
      },
    ]);
    expect(item.nomeUrna).toBe("MARIA DA SILVA");
    expect(item.cargo).toBe("");
    expect(item.bensTotal).toBeNull();
  });
});

describe("classeSituacao", () => {
  it("classifica eleito, não eleito/suplente e outros", () => {
    expect(classeSituacao("ELEITO POR MÉDIA")).toBe("eleito");
    expect(classeSituacao("Não eleito")).toBe("nao-eleito");
    expect(classeSituacao("SUPLENTE")).toBe("nao-eleito");
    expect(classeSituacao("#NE")).toBe("outro");
  });
});
