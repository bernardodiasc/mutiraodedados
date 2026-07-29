import { afterEach, describe, expect, it, vi } from "vitest";
import { abrirEntradaZip, encontrarEntrada, lerLinhasCsv, listarEntradasZip } from "./client";

// ---------------------------------------------------------------------------
// Helpers: monta um zip em memória (método stored) e um fetch fake com Range.
// ---------------------------------------------------------------------------

function crc32(data: Uint8Array): number {
  let c = ~0;
  for (let i = 0; i < data.length; i++) {
    c ^= data[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function u16le(n: number): number[] {
  return [n & 0xff, (n >> 8) & 0xff];
}
function u32le(n: number): number[] {
  return [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];
}

function montarZip(entradas: Array<{ nome: string; conteudo: Uint8Array }>): Uint8Array {
  const partes: number[] = [];
  const centrais: number[] = [];
  for (const { nome, conteudo } of entradas) {
    const nomeBytes = [...nome].map((c) => c.charCodeAt(0));
    const offset = partes.length;
    const crc = crc32(conteudo);
    partes.push(
      0x50,
      0x4b,
      0x03,
      0x04, // PK\3\4
      ...u16le(20),
      ...u16le(0),
      ...u16le(0), // versão, flags, método=stored
      ...u16le(0),
      ...u16le(0), // hora, data
      ...u32le(crc),
      ...u32le(conteudo.length),
      ...u32le(conteudo.length),
      ...u16le(nomeBytes.length),
      ...u16le(0),
      ...nomeBytes,
      ...conteudo,
    );
    centrais.push(
      0x50,
      0x4b,
      0x01,
      0x02, // PK\1\2
      ...u16le(20),
      ...u16le(20),
      ...u16le(0),
      ...u16le(0), // versões, flags, método
      ...u16le(0),
      ...u16le(0), // hora, data
      ...u32le(crc),
      ...u32le(conteudo.length),
      ...u32le(conteudo.length),
      ...u16le(nomeBytes.length),
      ...u16le(0),
      ...u16le(0), // nlen, elen, clen
      ...u16le(0),
      ...u16le(0),
      ...u32le(0), // disco, attrs internos, attrs externos
      ...u32le(offset),
      ...nomeBytes,
    );
  }
  const cdOff = partes.length;
  partes.push(...centrais);
  const cdSize = partes.length - cdOff;
  partes.push(
    0x50,
    0x4b,
    0x05,
    0x06, // EOCD
    ...u16le(0),
    ...u16le(0),
    ...u16le(entradas.length),
    ...u16le(entradas.length),
    ...u32le(cdSize),
    ...u32le(cdOff),
    ...u16le(0),
  );
  return new Uint8Array(partes);
}

function instalarFetchFake(arquivo: Uint8Array) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: unknown, init?: RequestInit) => {
      if (init?.method === "HEAD") {
        return new Response(null, {
          status: 200,
          headers: { "content-length": String(arquivo.length) },
        });
      }
      const range = (init?.headers as Record<string, string> | undefined)?.Range;
      if (range) {
        const m = range.match(/bytes=(\d+)-(\d+)/)!;
        const ini = Number(m[1]);
        const fim = Math.min(Number(m[2]), arquivo.length - 1);
        return new Response(new Uint8Array(arquivo.subarray(ini, fim + 1)), { status: 206 });
      }
      return new Response(new Uint8Array(arquivo), { status: 200 });
    }),
  );
}

function streamDe(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      // fatias pequenas para exercitar o estado incremental do parser
      for (let i = 0; i < bytes.length; i += 7) {
        controller.enqueue(bytes.subarray(i, Math.min(i + 7, bytes.length)));
      }
      controller.close();
    },
  });
}

const LATIN1_ENCODE = (s: string) => new Uint8Array([...s].map((c) => c.charCodeAt(0) & 0xff));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("lerLinhasCsv", () => {
  it("separa por ; respeitando aspas e escape", async () => {
    const csv = '"A";"B;com separador";"C ""aspas"" ok"\n"1";"2";"3"\n';
    const linhas: string[][] = [];
    for await (const l of lerLinhasCsv(streamDe(LATIN1_ENCODE(csv)))) linhas.push(l);
    expect(linhas).toEqual([
      ["A", "B;com separador", 'C "aspas" ok'],
      ["1", "2", "3"],
    ]);
  });

  it("decodifica Latin-1 (ç, ã) e tolera CRLF e última linha sem \\n", async () => {
    const csv = '"DESCRIÇÃO";"AÇÃO"\r\n"São Paulo";"não"';
    const linhas: string[][] = [];
    for await (const l of lerLinhasCsv(streamDe(LATIN1_ENCODE(csv)))) linhas.push(l);
    expect(linhas).toEqual([
      ["DESCRIÇÃO", "AÇÃO"],
      ["São Paulo", "não"],
    ]);
  });

  it("ignora linhas vazias", async () => {
    const csv = '"a"\n\n"b"\n';
    const linhas: string[][] = [];
    for await (const l of lerLinhasCsv(streamDe(LATIN1_ENCODE(csv)))) linhas.push(l);
    expect(linhas).toEqual([["a"], ["b"]]);
  });
});

describe("zip remoto via Range", () => {
  it("lista entradas e abre uma entrada específica", async () => {
    const zip = montarZip([
      { nome: "consulta_cand_2022_AC.csv", conteudo: LATIN1_ENCODE('"SQ";"NM"\n"1";"ANA"\n') },
      { nome: "consulta_cand_2022_SP.csv", conteudo: LATIN1_ENCODE('"SQ";"NM"\n"2";"BIA"\n') },
    ]);
    instalarFetchFake(zip);

    const entradas = await listarEntradasZip("https://exemplo.test/x.zip");
    expect(entradas.map((e) => e.nome)).toEqual([
      "consulta_cand_2022_AC.csv",
      "consulta_cand_2022_SP.csv",
    ]);

    const alvo = encontrarEntrada(entradas, "_SP");
    expect(alvo?.nome).toBe("consulta_cand_2022_SP.csv");

    const stream = await abrirEntradaZip("https://exemplo.test/x.zip", alvo!);
    const linhas: string[][] = [];
    for await (const l of lerLinhasCsv(stream)) linhas.push(l);
    expect(linhas).toEqual([
      ["SQ", "NM"],
      ["2", "BIA"],
    ]);
  });
});
