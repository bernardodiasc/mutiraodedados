import { describe, expect, it } from "vitest";
import {
  LIMIARES_INVESTIGATIVOS,
  gapTemporalMeses,
  sinaisDoadorVirouFornecedor,
  sinaisEvolucaoPatrimonial,
  sinaisFornecedorConcentrado,
  type DoacaoFornecedorCruzada,
} from "./investigativos";
import { lacunasEleitoSemContas, lacunasSerieHistorica } from "./lacunas";
import { regrasQualidadeTse } from "./qualidade";

const cruzada: DoacaoFornecedorCruzada = {
  cnpj: "18035283000172",
  cnpjFormatado: "18.035.283/0001-72",
  nomeDoador: "V. L. DE SOUZA - ME",
  nomeFornecedor: "V. L. DE SOUZA - ME",
  sqCandidato: "10001642313",
  anoEleicao: 2022,
  valorDoado: 50_000,
  dataDoacao: "2022-09-01",
  parlamentarTipo: "deputado",
  parlamentarId: "204500",
  contratos: [
    { id: "123", valor: 900_000, dataAssinatura: "2023-03-10" },
    { id: "456", valor: 100_000, dataAssinatura: "2022-12-01" },
  ],
};

describe("doador_virou_fornecedor", () => {
  it("gera sinal com detalhes exigidos pelo plano", () => {
    const [f] = sinaisDoadorVirouFornecedor([cruzada]);
    expect(f.regra).toBe("doador_virou_fornecedor");
    expect(f.detalhes).toMatchObject({
      sq_candidato: "10001642313",
      ano_eleicao: 2022,
      valor_doado: 50_000,
      valor_contrato: 900_000,
      gap_temporal_meses: 6,
    });
  });

  it("aplica o threshold de R$ 1.000 (corta ruído simbólico)", () => {
    expect(sinaisDoadorVirouFornecedor([{ ...cruzada, valorDoado: 999.99 }])).toHaveLength(0);
    expect(LIMIARES_INVESTIGATIVOS.doacaoMinima).toBe(1000);
  });

  it("sem contratos, sem sinal", () => {
    expect(sinaisDoadorVirouFornecedor([{ ...cruzada, contratos: [] }])).toHaveLength(0);
  });

  it("deduplica por (cnpj, candidato, ano)", () => {
    expect(sinaisDoadorVirouFornecedor([cruzada, cruzada])).toHaveLength(1);
  });
});

describe("gapTemporalMeses", () => {
  it("meses entre doação e contrato", () => {
    expect(gapTemporalMeses("2022-09-01", "2023-03-10")).toBe(6);
    expect(gapTemporalMeses("2022-09-01", "2022-06-01")).toBe(-3);
    expect(gapTemporalMeses(null, "2023-01-01")).toBeNull();
  });
});

describe("guarda de taxonomia — cruzamento NUNCA grava tipo='qualidade'", () => {
  it("todas as regras investigativas saem com tipo investigativo e fonte tse-cruzamento", () => {
    const todos = [
      ...sinaisDoadorVirouFornecedor([cruzada]),
      ...sinaisEvolucaoPatrimonial([
        {
          cpf: "12345678901",
          sqAnterior: "1",
          anoAnterior: 2018,
          bensAnterior: 100_000,
          sqRecente: "2",
          anoRecente: 2022,
          bensRecente: 2_000_000,
          nomeUrna: "FULANO",
          uf: "AC",
        },
      ]),
      ...sinaisFornecedorConcentrado([
        {
          cnpjFornecedor: "18035283000172",
          nomeFornecedor: "GRÁFICA",
          partido: "XX",
          uf: "AC",
          ano: 2022,
          candidatos: 20,
          totalFornecedor: 800_000,
          totalGrupo: 1_000_000,
          fracao: 0.8,
        },
      ]),
    ];
    expect(todos.length).toBeGreaterThan(0);
    for (const f of todos) {
      expect(f.tipo).toBe("investigativo");
      expect(f.fonte).toBe("tse-cruzamento");
      expect(f.severidade).toBe("aviso");
    }
  });

  it("regras de qualidade nunca saem como investigativo", () => {
    const findings = regrasQualidadeTse(
      "receitas",
      [
        {
          id: "2022-1",
          sq_candidato: "1",
          ano_eleicao: 2022,
          cpf_cnpj_doador: "11111111111", // DV inválido
          nome_doador: "X",
          tipo_doador: "pf",
          cnpj_doador_originario: null,
          valor: -10,
          data: "2010-01-01",
          tipo_receita: "x",
          forma_recebimento: null,
          uf: "AC",
        },
      ],
      2022,
    );
    expect(findings.length).toBeGreaterThan(0);
    for (const f of findings) expect(f.tipo).toBe("qualidade");
  });
});

describe("lacunas — distinção origem × importação", () => {
  it("eleito sem contas: API sem gasto = lacuna; API com gasto = qualidade (reimportar)", () => {
    const [origem] = lacunasEleitoSemContas([
      {
        sqCandidato: "1",
        ano: 2022,
        uf: "AC",
        nomeUrna: "A",
        cargoNome: "Senador",
        gastoNaApi: null,
      },
    ]);
    expect(origem.tipo).toBe("lacuna");
    const [nossa] = lacunasEleitoSemContas([
      {
        sqCandidato: "2",
        ano: 2022,
        uf: "AC",
        nomeUrna: "B",
        cargoNome: "Senador",
        gastoNaApi: 150000,
      },
    ]);
    expect(nossa.tipo).toBe("qualidade");
    expect(nossa.detalhes?.causa).toBe("importacao_incompleta");
  });

  it("série histórica: varredura incompleta = qualidade; completa e vazia = lacuna", () => {
    const findings = lacunasSerieHistorica([
      { ano: 2022, uf: "AC", candidatos: 500, varreduraCompleta: true, varreduraIniciada: true },
      { ano: 2022, uf: "SP", candidatos: 0, varreduraCompleta: false, varreduraIniciada: true },
      { ano: 2022, uf: "RR", candidatos: 0, varreduraCompleta: true, varreduraIniciada: true },
    ]);
    expect(findings).toHaveLength(2);
    expect(findings.find((f) => f.entidade_id.endsWith("SP"))?.tipo).toBe("qualidade");
    expect(findings.find((f) => f.entidade_id.endsWith("RR"))?.tipo).toBe("lacuna");
  });
});
