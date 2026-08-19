/**
 * Camada CKAN genérica — descoberta e download de dados abertos publicados em
 * portais CKAN (dadosabertos.tse.jus.br, dados.gov.br, …). NADA aqui é
 * específico de uma fonte: quem sabe quais datasets baixar é o cliente da
 * fonte (ex.: `src/lib/data/tse/client-ckan.ts`).
 *
 * Restrições do runtime (Cloudflare Worker): sem child_process, sem binários,
 * sem fs — tudo em Web Streams. Zips grandes (centenas de MB) NUNCA são
 * baixados por inteiro: lemos o diretório central via requisições HTTP Range
 * e depois baixamos só a entrada desejada, descomprimindo em streaming com
 * DecompressionStream("deflate-raw").
 */

import { ehStatusTransitorio, fetchComRetry } from "@/lib/data/http-retry";

// ---------------------------------------------------------------------------
// API CKAN (descoberta)
// ---------------------------------------------------------------------------

export type CkanResource = {
  name: string;
  url: string;
  format: string;
};

/**
 * GET com a política de retry do projeto. Esta fonte é a origem do padrão
 * (4 tentativas, 500ms → 1,5s → 4,5s), hoje em `http-retry.ts`; aqui só
 * fica a mensagem de erro do CKAN.
 */
async function ckanFetch(url: string, init?: RequestInit): Promise<Response> {
  const res = await fetchComRetry(url, init);
  if (res.ok) return res;
  throw new Error(
    ehStatusTransitorio(res.status)
      ? `TRANSIENT: HTTP ${res.status} em ${url}`
      : `HTTP ${res.status} em ${url}`,
  );
}

/** `package_show` do CKAN: devolve os resources (arquivos) de um dataset. */
export async function ckanPackageShow(baseUrl: string, packageId: string): Promise<CkanResource[]> {
  const url = `${baseUrl.replace(/\/$/, "")}/api/3/action/package_show?id=${encodeURIComponent(packageId)}`;
  const res = await ckanFetch(url, { headers: { accept: "application/json" } });
  const body = (await res.json()) as {
    success: boolean;
    result?: { resources?: Array<{ name?: string; url?: string; format?: string }> };
  };
  if (!body.success || !body.result) throw new Error(`CKAN: dataset ${packageId} não encontrado.`);
  return (body.result.resources ?? [])
    .filter((r) => r.url)
    .map((r) => ({ name: r.name ?? "", url: r.url!, format: r.format ?? "" }));
}

// ---------------------------------------------------------------------------
// Leitura de ZIP remoto via HTTP Range (sem baixar o arquivo inteiro)
// ---------------------------------------------------------------------------

export type ZipEntrada = {
  nome: string;
  /** 0 = stored, 8 = deflate. */
  metodo: number;
  tamanhoComprimido: number;
  tamanhoOriginal: number;
  /** Offset do local file header no arquivo. */
  offsetLocal: number;
};

async function fetchRange(url: string, inicio: number, fim: number): Promise<Uint8Array> {
  const res = await ckanFetch(url, {
    headers: { Range: `bytes=${inicio}-${fim}` },
  });
  if (res.status !== 206 && res.status !== 200) {
    throw new Error(`Servidor não suporta HTTP Range (${res.status}) em ${url}`);
  }
  return new Uint8Array(await res.arrayBuffer());
}

async function tamanhoRemoto(url: string): Promise<number> {
  const res = await ckanFetch(url, { method: "HEAD" });
  const len = Number(res.headers.get("content-length") ?? 0);
  if (!len) throw new Error(`Sem Content-Length em ${url} — não dá para ler o zip por Range.`);
  return len;
}

function u16(b: Uint8Array, p: number): number {
  return b[p] | (b[p + 1] << 8);
}
function u32(b: Uint8Array, p: number): number {
  return (b[p] | (b[p + 1] << 8) | (b[p + 2] << 16)) + b[p + 3] * 0x1000000;
}

const LATIN1 = new TextDecoder("latin1");

/**
 * Lista as entradas do zip lendo só o fim do arquivo (EOCD + diretório
 * central) via Range. Zips com campos zip64 (≥ 4 GB) não são suportados —
 * nenhum dataset atual chega lá; falha com mensagem clara se aparecer.
 */
export async function listarEntradasZip(url: string): Promise<ZipEntrada[]> {
  const total = await tamanhoRemoto(url);
  const caudaLen = Math.min(total, 70_000);
  const cauda = await fetchRange(url, total - caudaLen, total - 1);
  // EOCD: PK\x05\x06
  let e = -1;
  for (let i = cauda.length - 22; i >= 0; i--) {
    if (
      cauda[i] === 0x50 &&
      cauda[i + 1] === 0x4b &&
      cauda[i + 2] === 0x05 &&
      cauda[i + 3] === 0x06
    ) {
      e = i;
      break;
    }
  }
  if (e < 0) throw new Error(`Zip inválido (EOCD não encontrado) em ${url}`);
  const cdSize = u32(cauda, e + 12);
  const cdOff = u32(cauda, e + 16);
  if (cdOff === 0xffffffff || cdSize === 0xffffffff) {
    throw new Error(`Zip64 não suportado (${url}) — arquivo acima de 4 GB.`);
  }
  const cd = await fetchRange(url, cdOff, cdOff + cdSize - 1);
  const entradas: ZipEntrada[] = [];
  let p = 0;
  // Central directory header: PK\x01\x02
  while (
    p + 46 <= cd.length &&
    cd[p] === 0x50 &&
    cd[p + 1] === 0x4b &&
    cd[p + 2] === 0x01 &&
    cd[p + 3] === 0x02
  ) {
    const metodo = u16(cd, p + 10);
    const tamanhoComprimido = u32(cd, p + 20);
    const tamanhoOriginal = u32(cd, p + 24);
    const nlen = u16(cd, p + 28);
    const elen = u16(cd, p + 30);
    const clen = u16(cd, p + 32);
    const offsetLocal = u32(cd, p + 42);
    const nome = LATIN1.decode(cd.subarray(p + 46, p + 46 + nlen));
    entradas.push({ nome, metodo, tamanhoComprimido, tamanhoOriginal, offsetLocal });
    p += 46 + nlen + elen + clen;
  }
  return entradas;
}

/**
 * Abre UMA entrada do zip remoto como stream de bytes descomprimidos.
 * Baixa apenas os bytes daquela entrada (Range) e infla em streaming.
 */
export async function abrirEntradaZip(
  url: string,
  entrada: ZipEntrada,
): Promise<ReadableStream<Uint8Array>> {
  // Local file header (30 bytes fixos) para descobrir onde os dados começam.
  const lh = await fetchRange(url, entrada.offsetLocal, entrada.offsetLocal + 29);
  if (!(lh[0] === 0x50 && lh[1] === 0x4b && lh[2] === 0x03 && lh[3] === 0x04)) {
    throw new Error(`Zip inválido (local header) em ${url}: ${entrada.nome}`);
  }
  const nlen = u16(lh, 26);
  const elen = u16(lh, 28);
  const dataIni = entrada.offsetLocal + 30 + nlen + elen;
  const res = await ckanFetch(url, {
    headers: { Range: `bytes=${dataIni}-${dataIni + entrada.tamanhoComprimido - 1}` },
  });
  if (!res.body) throw new Error(`Resposta sem corpo para ${entrada.nome}`);
  if (entrada.metodo === 0) return res.body;
  if (entrada.metodo === 8) {
    return res.body.pipeThrough(new DecompressionStream("deflate-raw"));
  }
  throw new Error(`Método de compressão ${entrada.metodo} não suportado (${entrada.nome}).`);
}

/** Acha a entrada cujo nome contém o trecho (case-insensitive). */
export function encontrarEntrada(entradas: ZipEntrada[], trechoNome: string): ZipEntrada | null {
  const alvo = trechoNome.toLowerCase();
  return entradas.find((e) => e.nome.toLowerCase().includes(alvo)) ?? null;
}

// ---------------------------------------------------------------------------
// CSV streaming (Latin-1, separador configurável, aspas duplas com escape "")
// ---------------------------------------------------------------------------

export type CsvOpcoes = {
  separador?: string;
  /** Rótulo aceito pelo TextDecoder (default: latin1 — padrão dos CSVs gov). */
  encoding?: string;
};

/**
 * Itera linhas de um CSV como arrays de campos, decodificando em streaming.
 * Suporta campos entre aspas com separador/quebra de linha embutidos e escape
 * de aspas (""). Linhas vazias são ignoradas.
 */
export async function* lerLinhasCsv(
  stream: ReadableStream<Uint8Array>,
  opcoes?: CsvOpcoes,
): AsyncGenerator<string[]> {
  const sep = opcoes?.separador ?? ";";
  const decoder = new TextDecoder(opcoes?.encoding ?? "latin1");
  const reader = stream.getReader();

  let campo = "";
  let linha: string[] = [];
  let emAspas = false;
  let aposAspas = false; // acabou de fechar aspas (p/ detectar "")

  const linhasProntas: string[][] = [];

  const processar = (texto: string) => {
    for (let i = 0; i < texto.length; i++) {
      const c = texto[i];
      if (emAspas) {
        if (c === '"') {
          emAspas = false;
          aposAspas = true;
        } else {
          campo += c;
        }
        continue;
      }
      if (aposAspas && c === '"') {
        // "" dentro de campo com aspas = aspas literal
        campo += '"';
        emAspas = true;
        aposAspas = false;
        continue;
      }
      aposAspas = false;
      if (c === '"') {
        emAspas = true;
      } else if (c === sep) {
        linha.push(campo);
        campo = "";
      } else if (c === "\n") {
        linha.push(campo);
        campo = "";
        if (linha.length > 1 || linha[0] !== "") linhasProntas.push(linha);
        linha = [];
      } else if (c !== "\r") {
        campo += c;
      }
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    processar(decoder.decode(value, { stream: true }));
    while (linhasProntas.length > 0) yield linhasProntas.shift()!;
  }
  processar(decoder.decode());
  if (campo !== "" || linha.length > 0) {
    linha.push(campo);
    if (linha.length > 1 || linha[0] !== "") linhasProntas.push(linha);
  }
  while (linhasProntas.length > 0) yield linhasProntas.shift()!;
}
