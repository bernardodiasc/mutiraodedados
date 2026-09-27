import { describe, expect, it } from "vitest";
import { extrairLinksInternos, hrefDoArtigo, motivosDeRevisao, normalizarConsulta } from "./logic";

// ---------------------------------------------------------------------------
// Referências de artigo: links internos do Markdown viram sugestões de
// referência (ficha ou consulta de /buscar), e cada referência pode pedir
// revisão quando o registro some ou muda, ou a consulta fica vazia.
// ---------------------------------------------------------------------------

describe("extrairLinksInternos", () => {
  it("pega links relativos e do domínio do site, sem repetir", () => {
    const md = [
      "Veja [a licitação](/licitacoes/123) e [o contrato](https://mutiraodedados.com.br/contratos/9%2F2024).",
      'De novo [aqui](/licitacoes/123 "título").',
      "Fora: [PNCP](https://pncp.gov.br/x) e [âncora](#secao) e ![imagem](/img/a.png).",
      "Busca: [merenda](/buscar?q=merenda&pagina=2).",
    ].join("\n");
    expect(extrairLinksInternos(md)).toEqual([
      { caminho: "/licitacoes/123", texto: "a licitação" },
      { caminho: "/contratos/9%2F2024", texto: "o contrato" },
      { caminho: "/buscar?q=merenda&pagina=2", texto: "merenda" },
    ]);
  });

  it("descarta arquivos estáticos e a própria raiz", () => {
    expect(extrairLinksInternos("[a](/) [b](/favicon.ico) [c](/relatorio.pdf)")).toEqual([]);
  });
});

describe("normalizarConsulta", () => {
  it("ordena os parâmetros e tira página, itens, ordem e corte", () => {
    expect(
      normalizarConsulta(
        "/buscar?uf=PE&q=merenda&pagina=3&ate=2026-09-01T00:00:00Z&tipo=contratos&itens=50&ordem=recentes",
      ),
    ).toBe("/buscar?q=merenda&tipo=contratos&uf=PE");
  });

  it("não é consulta: outra rota ou sem termo", () => {
    expect(normalizarConsulta("/licitacoes/1")).toBeNull();
    expect(normalizarConsulta("/buscar?tipo=contratos")).toBeNull();
  });
});

describe("motivosDeRevisao", () => {
  const verificado = "2026-09-01T00:00:00Z";

  it("registro que sumiu do índice", () => {
    expect(
      motivosDeRevisao({ tipo: "registro", verificadoEm: verificado, noIndice: null }),
    ).toEqual(["sumiu"]);
  });

  it("registro que mudou depois da verificação", () => {
    expect(
      motivosDeRevisao({
        tipo: "registro",
        verificadoEm: verificado,
        noIndice: { atualizadoEm: "2026-09-10T00:00:00Z" },
      }),
    ).toEqual(["mudou"]);
  });

  it("registro nunca verificado conta como mudado; em dia não pede revisão", () => {
    expect(
      motivosDeRevisao({
        tipo: "registro",
        verificadoEm: null,
        noIndice: { atualizadoEm: "2026-08-01T00:00:00Z" },
      }),
    ).toEqual(["mudou"]);
    expect(
      motivosDeRevisao({
        tipo: "registro",
        verificadoEm: verificado,
        noIndice: { atualizadoEm: "2026-08-01T00:00:00Z" },
      }),
    ).toEqual([]);
  });

  it("consulta que ficou vazia; contagem indisponível não acusa", () => {
    expect(motivosDeRevisao({ tipo: "consulta", verificadoEm: verificado, total: 0 })).toEqual([
      "consulta_vazia",
    ]);
    expect(motivosDeRevisao({ tipo: "consulta", verificadoEm: verificado, total: null })).toEqual(
      [],
    );
    expect(motivosDeRevisao({ tipo: "consulta", verificadoEm: verificado, total: 12 })).toEqual([]);
  });
});

describe("hrefDoArtigo", () => {
  it("usa a rota da categoria", () => {
    expect(hrefDoArtigo("mapa", "da-licitacao-ao-contrato")).toBe(
      "/mapas/da-licitacao-ao-contrato",
    );
    expect(hrefDoArtigo("nota", "x")).toBe("/notas/x");
    expect(hrefDoArtigo("tutorial", "y")).toBe("/tutoriais/y");
  });
});
