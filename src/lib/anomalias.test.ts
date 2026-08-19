import { describe, expect, it } from "vitest";
import { detectarAnomalias, tetoDispensaNaData, TETOS_DISPENSA } from "@/lib/anomalias";
import type { Contrato } from "@/lib/data/types";
import type { Dataset } from "@/lib/data/source";

let seq = 0;
function contrato(sobre: Partial<Contrato>): Contrato {
  seq += 1;
  return {
    id: `c${seq}`,
    orgaoCod: "26000",
    fornecedorCnpj: "00000000000191",
    objeto: "Aquisição de equipamentos de informática para o laboratório central",
    modalidade: "pregao",
    valor: 100_000,
    ano: 2023,
    dataAssinatura: "2023-03-10",
    ...sobre,
  };
}

function dataset(contratos: Contrato[]): Dataset {
  return {
    contratos,
    fornecedores: [{ cnpj: "00000000000191", nome: "Fornecedor Teste" }] as Dataset["fornecedores"],
    orgaos: [{ cod: "26000", sigla: "MEC", nome: "Ministério da Educação" }] as Dataset["orgaos"],
  };
}

function regras(ds: Dataset, regra: string) {
  return detectarAnomalias(ds).filter((a) => a.regra === regra);
}

describe("tetoDispensaNaData (teto vigente na data do registro)", () => {
  it("aplica o teto da época correta", () => {
    expect(tetoDispensaNaData("2015-05-01").teto).toBe(8_000);
    expect(tetoDispensaNaData("2018-06-18").teto).toBe(8_000);
    expect(tetoDispensaNaData("2018-06-19").teto).toBe(17_600);
    expect(tetoDispensaNaData("2021-03-31").teto).toBe(17_600);
    expect(tetoDispensaNaData("2021-04-01").teto).toBe(50_000);
    expect(tetoDispensaNaData("2022-06-01").teto).toBe(54_020.41);
    // Data futura: vale o último teto conhecido (conservador).
    expect(tetoDispensaNaData("2030-01-01").teto).toBe(TETOS_DISPENSA.at(-1)!.teto);
  });
});

describe("crescimento_abrupto", () => {
  it("dispara para salto ≥3× entre anos CONSECUTIVOS com base ≥ R$ 500k", () => {
    const ds = dataset([
      contrato({ ano: 2022, dataAssinatura: "2022-03-01", valor: 600_000 }),
      contrato({ ano: 2023, dataAssinatura: "2023-03-01", valor: 1_800_000 }),
    ]);
    const [a] = regras(ds, "crescimento_abrupto");
    expect(a).toBeDefined();
    expect(a.severidade).toBe("media");
    expect(a.evidencia).toMatchObject({ ano_anterior: 2022, ano: 2023 });
  });

  it("salto ≥6× vira severidade alta", () => {
    const ds = dataset([
      contrato({ ano: 2022, valor: 600_000 }),
      contrato({ ano: 2023, valor: 4_000_000 }),
    ]);
    expect(regras(ds, "crescimento_abrupto")[0]?.severidade).toBe("alta");
  });

  it("NÃO compara anos com lacuna na série (2019 → 2023)", () => {
    const ds = dataset([
      contrato({ ano: 2019, dataAssinatura: "2019-03-01", valor: 600_000 }),
      contrato({ ano: 2023, dataAssinatura: "2023-03-01", valor: 6_000_000 }),
    ]);
    expect(regras(ds, "crescimento_abrupto")).toHaveLength(0);
  });

  it("não dispara com base abaixo de R$ 500k", () => {
    const ds = dataset([
      contrato({ ano: 2022, valor: 100_000 }),
      contrato({ ano: 2023, valor: 900_000 }),
    ]);
    expect(regras(ds, "crescimento_abrupto")).toHaveLength(0);
  });
});

describe("fracionamento (teto por data)", () => {
  const dispensas = (n: number, valor: number, ano: number, data: string) =>
    Array.from({ length: n }, () =>
      contrato({ modalidade: "dispensa", valor, ano, dataAssinatura: data }),
    );

  it("dispara com 5 dispensas abaixo do teto da época (2019: R$ 17.600)", () => {
    const ds = dataset(dispensas(5, 15_000, 2019, "2019-05-01"));
    const [a] = regras(ds, "fracionamento");
    expect(a).toBeDefined();
    expect(a.evidencia).toMatchObject({
      teto: 17_600,
      base_legal: "Decreto 9.412/2018 (Lei 8.666)",
    });
  });

  it("dispensas de R$ 45 mil em 2019 NÃO disparam (acima do teto da época)…", () => {
    const ds = dataset(dispensas(5, 45_000, 2019, "2019-05-01"));
    expect(regras(ds, "fracionamento")).toHaveLength(0);
  });

  it("…mas as mesmas dispensas em 2022 disparam (teto Lei 14.133 atualizado)", () => {
    const ds = dataset(dispensas(5, 45_000, 2022, "2022-05-01"));
    const [a] = regras(ds, "fracionamento");
    expect(a).toBeDefined();
    expect(a.evidencia).toMatchObject({ teto: 54_020.41 });
  });

  it("4 dispensas não bastam", () => {
    const ds = dataset(dispensas(4, 15_000, 2019, "2019-05-01"));
    expect(regras(ds, "fracionamento")).toHaveLength(0);
  });

  it("dispensa sem data usa o meio do ano como referência", () => {
    const ds = dataset(dispensas(5, 15_000, 2019, ""));
    expect(regras(ds, "fracionamento")).toHaveLength(1);
  });
});

describe("concentracao", () => {
  it("dispara quando um fornecedor passa de 60% do gasto do órgão (total > R$ 2M)", () => {
    const ds = dataset([
      contrato({ fornecedorCnpj: "00000000000191", valor: 2_100_000 }),
      contrato({ fornecedorCnpj: "99999999999999", valor: 900_000 }),
    ]);
    const [a] = regras(ds, "concentracao");
    expect(a).toBeDefined();
    expect(a.severidade).toBe("media");
  });

  it("acima de 80% vira alta; abaixo do volume mínimo não dispara", () => {
    const alta = dataset([
      contrato({ fornecedorCnpj: "00000000000191", valor: 2_600_000 }),
      contrato({ fornecedorCnpj: "99999999999999", valor: 200_000 }),
    ]);
    expect(regras(alta, "concentracao")[0]?.severidade).toBe("alta");

    const pequeno = dataset([contrato({ fornecedorCnpj: "00000000000191", valor: 1_500_000 })]);
    expect(regras(pequeno, "concentracao")).toHaveLength(0);
  });
});

describe("outlier_valor", () => {
  it("não roda com amostra de até 5 contratos", () => {
    const ds = dataset([
      contrato({ valor: 100 }),
      contrato({ valor: 100 }),
      contrato({ valor: 100 }),
      contrato({ valor: 100 }),
      contrato({ valor: 1_000_000_000 }),
    ]);
    expect(regras(ds, "outlier_valor")).toHaveLength(0);
  });

  it("dispara para valor ≥ 3 desvios-padrão acima da média", () => {
    const base = Array.from({ length: 20 }, () => contrato({ valor: 100_000 }));
    const ds = dataset([...base, contrato({ id: "outlier", valor: 5_000_000 })]);
    const achados = regras(ds, "outlier_valor");
    expect(achados).toHaveLength(1);
    expect(achados[0].entidadeId).toBe("outlier");
  });
});

describe("fornecedor_recente_alto", () => {
  it("dispara para fornecedor cuja 1ª aparição é recente com contrato ≥ R$ 1M", () => {
    const ds = dataset([
      contrato({ dataAssinatura: "2023-01-10", valor: 50_000 }),
      contrato({ dataAssinatura: "2023-06-10", valor: 1_500_000 }),
    ]);
    expect(regras(ds, "fornecedor_recente_alto")).toHaveLength(1);
  });

  it("não dispara quando a 1ª aparição é antiga", () => {
    const ds = dataset([
      contrato({ ano: 2019, dataAssinatura: "2019-01-10", valor: 50_000 }),
      contrato({ ano: 2023, dataAssinatura: "2023-06-10", valor: 1_500_000 }),
    ]);
    expect(regras(ds, "fornecedor_recente_alto")).toHaveLength(0);
  });

  it("data de assinatura vazia não silencia a regra (bug do NaN corrigido)", () => {
    const ds = dataset([
      contrato({ dataAssinatura: "", valor: 50_000 }),
      contrato({ dataAssinatura: "2023-06-10", valor: 1_500_000 }),
    ]);
    // Antes: "" virava a 1ª aparição → new Date("") → NaN → regra nunca disparava.
    expect(regras(ds, "fornecedor_recente_alto")).toHaveLength(1);
  });
});

describe("descricao_generica", () => {
  it("dispara para objeto curto ou termo-bandeira com valor ≥ R$ 200k", () => {
    const curto = dataset([contrato({ objeto: "Serviços", valor: 300_000 })]);
    expect(regras(curto, "descricao_generica")).toHaveLength(1);

    const bandeira = dataset([
      contrato({
        objeto: "Contratação de apoio operacional para as unidades descentralizadas",
        valor: 300_000,
      }),
    ]);
    expect(regras(bandeira, "descricao_generica")).toHaveLength(1);
  });

  it("não dispara para objeto específico ou valor baixo", () => {
    const ok = dataset([contrato({ valor: 300_000 })]);
    expect(regras(ok, "descricao_generica")).toHaveLength(0);
    const barato = dataset([contrato({ objeto: "Serviços", valor: 100_000 })]);
    expect(regras(barato, "descricao_generica")).toHaveLength(0);
  });
});

describe("dispensa_recorrente", () => {
  const tres = (ano: number) =>
    Array.from({ length: 3 }, () =>
      contrato({ modalidade: "dispensa", ano, dataAssinatura: `${ano}-04-01`, valor: 5_000 }),
    );

  it("dispara com ≥3 dispensas/ano em 2 anos consecutivos", () => {
    const ds = dataset([...tres(2022), ...tres(2023)]);
    expect(regras(ds, "dispensa_recorrente")).toHaveLength(1);
  });

  it("anos não consecutivos não disparam", () => {
    const ds = dataset([...tres(2020), ...tres(2023)]);
    expect(regras(ds, "dispensa_recorrente")).toHaveLength(0);
  });
});

describe("crescimento_orgao", () => {
  it("dispara quando o gasto anual ≥ 2× a mediana dos 3 anos anteriores com dados", () => {
    const ds = dataset([
      contrato({ ano: 2020, dataAssinatura: "2020-03-01", valor: 1_000_000 }),
      contrato({ ano: 2021, dataAssinatura: "2021-03-01", valor: 1_200_000 }),
      contrato({ ano: 2022, dataAssinatura: "2022-03-01", valor: 1_400_000 }),
      contrato({ ano: 2023, dataAssinatura: "2023-03-01", valor: 3_000_000 }),
    ]);
    const [a] = regras(ds, "crescimento_orgao");
    expect(a).toBeDefined();
    expect(a.evidencia).toMatchObject({ ano: 2023, baseline: 1_200_000 });
  });

  it("não dispara com baseline abaixo de R$ 1M", () => {
    const ds = dataset([
      contrato({ ano: 2020, valor: 100_000 }),
      contrato({ ano: 2021, valor: 120_000 }),
      contrato({ ano: 2022, valor: 140_000 }),
      contrato({ ano: 2023, valor: 400_000 }),
    ]);
    expect(regras(ds, "crescimento_orgao")).toHaveLength(0);
  });
});

describe("transparencia_baixa", () => {
  it("não dispara para órgão com volume abaixo de R$ 5M", () => {
    const ds = dataset([contrato({ valor: 1_000_000 })]);
    expect(regras(ds, "transparencia_baixa")).toHaveLength(0);
  });
});
