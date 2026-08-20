import { describe, it, expect } from "vitest";
import {
  classificarResultado,
  classificarRodada,
  exigeAtencao,
  EXPLICACAO_RESULTADO,
  RESULTADOS,
  ROTULO_RESULTADO,
} from "./resultado-rodada";

describe("resultado-rodada/os cinco sentidos do zero", () => {
  it("importou registros", () => {
    expect(classificarResultado({ importados: 42, erros: [] })).toBe("com_dados");
  });

  it("zero com origem OK e período fechado = sem dados mesmo", () => {
    expect(classificarResultado({ importados: 0, erros: [] })).toBe("sem_dados");
  });

  it("zero em período recente = ainda não publicado", () => {
    expect(classificarResultado({ importados: 0, erros: [], periodoRecente: true })).toBe(
      "nao_publicado",
    );
  });

  it("período anterior ao início da fonte = fora da janela", () => {
    expect(classificarResultado({ importados: 0, erros: [], foraDaJanela: true })).toBe(
      "fora_da_janela",
    );
  });

  it("fora da janela vence tudo — nem adianta olhar erro", () => {
    expect(
      classificarResultado({ importados: 0, erros: ["TRANSIENT: 503"], foraDaJanela: true }),
    ).toBe("fora_da_janela");
  });
});

describe("resultado-rodada/erro nosso × erro da origem", () => {
  it("404 numa URL que nós montamos é endpoint errado — erro nosso", () => {
    // O caso real do PNCP: meses aparecendo como "0 sem erro".
    expect(classificarResultado({ importados: 0, erros: ["p1: PNCP API 404: Not Found"] })).toBe(
      "erro_nosso",
    );
  });

  it("401 e 403 são credencial — erro nosso", () => {
    expect(classificarResultado({ importados: 0, erros: ["Portal API 401"] })).toBe("erro_nosso");
    expect(classificarResultado({ importados: 0, erros: ["Portal API 403"] })).toBe("erro_nosso");
  });

  it("parse e banco são nossos", () => {
    expect(classificarResultado({ importados: 0, erros: ["Portal retornou JSON inválido"] })).toBe(
      "erro_nosso",
    );
    expect(classificarResultado({ importados: 0, erros: ["db: invalid input syntax"] })).toBe(
      "erro_nosso",
    );
  });

  it("TRANSIENT, 5xx, 429 e timeout são da origem", () => {
    expect(classificarResultado({ importados: 0, erros: ["TRANSIENT: PNCP 503"] })).toBe(
      "erro_origem",
    );
    expect(classificarResultado({ importados: 0, erros: ["Portal API 502"] })).toBe("erro_origem");
    expect(classificarResultado({ importados: 0, erros: ["timeout após 240s"] })).toBe(
      "erro_origem",
    );
  });

  it("erro inclassificável conta como nosso — melhor investigar à toa que deixar passar", () => {
    expect(classificarResultado({ importados: 0, erros: ["algo estranho aconteceu"] })).toBe(
      "erro_nosso",
    );
  });

  it("erro pesa mais que dados importados: rodada parcial com falha não vira 'com_dados'", () => {
    expect(classificarResultado({ importados: 900, erros: ["TRANSIENT: 503"] })).toBe(
      "erro_origem",
    );
  });
});

describe("resultado-rodada/atenção", () => {
  it("só os erros exigem ação de quem opera", () => {
    expect(exigeAtencao("erro_nosso")).toBe(true);
    expect(exigeAtencao("erro_origem")).toBe(true);
    expect(exigeAtencao("sem_dados")).toBe(false);
    expect(exigeAtencao("nao_publicado")).toBe(false);
    expect(exigeAtencao("com_dados")).toBe(false);
    expect(exigeAtencao("fora_da_janela")).toBe(false);
  });
});

describe("resultado-rodada/catálogo", () => {
  it("todo resultado tem rótulo e explicação", () => {
    for (const r of RESULTADOS) {
      expect(ROTULO_RESULTADO[r]).toBeTruthy();
      expect(EXPLICACAO_RESULTADO[r]).toBeTruthy();
    }
  });
});

describe("resultado-rodada/a partir do runner", () => {
  it("lê processados e erros do resultado da rodada", () => {
    expect(classificarRodada({ processados: 0, erros: [] })).toBe("sem_dados");
    expect(classificarRodada({ processados: 7, erros: [] })).toBe("com_dados");
    expect(classificarRodada({ processados: 0, erros: [] }, { periodoRecente: true })).toBe(
      "nao_publicado",
    );
  });
});
