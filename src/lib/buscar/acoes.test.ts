import { describe, expect, it } from "vitest";
import type { ItemBusca } from "@/lib/busca/consulta";
import {
  cabecalhoCsv,
  chaveDoRecorte,
  linhasCsv,
  nomeDoArquivo,
  referenciasMarkdown,
  searchParaSalvar,
  tipoNoCaderno,
  type ContextoExportacao,
} from "./acoes";

const item: ItemBusca = {
  colecao: "pncp_contratos_cache",
  id: "4637-2-004859/2026",
  categoria: "contratos",
  subtipo: null,
  fonte: "PNCP",
  titulo: "Contrato 12/2026 — Prefeitura de Recife",
  identificador: "PNCP 4637-2-004859/2026",
  resumo: "Merenda escolar",
  data: { valor: "2026-03-10", natureza: "assinatura", precisao: "dia" },
  valor: { n: 150000, natureza: "valor global contratado", unidade: "BRL" },
  uf: "PE",
  href: "/contratos/4637-2-004859%2F2026",
  urlOficial: "https://pncp.gov.br/x",
  pai: null,
  exato: false,
  motivo: "texto",
  trecho: null,
};

const ctx: ContextoExportacao = {
  consulta: "merenda",
  categoria: "Contratos",
  filtros: ["UF: PE"],
  escopo: "pagina",
  corte: "2026-09-26T19:46:15Z",
  geradoEm: "2026-09-26T20:00:00Z",
  total: 137,
  truncado: false,
  origem: "https://mutiraodedados.com.br",
};

describe("busca salva e recorte", () => {
  it("busca salva não guarda página nem corte", () => {
    expect(
      searchParaSalvar({ q: "merenda", tipo: "contratos", pagina: 3, ate: "x", uf: "PE" }),
    ).toEqual({
      q: "merenda",
      tipo: "contratos",
      uf: "PE",
    });
  });

  it("o recorte ignora página, corte, ordem e quantidade, mas não filtros", () => {
    const a = chaveDoRecorte({
      q: "merenda",
      uf: "PE",
      pagina: 2,
      ate: "x",
      ordem: "data-desc",
      itens: 50,
    });
    expect(a).toBe(chaveDoRecorte({ uf: "PE", q: "merenda" }));
    expect(a).not.toBe(chaveDoRecorte({ q: "merenda", uf: "SP" }));
  });
});

describe("tipoNoCaderno", () => {
  it("mapeia cada coleção para um tipo do caderno", () => {
    expect(tipoNoCaderno(item)).toBe("contrato");
    expect(tipoNoCaderno({ ...item, colecao: "tse_candidatos_cache" })).toBe("candidatura");
    expect(tipoNoCaderno({ ...item, colecao: "artigos", subtipo: "mapa" })).toBe("mapa");
    expect(tipoNoCaderno({ ...item, colecao: "artigos", subtipo: "nota" })).toBe("artigo");
  });
});

describe("referências e exportação", () => {
  it("Markdown com consulta, filtros, totais e corte no topo", () => {
    const md = referenciasMarkdown([item], ctx);
    expect(md).toContain('> Consulta: "merenda" em Contratos');
    expect(md).toContain("> Filtros: UF: PE");
    expect(md).toContain("> Itens: 1 (esta página) de 137 na busca");
    expect(md).toContain("> Corte do índice: 2026-09-26T19:46:15Z");
    expect(md).toContain(
      "- [Contrato 12/2026 — Prefeitura de Recife](https://mutiraodedados.com.br/contratos/4637-2-004859%2F2026) — PNCP · PNCP 4637-2-004859/2026 · Assinatura: 10/03/2026",
    );
    expect(md).toContain("[fonte oficial](https://pncp.gov.br/x)");
  });

  it("avisa quando o conjunto foi cortado", () => {
    expect(referenciasMarkdown([item], { ...ctx, escopo: "conjunto", truncado: true })).toContain(
      "foi cortado",
    );
  });

  it("CSV com link absoluto e contexto em comentário", () => {
    expect(linhasCsv([item], ctx.origem)[0]).toMatchObject({
      categoria: "Contratos",
      data: "2026-03-10",
      data_tipo: "Assinatura",
      valor: 150000,
      link: "https://mutiraodedados.com.br/contratos/4637-2-004859%2F2026",
    });
    expect(cabecalhoCsv(ctx, 1).split("\n")[0]).toBe('# Consulta: "merenda" em Contratos');
  });

  it("nome de arquivo sem acento", () => {
    expect(nomeDoArquivo("Licitação de merenda!", "2026-09-26T20:00:00Z", "csv")).toBe(
      "busca-licitacao-de-merenda-2026-09-26.csv",
    );
  });
});
