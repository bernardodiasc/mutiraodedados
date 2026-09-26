import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Importação de bens retomada em duas rodadas: o total declarado de cada
// candidato (tse_candidatos_cache.bens_total_declarado) tem de refletir TODOS
// os bens dele, mesmo quando o corte de tempo cai no meio da lista.
//
// Banco em memória (só o que a ingestão usa) e arquivo do CDN simulado; o
// relógio é controlado para forçar o corte numa linha conhecida.
// ---------------------------------------------------------------------------

type Linha = Record<string, unknown>;
const CHAVES: Record<string, string[]> = {
  tse_varredura: ["chave"],
  tse_bens_candidato_cache: ["sq_candidato", "ano_eleicao", "ordem_bem"],
  tse_candidatos_cache: ["sq_candidato", "ano_eleicao"],
};
const banco = new Map<string, Linha[]>();
const tabela = (nome: string) => {
  if (!banco.has(nome)) banco.set(nome, []);
  return banco.get(nome)!;
};

function consulta(nome: string) {
  const filtros: Array<(l: Linha) => boolean> = [];
  let faixa: [number, number] | null = null;
  let patch: Linha | null = null;
  const resultado = () => {
    const linhas = tabela(nome).filter((l) => filtros.every((f) => f(l)));
    if (patch) {
      for (const l of linhas) Object.assign(l, patch);
      return { data: null, error: null };
    }
    return { data: faixa ? linhas.slice(faixa[0], faixa[1] + 1) : linhas, error: null };
  };
  const q = {
    select: () => q,
    eq: (col: string, v: unknown) => (filtros.push((l) => l[col] === v), q),
    in: (col: string, vs: unknown[]) => (filtros.push((l) => vs.includes(l[col])), q),
    gt: (col: string, v: number) => (filtros.push((l) => Number(l[col]) > v), q),
    order: () => q,
    range: (de: number, ate: number) => ((faixa = [de, ate]), q),
    update: (p: Linha) => ((patch = p), q),
    maybeSingle: async () => ({ data: resultado().data?.[0] ?? null, error: null }),
    then: (ok: (r: unknown) => unknown, falha?: (e: unknown) => unknown) =>
      Promise.resolve(resultado()).then(ok, falha),
    upsert: async (payload: Linha | Linha[]) => {
      const chave = CHAVES[nome];
      for (const nova of Array.isArray(payload) ? payload : [payload]) {
        const linhas = tabela(nome);
        const i = linhas.findIndex((l) => chave.every((c) => l[c] === nova[c]));
        if (i >= 0) linhas[i] = { ...linhas[i], ...nova };
        else linhas.push({ ...nova });
      }
      return { error: null };
    },
    insert: async (payload: Linha) => (tabela(nome).push(payload), { error: null }),
  };
  return q;
}

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from: (nome: string) => consulta(nome) },
}));
vi.mock("@/lib/data/qa", () => ({ flagQA: async () => 0 }));

// Arquivo simulado: cabeçalho + linhas de dados. `cortarAntesDaLinha` faz o
// relógio pular o orçamento quando a leitura chega nessa linha de dados.
const CABECALHO = [
  "ANO_ELEICAO",
  "SQ_CANDIDATO",
  "NR_ORDEM_BEM_CANDIDATO",
  "CD_TIPO_BEM_CANDIDATO",
  "DS_TIPO_BEM_CANDIDATO",
  "DS_BEM_CANDIDATO",
  "VR_BEM_CANDIDATO",
];
let linhasArquivo: string[][] = [];
let cortarAntesDaLinha: number | null = null;
let relogio = 0;

vi.mock("@/lib/data/ckan/client", () => ({
  listarEntradasZip: async () => [],
  encontrarEntrada: () => ({ nome: "bem_candidato_2022_AC.csv" }),
  abrirEntradaZip: async () => null,
  lerLinhasCsv: async function* () {
    yield CABECALHO;
    for (let i = 0; i < linhasArquivo.length; i++) {
      if (cortarAntesDaLinha === i + 1) relogio += 1_000_000;
      yield linhasArquivo[i];
    }
  },
}));

vi.spyOn(Date, "now").mockImplementation(() => relogio);

const { sincronizarArquivoTse } = await import("@/lib/data/tse/ingest.server");

const bem = (sq: string, ordem: number, valor: string) => [
  "2022",
  sq,
  String(ordem),
  "12",
  "Casa",
  "descrição",
  valor,
];

const rodada = () =>
  sincronizarArquivoTse({ tipo: "bens", ano: 2022, uf: "AC", userId: "u1", orcamentoMs: 1000 });

const totalDe = (sq: string) =>
  tabela("tse_candidatos_cache").find((c) => c.sq_candidato === sq)?.bens_total_declarado;

beforeEach(() => {
  banco.clear();
  relogio = 0;
  cortarAntesDaLinha = null;
  tabela("tse_candidatos_cache").push(
    { sq_candidato: "100", ano_eleicao: 2022, bens_total_declarado: null },
    { sq_candidato: "200", ano_eleicao: 2022, bens_total_declarado: null },
  );
  linhasArquivo = [
    bem("100", 1, "100,00"),
    bem("100", 2, "200,00"),
    bem("100", 3, "300,00"),
    bem("200", 1, "50,00"),
  ];
});

describe("importação de bens retomada", () => {
  it("em duas rodadas com o corte no meio dos bens de um candidato, o total soma todos os bens", async () => {
    cortarAntesDaLinha = 3;
    const primeira = await rodada();
    expect(primeira.haMais).toBe(true);

    relogio = 0;
    cortarAntesDaLinha = null;
    const segunda = await rodada();
    expect(segunda.completa).toBe(true);

    expect(tabela("tse_bens_candidato_cache")).toHaveLength(4);
    expect(totalDe("100")).toBe(600);
    expect(totalDe("200")).toBe(50);
  });

  it("reprocessar a mesma rodada não duplica o total", async () => {
    await rodada();
    await sincronizarArquivoTse({
      tipo: "bens",
      ano: 2022,
      uf: "AC",
      userId: "u1",
      orcamentoMs: 1000,
      reprocessar: true,
    });
    expect(totalDe("100")).toBe(600);
    expect(totalDe("200")).toBe(50);
  });
});
