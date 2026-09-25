import { describe, expect, it } from "vitest";
import {
  h1DaEmenda,
  h1DaLicitacao,
  h1DoContrato,
  h1DoContratoPncp,
  h1DoConvenio,
  h1DoOrgao,
  resolverH1DoOrgao,
} from "./logic";

describe("h1DoContrato", () => {
  it("é o objeto do contrato, com dado pessoal mascarado", () => {
    expect(h1DoContrato({ objeto: "Serviço de limpeza — contato fulano@x.com" })).toBe(
      "Serviço de limpeza — contato [e-mail removido]",
    );
  });
});

describe("h1DoContratoPncp", () => {
  it("é o objeto quando existe", () => {
    expect(h1DoContratoPncp({ objeto: "Aquisição de merenda", numero_controle_pncp: "123" })).toBe(
      "Aquisição de merenda",
    );
  });

  it("sem objeto, cai no número de controle do PNCP", () => {
    expect(
      h1DoContratoPncp({ objeto: null, numero_controle_pncp: "00394460000141-2-000001/2024" }),
    ).toBe("Contrato 00394460000141-2-000001/2024");
  });
});

describe("h1DoConvenio", () => {
  it("é o objeto quando existe", () => {
    expect(h1DoConvenio({ objeto: "Pavimentação de vias", numero: "900", id: "1" })).toBe(
      "Pavimentação de vias",
    );
  });

  it("sem objeto, usa o número e, sem número, o id", () => {
    expect(h1DoConvenio({ objeto: null, numero: "900123", id: "1" })).toBe("Convênio 900123");
    expect(h1DoConvenio({ objeto: null, numero: null, id: "77" })).toBe("Convênio 77");
  });
});

describe("h1DaLicitacao", () => {
  it("é o objeto quando existe", () => {
    expect(h1DaLicitacao({ objeto: "Compra de medicamentos", numero: "5/2024" })).toBe(
      "Compra de medicamentos",
    );
  });

  it("sem objeto, usa o número (e só o rótulo quando nem isso há)", () => {
    expect(h1DaLicitacao({ objeto: null, numero: "5/2024" })).toBe("Licitação 5/2024");
    expect(h1DaLicitacao({ objeto: null, numero: null })).toBe("Licitação ");
  });
});

describe("h1DaEmenda", () => {
  it("é o autor da emenda", () => {
    expect(h1DaEmenda({ autor: "FULANO DE TAL" })).toBe("FULANO DE TAL");
  });

  it("sem autor, é só 'Emenda'", () => {
    expect(h1DaEmenda({ autor: null })).toBe("Emenda");
  });
});

describe("h1DoOrgao", () => {
  it("prefere o card curado das demais esferas", () => {
    expect(
      h1DoOrgao({ cod: "01000", curado: { nome: "Câmara dos Deputados" }, catalogo: null }),
    ).toBe("Câmara dos Deputados");
  });

  it("sem card curado, usa o nome do catálogo", () => {
    expect(
      h1DoOrgao({ cod: "26000", curado: null, catalogo: { nome: "Ministério da Saúde" } }),
    ).toBe("Ministério da Saúde");
  });

  it("sem catálogo, cai em 'Órgão {cod}'", () => {
    expect(h1DoOrgao({ cod: "99999", curado: null, catalogo: null })).toBe("Órgão 99999");
  });
});

describe("resolverH1DoOrgao", () => {
  const curados = [{ cod: "01000", nome: "Câmara dos Deputados" }];

  it("com card curado, usa o nome dele sem consultar o catálogo", async () => {
    let consultou = false;
    const h1 = await resolverH1DoOrgao("01000", curados, async () => {
      consultou = true;
      return { nome: "Outro nome" };
    });
    expect(h1).toBe("Câmara dos Deputados");
    expect(consultou).toBe(false);
  });

  it("sem card curado, usa o nome do catálogo", async () => {
    const h1 = await resolverH1DoOrgao("26000", curados, async () => ({
      nome: "Ministério da Educação",
    }));
    expect(h1).toBe("Ministério da Educação");
  });

  it("sem nome no catálogo, cai em 'Órgão {cod}'", async () => {
    const h1 = await resolverH1DoOrgao("99999", curados, async () => ({ nome: null }));
    expect(h1).toBe("Órgão 99999");
  });

  it("se a consulta ao catálogo falha, não há H1", async () => {
    const h1 = await resolverH1DoOrgao("26000", curados, async () => {
      throw new Error("fora do ar");
    });
    expect(h1).toBeNull();
  });
});
