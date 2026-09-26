import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Cadastro dos senadores: cada rodada relê /senador/{cod}/mandatos e regrava
// exercícios, suplências e a situação de cada senador. Uma consulta que falha
// não pode apagar o que já estava gravado nem marcar o senador como "Nunca
// exerceu", e a falha precisa chegar ao log da rodada. Banco (em memória) e
// origem são mocks.
// ---------------------------------------------------------------------------
type Exercicio = { codigo_parlamentar: number; data_inicio: string | null };
type Suplencia = { titular_codigo: number; suplente_nome: string | null };

const exercicios: Exercicio[] = [];
const suplencias: Suplencia[] = [];
const situacoes = new Map<number, string>();
const inserirImportacoes = vi.fn(async (_linha: unknown) => null);

/** delete().in(coluna, ids) sobre uma tabela em memória. */
const tabelaApagavel = <T extends Record<string, unknown>>(linhas: T[], coluna: keyof T) => ({
  delete: () => ({
    in: async (_coluna: string, ids: number[]) => {
      for (let i = linhas.length - 1; i >= 0; i--)
        if (ids.includes(linhas[i][coluna] as number)) linhas.splice(i, 1);
      return { error: null };
    },
  }),
  insert: async (novas: T[]) => {
    linhas.push(...novas);
    return { error: null };
  },
});

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: vi.fn((tabela: string) => {
      if (tabela === "senado_senadores_cache") {
        return {
          upsert: async (linhas: Array<{ id: number; situacao: string }>) => {
            for (const l of linhas) situacoes.set(l.id, l.situacao);
            return { error: null };
          },
          update: ({ situacao }: { situacao: string }) => ({
            eq: async (_coluna: string, id: number) => {
              situacoes.set(id, situacao);
              return { error: null };
            },
          }),
        };
      }
      if (tabela === "senado_senador_legislaturas") {
        return { upsert: async () => ({ error: null }) };
      }
      if (tabela === "senado_exercicios") return tabelaApagavel(exercicios, "codigo_parlamentar");
      if (tabela === "senado_suplencia") return tabelaApagavel(suplencias, "titular_codigo");
      throw new Error(`tabela inesperada no teste: ${tabela}`);
    }),
  },
}));
vi.mock("@/lib/data/historico.server", () => ({
  inserirImportacoes,
  registrarRodadaImportacao: vi.fn(),
}));

const { rodadaCadastroSenado } = await import("./ingest.functions");

const lista = new Response(
  JSON.stringify({
    ListaParlamentarEmExercicio: {
      Parlamentares: {
        Parlamentar: [
          { IdentificacaoParlamentar: { CodigoParlamentar: 1, NomeParlamentar: "Um" } },
          { IdentificacaoParlamentar: { CodigoParlamentar: 2, NomeParlamentar: "Dois" } },
        ],
      },
    },
  }),
);

const mandatos = (inicio: string) =>
  new Response(
    JSON.stringify({
      MandatoParlamentar: {
        Parlamentar: {
          Mandatos: {
            Mandato: {
              PrimeiraLegislaturaDoMandato: { NumeroLegislatura: 57 },
              Exercicios: { Exercicio: { DataInicio: inicio } },
              Suplentes: { Suplente: { NomeParlamentar: `suplente novo ${inicio}` } },
            },
          },
        },
      },
    }),
  );

/** Origem: a lista atual, os mandatos do senador 1 e a resposta dada ao senador 2. */
const origem = (respostaDo2: () => Response) =>
  vi.fn(async (url: string) => {
    if (url.endsWith("/senador/lista/atual")) return lista.clone();
    if (url.includes("/senador/2/mandatos")) return respostaDo2();
    return mandatos("2023-02-01");
  });

beforeEach(() => {
  exercicios.splice(
    0,
    exercicios.length,
    { codigo_parlamentar: 1, data_inicio: "2019-02-01" },
    { codigo_parlamentar: 2, data_inicio: "2019-02-01" },
  );
  suplencias.splice(
    0,
    suplencias.length,
    { titular_codigo: 1, suplente_nome: "suplente antigo 1" },
    { titular_codigo: 2, suplente_nome: "suplente antigo 2" },
  );
  situacoes.clear();
  inserirImportacoes.mockClear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("cadastro do Senado", () => {
  it("falha da origem nos mandatos de um senador mantém exercícios, suplências e situação dele", async () => {
    vi.stubGlobal(
      "fetch",
      origem(() => new Response("", { status: 503 })),
    );
    const rodada = rodadaCadastroSenado(null);
    await vi.runAllTimersAsync();
    const r = await rodada;

    expect(exercicios).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ codigo_parlamentar: 1, data_inicio: "2023-02-01" }),
        expect.objectContaining({ codigo_parlamentar: 2, data_inicio: "2019-02-01" }),
      ]),
    );
    expect(exercicios).toHaveLength(2);
    expect(suplencias).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ titular_codigo: 1, suplente_nome: "suplente novo 2023-02-01" }),
        expect.objectContaining({ titular_codigo: 2, suplente_nome: "suplente antigo 2" }),
      ]),
    );
    expect(suplencias).toHaveLength(2);
    // A situação do senador 2 é a que a lista atual grava, não "Nunca exerceu".
    expect(situacoes.get(2)).toBe("Exercício");
    expect(r.erros).toEqual([expect.stringMatching(/^TRANSIENT: .*senador 2/)]);
    expect(r.origem).toBeNull();
    expect(inserirImportacoes).toHaveBeenCalledWith(
      expect.objectContaining({ fonte: "senado_senadores", resultado: "erro_origem" }),
    );
  });

  it("lista vazia da origem é resposta, não falha: apaga os exercícios do senador", async () => {
    vi.stubGlobal(
      "fetch",
      origem(() => new Response(JSON.stringify({ MandatoParlamentar: { Parlamentar: {} } }))),
    );
    const r = await rodadaCadastroSenado(null);

    expect(exercicios).toEqual([
      expect.objectContaining({ codigo_parlamentar: 1, data_inicio: "2023-02-01" }),
    ]);
    expect(suplencias).toEqual([expect.objectContaining({ titular_codigo: 1 })]);
    expect(situacoes.get(2)).toBe("Nunca exerceu");
    expect(r.erros).toEqual([]);
    expect(inserirImportacoes).toHaveBeenCalledWith(
      expect.objectContaining({ resultado: "com_dados", importados: 2 }),
    );
  });
});
