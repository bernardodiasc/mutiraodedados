import { describe, it, expect } from "vitest";
import {
  chaveVarreduraJanela,
  JANELA_ORCAMENTO_MS,
  JANELA_TETO_SUBREQUISICOES,
  JANELA_TETO_SUBREQUISICOES_COM_COTA,
} from "./janela-varredura";
import { rodarComOrcamento, type Checkpoint, type EstadoCheckpoint } from "./runner";

describe("janela-varredura/chave", () => {
  it("junta fonte e janela", () => {
    expect(chaveVarreduraJanela("pncp", "2024-01-01", "2024-01-31")).toBe(
      "pncp#2024-01-01#2024-01-31",
    );
  });

  it("filtros diferentes são varreduras diferentes", () => {
    const semFiltro = chaveVarreduraJanela("pncp", "2024-01-01", "2024-01-31");
    const comUf = chaveVarreduraJanela("pncp", "2024-01-01", "2024-01-31", { uf: "SP" });
    expect(comUf).not.toBe(semFiltro);
    expect(comUf).toBe("pncp#2024-01-01#2024-01-31#uf=SP");
  });

  it("a ordem em que os filtros foram montados não muda a chave", () => {
    const a = chaveVarreduraJanela("t", "2024-01-01", "2024-01-31", { uf: "SP", ibge: "3550308" });
    const b = chaveVarreduraJanela("t", "2024-01-01", "2024-01-31", { ibge: "3550308", uf: "SP" });
    expect(a).toBe(b);
  });

  it("filtro ausente ou vazio não entra na chave", () => {
    const base = chaveVarreduraJanela("pncp", "2024-01-01", "2024-01-31");
    expect(chaveVarreduraJanela("pncp", "2024-01-01", "2024-01-31", { uf: undefined })).toBe(base);
    expect(chaveVarreduraJanela("pncp", "2024-01-01", "2024-01-31", { uf: "" })).toBe(base);
    expect(chaveVarreduraJanela("pncp", "2024-01-01", "2024-01-31", { uf: null })).toBe(base);
  });

  it("janelas diferentes são varreduras diferentes", () => {
    expect(chaveVarreduraJanela("pncp", "2024-01-01", "2024-01-31")).not.toBe(
      chaveVarreduraJanela("pncp", "2024-02-01", "2024-02-29"),
    );
  });

  it("fontes diferentes não colidem na mesma janela", () => {
    expect(chaveVarreduraJanela("pncp", "2024-01-01", "2024-01-31")).not.toBe(
      chaveVarreduraJanela("transferegov", "2024-01-01", "2024-01-31"),
    );
  });
});

describe("janela-varredura/teto de subrequisições", () => {
  // Limite do Workers no plano pago: 10.000 subrequisições por invocação.
  const LIMITE_DO_WORKER = 10_000;

  it("fica a um décimo do limite do Worker, com folga para as gravações que o custo não conta", () => {
    // Checkpoint por passo, QA, Histórico e a linha por consulta do SICONFI
    // não entram no custo: mesmo triplicado, o teto cabe no limite.
    expect(JANELA_TETO_SUBREQUISICOES * 3).toBeLessThan(LIMITE_DO_WORKER);
  });

  it("fontes com cota por minuto na origem (PNCP, chave do Portal) mantêm o teto baixo", () => {
    expect(JANELA_TETO_SUBREQUISICOES_COM_COTA).toBe(45);
  });

  it("um mês cheio de votações da Câmara termina com folga dentro do teto de rodadas da ferramenta", async () => {
    // Agosto de 2026: mais de 420 votações. Cada uma custa ~3 subrequisições
    // (detalhe, votos, gravação da votação) mais o lote de votos; a lista do
    // mês custa 5 páginas no primeiro passo de cada rodada. ~0,4 s por
    // votação de relógio, medido na rodada real.
    const VOTACOES = 450;
    const PAGINAS_DA_LISTA = 5;
    const estado: { valor: EstadoCheckpoint | null } = { valor: null };
    const cp: Checkpoint = {
      ler: async () => estado.valor,
      salvar: async (_c, novo) => {
        estado.valor = { ...novo };
        return { persistido: true, erro: null };
      },
    };

    let rodadas = 0;
    let concluido = false;
    while (!concluido && rodadas < 30) {
      rodadas++;
      let t = 0;
      let primeiro = true;
      const r = await rodarComOrcamento({
        chave: "camara_vot#2026-08-01#2026-08-31",
        checkpoint: cp,
        orcamentoMs: JANELA_ORCAMENTO_MS,
        orcamentoCusto: JANELA_TETO_SUBREQUISICOES,
        maxPassos: 5000,
        agora: () => t,
        passo: async (cursor) => {
          t += 400;
          const lista = primeiro ? PAGINAS_DA_LISTA : 0;
          primeiro = false;
          if (cursor > VOTACOES) return { processados: 0, fim: true, custo: lista };
          return { processados: 1, fim: false, custo: lista + 4 };
        },
      });
      concluido = r.concluido;
    }

    expect(concluido).toBe(true);
    // Antes, com teto de 45, eram mais de 30 rodadas e a janela era reprovada.
    expect(rodadas).toBeLessThanOrEqual(3);
  });
});
