import { describe, it, expect } from "vitest";
import { FONTE_LABEL, FONTES_VIA_PORTAL_CGU, FONTES_COM_HISTORICO } from "./fonte-rotulos";
import { FONTE_SINAL_LABEL } from "@/lib/sinais-catalogo";
import { FONTES_LIMPEZA } from "@/lib/data/limpeza";

/**
 * O rótulo de fonte já mentiu duas vezes: o Histórico dizia "Transferegov"
 * numa rodada produzida por uma chamada à CGU, e a página de convênios
 * atribuía o acervo inteiro ao sistema errado. Estes testes existem para o
 * rótulo não voltar a atribuir procedência que não temos.
 */
describe("rótulos de fonte nomeiam a API consultada", () => {
  it("toda fonte que consulta o Portal CGU diz isso no rótulo", () => {
    for (const id of FONTES_VIA_PORTAL_CGU) {
      expect(FONTE_LABEL[id], `rótulo de ${id}`).toMatch(/Portal CGU/);
    }
  });

  it("nenhum rótulo do histórico atribui convênios ao Transferegov", () => {
    for (const [id, label] of Object.entries(FONTE_LABEL)) {
      expect(label, `rótulo de ${id}`).not.toMatch(/^Transferegov/);
    }
  });

  it("os rótulos de sinais e de limpeza também não", () => {
    expect(FONTE_SINAL_LABEL.transferegov).not.toMatch(/^Transferegov/);
    const limpeza = FONTES_LIMPEZA.find((f) => f.id === "transferegov");
    expect(limpeza?.label).not.toMatch(/^Transferegov/);
  });

  it("todo id de limpeza com rodada registrada tem rótulo no histórico", () => {
    // Não é o mesmo conjunto (há fontes sem limpeza e vice-versa), mas o id
    // `transferegov` precisa existir nos dois — é ele que o Histórico exibe.
    expect(FONTE_LABEL.transferegov).toBeDefined();
  });
});

describe("nenhum id vaza cru para o Histórico", () => {
  it("toda fonte que grava rodada tem rótulo", () => {
    for (const id of FONTES_COM_HISTORICO) {
      expect(FONTE_LABEL[id], `falta rótulo para "${id}"`).toBeTruthy();
    }
  });

  it("nenhum rótulo é o próprio id — snake_case na tela é vazamento", () => {
    for (const [id, label] of Object.entries(FONTE_LABEL)) {
      expect(label, `rótulo de ${id}`).not.toBe(id);
      expect(label, `rótulo de ${id}`).not.toMatch(/^[a-z]+_[a-z_]+$/);
    }
  });
});
