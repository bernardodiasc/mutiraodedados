import { describe, expect, it } from "vitest";
import {
  linkDivulgaCandidato,
  linkConvenioTransferegov,
  portalDoLink,
  linksDoConvenio,
} from "./links-oficiais";

const BASE = "https://divulgacandcontas.tse.jus.br/divulga/#";

describe("linkDivulgaCandidato", () => {
  // Cada caso abaixo foi aberto no navegador contra o site real do TSE em
  // 2026-08-08 e carregou a ficha correta.
  it("eleição geral: UE é a própria UF", () => {
    expect(
      linkDivulgaCandidato({ ano: 2022, uf: "AC", ue: "AC", sqCandidato: "10001635783" }),
    ).toBe(`${BASE}/candidato/NORTE/AC/2040602022/10001635783/2022/AC`);
  });

  it("eleição municipal: UE é o código do município", () => {
    expect(
      linkDivulgaCandidato({ ano: 2024, uf: "AC", ue: "01554", sqCandidato: "10002033394" }),
    ).toBe(`${BASE}/candidato/NORTE/AC/2045202024/10002033394/2024/01554`);
  });

  it("cargo nacional (presidente): região BRASIL", () => {
    expect(
      linkDivulgaCandidato({ ano: 2022, uf: "BR", ue: "BR", sqCandidato: "280001612393" }),
    ).toBe(`${BASE}/candidato/BRASIL/BR/2040602022/280001612393/2022/BR`);
  });

  it("2026 tem id de eleição — era o que fazia o link cair na home", () => {
    const url = linkDivulgaCandidato({
      ano: 2026,
      uf: "MG",
      ue: "MG",
      sqCandidato: "130002542026",
    });
    expect(url).toBe(`${BASE}/candidato/SUDESTE/MG/20322002026/130002542026/2026/MG`);
    expect(url).not.toContain("/home");
  });

  it("centro-oeste vai com hífen", () => {
    expect(
      linkDivulgaCandidato({ ano: 2022, uf: "GO", ue: "GO", sqCandidato: "90001621627" }),
    ).toContain("/CENTRO-OESTE/GO/");
  });

  it("cai na home quando falta o que identifica a candidatura", () => {
    const home = `${BASE}/home`;
    expect(linkDivulgaCandidato({ ano: 2028, uf: "SP", ue: "SP", sqCandidato: "1" })).toBe(home);
    expect(linkDivulgaCandidato({ ano: 2022, uf: null, ue: "SP", sqCandidato: "1" })).toBe(home);
    expect(linkDivulgaCandidato({ ano: 2022, uf: "SP", ue: null, sqCandidato: "1" })).toBe(home);
  });

  it("não repete o formato antigo, que hoje dá erro no TSE em qualquer ano", () => {
    // Antigo: #/candidato/<ano>/<id>/<UE>/<sq> — começava pelo ano.
    const url = linkDivulgaCandidato({ ano: 2022, uf: "AC", ue: "AC", sqCandidato: "10001635783" });
    expect(url).not.toContain("/candidato/2022/");
  });
});

describe("links de convênio nos dois portais", () => {
  it("monta a ficha do Transferegov a partir do código SICONV", () => {
    const u = linkConvenioTransferegov("123456");
    expect(u).toContain("discricionarias.transferegov.sistema.gov.br");
    expect(u).toContain("sequencialConvenio=123456");
  });

  it("sem código SICONV não inventa ficha", () => {
    expect(linkConvenioTransferegov(null)).toBeNull();
    expect(linkConvenioTransferegov("  ")).toBeNull();
  });

  it("nomeia o portal pelo host — o rótulo não pode mentir", () => {
    expect(portalDoLink("https://discricionarias.transferegov.sistema.gov.br/x")).toBe(
      "Transferegov",
    );
    expect(portalDoLink("https://portaldatransparencia.gov.br/convenios/9")).toBe(
      "Portal da Transparência",
    );
    expect(portalDoLink(null)).toBeNull();
  });
});

describe("linksDoConvenio", () => {
  it("id numérico rende a ficha direta no Portal, não a busca", () => {
    const [portal] = linksDoConvenio({ id: "912345", numero: "812345/2024" });
    expect(portal.portal).toBe("Portal da Transparência");
    expect(portal.url).toBe("https://portaldatransparencia.gov.br/convenios/912345");
  });

  it("id sintético cai na consulta por número", () => {
    const [portal] = linksDoConvenio({ id: "num-812345", numero: "812345/2024" });
    expect(portal.url).toContain("/convenios/consulta?nrConvenio=");
  });

  it("com código SICONV entrega os DOIS portais, Portal primeiro", () => {
    const l = linksDoConvenio({ id: "912345", numero: "812345", codigoSiconv: "777" });
    expect(l.map((x) => x.portal)).toEqual(["Portal da Transparência", "Transferegov"]);
  });

  it("sem código SICONV entrega só o Portal", () => {
    const l = linksDoConvenio({ id: "912345", numero: "812345" });
    expect(l).toHaveLength(1);
  });

  it("sem id nem número não inventa link nenhum", () => {
    expect(linksDoConvenio({})).toEqual([]);
  });
});
