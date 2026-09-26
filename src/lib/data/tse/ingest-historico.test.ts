import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// A linha de rodada que a importação de um arquivo do TSE grava no Histórico:
// quem disparou (painel ou ferramenta, com a execução), o `resultado`
// classificado, o ano com `mes` 1 como âncora da janela anual — e o que
// acontece quando o arquivo não existe na origem ou a origem falha.
//
// Banco em memória (só o que a ingestão usa) e arquivo do CDN simulado.
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
  let patch: Linha | null = null;
  const resultado = () => {
    const linhas = tabela(nome).filter((l) => filtros.every((f) => f(l)));
    if (patch) {
      for (const l of linhas) Object.assign(l, patch);
      return { data: null, error: null };
    }
    return { data: linhas, error: null };
  };
  const q = {
    select: () => q,
    eq: (col: string, v: unknown) => (filtros.push((l) => l[col] === v), q),
    in: (col: string, vs: unknown[]) => (filtros.push((l) => vs.includes(l[col])), q),
    gt: (col: string, v: number) => (filtros.push((l) => Number(l[col]) > v), q),
    order: () => q,
    range: () => q,
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
    insert: async (payload: Linha | Linha[]) => {
      tabela(nome).push(...(Array.isArray(payload) ? payload : [payload]));
      return { error: null };
    },
  };
  return q;
}

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from: (nome: string) => consulta(nome) },
}));
vi.mock("@/lib/data/qa", () => ({ flagQA: async () => 0 }));

const CABECALHO = [
  "ANO_ELEICAO",
  "SQ_CANDIDATO",
  "NR_ORDEM_BEM_CANDIDATO",
  "CD_TIPO_BEM_CANDIDATO",
  "DS_TIPO_BEM_CANDIDATO",
  "DS_BEM_CANDIDATO",
  "VR_BEM_CANDIDATO",
];
const bem = (sq: string, ordem: number, valor: string) => [
  "2022",
  sq,
  String(ordem),
  "12",
  "Casa",
  "descrição",
  valor,
];
let linhasArquivo: string[][] = [];
let cortarAntesDaLinha: number | null = null;
let arquivoExiste = true;
let falhaAoListar: Error | null = null;
let relogio = 0;

vi.mock("@/lib/data/ckan/client", () => ({
  listarEntradasZip: async () => {
    if (falhaAoListar) throw falhaAoListar;
    return [];
  },
  encontrarEntrada: () => (arquivoExiste ? { nome: "bem_candidato_2022_AC.csv" } : null),
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

const EXECUCAO = "7d1f3c2a-9b8e-4f6d-a5c4-3b2a1f0e9d8c";
const pelaFerramenta = () =>
  sincronizarArquivoTse({
    tipo: "bens",
    ano: 2022,
    uf: "AC",
    userId: null,
    orcamentoMs: 1000,
    origem: { gatilho: "ferramenta", execucaoId: EXECUCAO },
  });
const historico = () => tabela("importacoes");

beforeEach(() => {
  banco.clear();
  relogio = 0;
  cortarAntesDaLinha = null;
  arquivoExiste = true;
  falhaAoListar = null;
  tabela("tse_candidatos_cache").push({ sq_candidato: "100", ano_eleicao: 2022 });
  linhasArquivo = [bem("100", 1, "100,00"), bem("100", 2, "200,00"), bem("100", 3, "300,00")];
});

describe("linha de rodada do TSE no Histórico", () => {
  it("pela ferramenta: sem operador, com gatilho, execução, resultado e a âncora da janela anual", async () => {
    const r = await pelaFerramenta();
    expect(r.haMais).toBe(false);
    expect(r.totalAcumulado).toBe(3);
    expect(historico()).toHaveLength(1);
    expect(historico()[0]).toMatchObject({
      fonte: "tse_bens",
      escopo: "2022-AC",
      ano: 2022,
      mes: 1,
      importados: 3,
      user_id: null,
      gatilho: "ferramenta",
      execucao_id: EXECUCAO,
      resultado: "com_dados",
    });
  });

  it("pelo painel: o operador e o gatilho painel, sem execução", async () => {
    await sincronizarArquivoTse({ tipo: "bens", ano: 2022, uf: "AC", userId: "u1" });
    expect(historico()[0]).toMatchObject({
      user_id: "u1",
      gatilho: "painel",
      execucao_id: null,
      resultado: "com_dados",
    });
  });

  it("rodada parcial: o aviso de retomada não conta como erro", async () => {
    cortarAntesDaLinha = 2;
    const r = await pelaFerramenta();
    expect(r.haMais).toBe(true);
    expect(historico()[0].resultado).toBe("com_dados");

    relogio = 0;
    cortarAntesDaLinha = null;
    const segunda = await pelaFerramenta();
    expect(segunda.haMais).toBe(false);
    expect(segunda.totalAcumulado).toBe(3);
  });

  it("arquivo ausente na origem: completa, sem dados, e a ausência vai como aviso", async () => {
    arquivoExiste = false;
    const r = await pelaFerramenta();
    expect(r).toMatchObject({ haMais: false, completa: true, importados: 0 });
    const linha = historico()[0];
    expect(linha.resultado).toBe("sem_dados");
    expect((linha.erros as string[]).every((e) => e.startsWith("info:"))).toBe(true);
  });

  it("falha passageira da origem: grava a rodada com erro da origem e não marca a janela completa", async () => {
    falhaAoListar = new Error("TRANSIENT: HTTP 503 em https://cdn.tse.jus.br/x.zip");
    const r = await pelaFerramenta();
    expect(r.haMais).toBe(false);
    expect(r.completa).toBe(false);
    expect(r.erros).toEqual([falhaAoListar.message]);
    expect(historico()[0]).toMatchObject({ resultado: "erro_origem", execucao_id: EXECUCAO });
    expect(tabela("tse_varredura").find((v) => v.completa === true)).toBeUndefined();
  });

  it("falha nossa: grava a rodada com erro nosso, sem marcar a janela completa", async () => {
    falhaAoListar = new Error("Zip inválido (EOCD não encontrado)");
    const r = await pelaFerramenta();
    expect(r.haMais).toBe(false);
    expect(r.completa).toBe(false);
    expect(historico()[0].resultado).toBe("erro_nosso");
  });
});
