import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PAGINAS_PUBLICAS, ROTAS_FORA_DA_BUSCA, linhasPaginasPublicas } from "./lista";

// ---------------------------------------------------------------------------
// A lista de páginas públicas × as rotas do código. Lê os arquivos de rota
// (sem executá-los): o caminho vem do `createFileRoute("…")` de cada um.
// ---------------------------------------------------------------------------

const PASTA = fileURLToPath(new URL("../../routes/", import.meta.url));

/** Caminho público → código do arquivo, das rotas estáticas (sem parâmetro). */
function rotasEstaticas(): Map<string, string> {
  const r = new Map<string, string>();
  for (const f of readdirSync(PASTA)) {
    if (!f.endsWith(".tsx")) continue;
    const codigo = readFileSync(PASTA + f, "utf8");
    const id = codigo.match(/createFileRoute\("([^"]+)"\)/)?.[1];
    if (!id || id.includes("$") || id.startsWith("/_")) continue;
    // `/camara_/deputados/` → `/camara/deputados`
    const caminho = id.replace(/_(?=\/|$)/g, "").replace(/(.)\/$/, "$1");
    r.set(caminho, codigo);
  }
  return r;
}

const foraDaBusca = (rota: string) =>
  Object.keys(ROTAS_FORA_DA_BUSCA).some((f) =>
    f === "/" ? rota === "/" : rota === f || rota.startsWith(f + "/"),
  );

describe("páginas públicas × rotas", () => {
  const rotas = rotasEstaticas();

  it("encontra as rotas estáticas", () => {
    expect(rotas.has("/sobre")).toBe(true);
    expect(rotas.has("/camara/deputados")).toBe(true);
  });

  it("toda rota pública estática está na lista ou tem motivo para ficar fora", () => {
    const listadas = new Set(PAGINAS_PUBLICAS.map((p) => p.rota));
    for (const rota of rotas.keys()) {
      expect(
        listadas.has(rota) || foraDaBusca(rota),
        `rota "${rota}" sem entrada em PAGINAS_PUBLICAS nem em ROTAS_FORA_DA_BUSCA`,
      ).toBe(true);
    }
  });

  it("toda entrada aponta para uma rota que existe e não está excluída", () => {
    for (const p of PAGINAS_PUBLICAS) {
      expect(rotas.has(p.rota), `rota "${p.rota}" não existe`).toBe(true);
      expect(foraDaBusca(p.rota), `rota "${p.rota}" está também na lista de fora`).toBe(false);
    }
  });

  it("o resumo da página é literal no código da rota (a description do head)", () => {
    for (const p of PAGINAS_PUBLICAS) {
      expect(
        rotas.get(p.rota),
        `resumo de "${p.rota}" não está mais no código: atualize a lista e sincronize`,
      ).toContain(p.resumo);
    }
  });

  it("toda seção tem a âncora, o título e o resumo no código da página", () => {
    for (const p of PAGINAS_PUBLICAS) {
      const codigo = rotas.get(p.rota) ?? "";
      for (const s of p.secoes ?? []) {
        const destino = `${p.rota}#${s.ancora}`;
        expect(
          codigo.includes(`id="${s.ancora}"`) || codigo.includes(`id: "${s.ancora}"`),
          `âncora ${destino} não existe`,
        ).toBe(true);
        expect(codigo, `título de ${destino}`).toContain(s.titulo);
        if (s.resumo) expect(codigo, `resumo de ${destino}`).toContain(s.resumo);
      }
    }
  });

  it("uma linha por destino, sem repetição", () => {
    const ids = linhasPaginasPublicas().map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("linhasPaginasPublicas", () => {
  it("a seção leva a página como nome e o destino com âncora", () => {
    const linhas = linhasPaginasPublicas([
      {
        rota: "/trilhas",
        titulo: "Trilhas",
        resumo: "Resumo",
        secoes: [{ ancora: "primeiro-contrato", titulo: "Como ler um contrato" }],
      },
    ]);
    expect(linhas).toEqual([
      {
        id: "/trilhas",
        rota: "/trilhas",
        ancora: null,
        pagina: "Trilhas",
        titulo: "Trilhas",
        resumo: "Resumo",
        palavras: null,
        texto: null,
      },
      {
        id: "/trilhas#primeiro-contrato",
        rota: "/trilhas",
        ancora: "primeiro-contrato",
        pagina: "Trilhas",
        titulo: "Como ler um contrato",
        resumo: null,
        palavras: null,
        texto: null,
      },
    ]);
  });
});
