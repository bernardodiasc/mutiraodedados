import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { lerLinhasCsv } from "@/lib/data/ckan/client";
import {
  IndiceCabecalho,
  classificarTipoDoador,
  hashDedup,
  limparSentinela,
  mapearBem,
  mapearCandidato,
  mapearDespesa,
  mapearReceita,
  mapearResultado,
  normalizarChaveCabecalho,
  parseDataTse,
  parseValorTse,
} from "./parsers";

const FIXTURES = join(__dirname, "__fixtures__");

function streamDeArquivo(nome: string): ReadableStream<Uint8Array> {
  const bytes = new Uint8Array(readFileSync(join(FIXTURES, nome)));
  return new ReadableStream({
    start(c) {
      c.enqueue(bytes);
      c.close();
    },
  });
}

async function linhasDe(nome: string): Promise<string[][]> {
  const out: string[][] = [];
  for await (const l of lerLinhasCsv(streamDeArquivo(nome))) out.push(l);
  return out;
}

describe("primitivos", () => {
  it("limparSentinela cobre as sentinelas reais", () => {
    for (const s of ["#NULO#", "#NULO", "#NE", "-1", "-3", "-4", "NÃO DIVULGÁVEL", ""]) {
      expect(limparSentinela(s)).toBe("");
    }
    expect(limparSentinela(" PP ")).toBe("PP");
  });

  it("parseValorTse: vírgula decimal e inteiro", () => {
    expect(parseValorTse("1500,00")).toBe(1500);
    expect(parseValorTse("162")).toBe(162);
    expect(parseValorTse("1.234.567,89")).toBe(1234567.89);
    expect(parseValorTse("#NULO#")).toBeNull();
  });

  it("parseValorTse: decimal americano não é multiplicado por 100/1000", () => {
    // Antes: "3000.00" virava 300000 (todos os pontos eram removidos).
    expect(parseValorTse("3000.00")).toBe(3000);
    expect(parseValorTse("1234.56")).toBe(1234.56);
    // Milhar pt-BR inequívoco continua lido como milhar.
    expect(parseValorTse("1.234.567")).toBe(1234567);
    // Grupo único ".ddd" segue a convenção pt-BR do CSV do TSE.
    expect(parseValorTse("1.500")).toBe(1500);
    // Negativo (aparece em retificações).
    expect(parseValorTse("-1.500,00")).toBe(-1500);
  });

  it("parseDataTse: BR normal e o formato colado de 2014", () => {
    expect(parseDataTse("05/10/2014")).toBe("2014-10-05");
    expect(parseDataTse("10/10/201400:00:00")).toBe("2014-10-10");
    expect(parseDataTse("#NULO")).toBeNull();
    expect(parseDataTse("99/99/2014")).toBeNull();
  });

  it("normalizarChaveCabecalho: espaços duplos, acentos e pontuação", () => {
    expect(normalizarChaveCabecalho("Sigla  Partido")).toBe("SIGLA_PARTIDO");
    expect(normalizarChaveCabecalho("CPF/CNPJ do doador")).toBe("CPF_CNPJ_DO_DOADOR");
    expect(normalizarChaveCabecalho("Descriçao da despesa")).toBe("DESCRICAO_DA_DESPESA");
    expect(normalizarChaveCabecalho("Número partido doador")).toBe("NUMERO_PARTIDO_DOADOR");
  });

  it("hashDedup é determinístico e sensível ao conteúdo", () => {
    const a = hashDedup(["1", 2014, "2014-10-10", "123", 50]);
    expect(a).toBe(hashDedup(["1", 2014, "2014-10-10", "123", 50]));
    expect(a).not.toBe(hashDedup(["1", 2014, "2014-10-10", "123", 51]));
  });

  it("classificarTipoDoador", () => {
    expect(classificarTipoDoador("Recursos de pessoas físicas", "50890034249")).toBe("pf");
    expect(classificarTipoDoador("Recursos de outros candidatos", "20614471000105")).toBe("pj");
    expect(classificarTipoDoador("Recursos de partido político", "00887169000105")).toBe("partido");
    expect(classificarTipoDoador("FUNDO ESPECIAL", "")).toBe("fundo");
    expect(classificarTipoDoador("Recursos próprios", "123")).toBe("proprio");
  });
});

describe("candidatos — fixtures reais de todos os anos", () => {
  for (const ano of [2014, 2016, 2018, 2020, 2022, 2024]) {
    it(`consulta_cand ${ano}`, async () => {
      const linhas = await linhasDe(`consulta_cand_${ano}_AC.csv`);
      const idx = new IndiceCabecalho(linhas[0]);
      const rows = linhas.slice(1).map((c) => mapearCandidato(idx, c));
      expect(rows.length).toBeGreaterThan(0);
      for (const r of rows) {
        expect(r).not.toBeNull();
        expect(r!.ano_eleicao).toBe(ano);
        expect(r!.uf).toBe("AC");
        expect(r!.sq_candidato).toMatch(/^\d+$/);
        expect(r!.cargo_nome).toBeTruthy();
        // sentinela nunca vaza para campo normalizado
        for (const v of Object.values(r!)) {
          if (typeof v === "string") expect(v).not.toMatch(/#NULO|#NE|NÃO DIVULG/);
        }
      }
    });
  }
});

describe("bens — variações de cabeçalho 2016 × demais", () => {
  for (const ano of [2016, 2022]) {
    it(`bem_candidato ${ano}`, async () => {
      const linhas = await linhasDe(`bem_candidato_${ano}_AC.csv`);
      const idx = new IndiceCabecalho(linhas[0]);
      const rows = linhas.slice(1).map((c) => mapearBem(idx, c));
      expect(rows.length).toBeGreaterThan(0);
      for (const r of rows) {
        expect(r).not.toBeNull();
        expect(r!.ano_eleicao).toBe(ano);
        expect(r!.valor).toBeGreaterThan(0);
        expect(r!.ordem_bem).toBeGreaterThan(0);
        // CD_TIPO_BEM_CANDIDATO existe nos dois layouts (2016 com aspas, 2022 sem).
        expect(r!.tipo_bem_cod).toMatch(/^\d{1,2}$/);
      }
    });
  }

  it("guarda o código do tipo de bem junto da descrição", async () => {
    const linhas = await linhasDe("bem_candidato_2022_AC.csv");
    const idx = new IndiceCabecalho(linhas[0]);
    const rows = linhas.slice(1).map((c) => mapearBem(idx, c)!);
    const casa = rows.find((r) => r.tipo_bem === "Casa");
    expect(casa?.tipo_bem_cod).toBe("12");
    const veiculo = rows.find((r) => r.tipo_bem?.startsWith("Veículo automotor terrestre"));
    expect(veiculo?.tipo_bem_cod).toBe("21");
  });
});

describe("resultados por município/zona", () => {
  it("votacao_candidato_munzona 2022", async () => {
    const linhas = await linhasDe("votacao_candidato_munzona_2022_AC.csv");
    const idx = new IndiceCabecalho(linhas[0]);
    const rows = linhas.slice(1).map((c) => mapearResultado(idx, c));
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r).not.toBeNull();
      expect(r!.uf).toBe("AC");
      expect(r!.municipio_cod).toMatch(/^\d+$/);
      expect(r!.votos_nominais).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("receitas — layout legado (2014/2016) e moderno (2022)", () => {
  it("2014 (legado, .txt)", async () => {
    const linhas = await linhasDe("receitas_candidatos_2014_AC.txt");
    const idx = new IndiceCabecalho(linhas[0]);
    const rows = linhas.slice(1).map((c) => mapearReceita(idx, c, 2014));
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r).not.toBeNull();
      expect(r!.ano_eleicao).toBe(2014);
      expect(r!.id).toMatch(/^2014-[0-9a-f]{16}$/);
      expect(r!.valor).toBeGreaterThan(0);
      expect(r!.sq_candidato).toMatch(/^\d+$/);
    }
  });

  it("2016 (legado com colunas extras)", async () => {
    const linhas = await linhasDe("receitas_candidatos_2016_AC.txt");
    const idx = new IndiceCabecalho(linhas[0]);
    const rows = linhas.slice(1).map((c) => mapearReceita(idx, c, 2016));
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r).not.toBeNull();
      expect(r!.ano_eleicao).toBe(2016);
    }
  });

  it("2022 (moderno, SQ_RECEITA como id natural)", async () => {
    const linhas = await linhasDe("receitas_candidatos_2022_AC.csv");
    const idx = new IndiceCabecalho(linhas[0]);
    const rows = linhas.slice(1).map((c) => mapearReceita(idx, c, 2022));
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r).not.toBeNull();
      expect(r!.id).toMatch(/^2022-\d+$/);
      expect(r!.valor).toBeGreaterThan(0);
      expect(r!.data).toMatch(/^2022-/);
      expect(r!.tipo_doador).toBeTruthy();
    }
  });
});

describe("despesas — layout legado (2014) e moderno (2022)", () => {
  it("2014 (legado, com o typo real 'Descriçao da despesa')", async () => {
    const linhas = await linhasDe("despesas_candidatos_2014_AC.txt");
    const idx = new IndiceCabecalho(linhas[0]);
    const rows = linhas.slice(1).map((c) => mapearDespesa(idx, c, 2014));
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r).not.toBeNull();
      expect(r!.id).toMatch(/^2014-[0-9a-f]{16}$/);
      expect(r!.valor).toBeGreaterThan(0);
      expect(r!.descricao).toBeTruthy();
    }
  });

  it("2022 (moderno, despesas_contratadas)", async () => {
    const linhas = await linhasDe("despesas_contratadas_candidatos_2022_AC.csv");
    const idx = new IndiceCabecalho(linhas[0]);
    const rows = linhas.slice(1).map((c) => mapearDespesa(idx, c, 2022));
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r).not.toBeNull();
      expect(r!.id).toMatch(/^2022-\d+$/);
      expect(r!.cnpj_fornecedor).toBeTruthy();
      expect(r!.valor).toBeGreaterThan(0);
    }
  });
});
