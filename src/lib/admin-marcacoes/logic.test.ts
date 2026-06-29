import { describe, it, expect } from "vitest";
import {
  buildCurlsMarcacao,
  severidadeFromVotos,
  hrefEntidade,
  contestacaoDirty,
} from "./logic";

describe("admin-marcacoes/logic", () => {
  it("buildCurlsMarcacao só para contrato", () => {
    expect(buildCurlsMarcacao("orgao", "x")).toBeUndefined();
    const r = buildCurlsMarcacao("contrato", "abc/1");
    expect(r).toHaveLength(1);
    expect(r![0].url).toContain("swagger-ui");
    expect(r![0].nota).toContain("abc/1");
  });

  it("severidadeFromVotos", () => {
    expect(severidadeFromVotos(10)).toBe("critico");
    expect(severidadeFromVotos(3)).toBe("aviso");
    expect(severidadeFromVotos(0)).toBe("info");
    expect(severidadeFromVotos(-2)).toBe("info");
  });

  it("hrefEntidade", () => {
    expect(hrefEntidade("orgao", "1")).toBe("/orgaos/1");
    expect(hrefEntidade("fornecedor", "x")).toBe("/fornecedores/x");
    expect(hrefEntidade("contrato", "y")).toBe("/contratos/y");
  });

  it("contestacaoDirty", () => {
    const it = { status: "aberta", resposta: null } as any;
    expect(contestacaoDirty(it, "aberta", "")).toBe(false);
    expect(contestacaoDirty(it, "respondida", "")).toBe(true);
    expect(contestacaoDirty(it, "aberta", "oi")).toBe(true);
  });
});