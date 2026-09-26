import { describe, expect, it } from "vitest";
import { ETAPAS, ORDEM, bloqueadaPor, naOrdem } from "./dependencias";
import { TAREFAS_DA_FERRAMENTA } from "./importar-cli";

describe("dependências/tabela", () => {
  it("segue a ordem das etapas: cadastros primeiro, cruzamentos por último", () => {
    expect(ETAPAS.map((e) => e.nome)).toEqual([
      "cadastros",
      "dados de base",
      "enriquecimento pela origem",
      "TSE: candidatos, depois bens, receitas, despesas e resultados",
      "vínculo parlamentar↔candidato",
      "cruzamentos",
    ]);
    expect(ORDEM.indexOf("camara_cadastro")).toBeLessThan(ORDEM.indexOf("camara_ceap"));
    expect(ORDEM.indexOf("convenios")).toBeLessThan(ORDEM.indexOf("convenios_origem"));
    expect(ORDEM.indexOf("tse_arquivo")).toBeLessThan(ORDEM.indexOf("tse_ponte"));
    expect(ORDEM.at(-1)).toBe("cruzamento_doador_fornecedor");
  });

  it("cada tarefa aparece uma vez, e toda dependência vem antes dela", () => {
    expect(new Set(ORDEM).size).toBe(ORDEM.length);
    for (const etapa of ETAPAS) {
      for (const t of etapa.tarefas) {
        for (const d of t.dependeDe) {
          expect(ORDEM.indexOf(d), `${t.tarefa} depende de ${d}`).toBeGreaterThanOrEqual(0);
          expect(ORDEM.indexOf(d)).toBeLessThan(ORDEM.indexOf(t.tarefa));
        }
      }
    }
  });

  it("toda tarefa com adaptador na ferramenta está na tabela", () => {
    for (const t of TAREFAS_DA_FERRAMENTA) expect(ORDEM).toContain(t);
  });
});

describe("dependências/ordenar um pedido", () => {
  it("põe as tarefas pedidas na ordem da tabela", () => {
    expect(naOrdem(["tse_ponte", "senado_vot", "camara_cadastro", "camara_vot"])).toEqual([
      "camara_cadastro",
      "camara_vot",
      "senado_vot",
      "tse_ponte",
    ]);
  });

  it("recusa tarefa que a tabela não conhece", () => {
    expect(() => naOrdem(["camara_vot", "camara_votacoes"])).toThrow(/camara_votacoes/);
  });
});

describe("dependências/fonte que parou", () => {
  it("bloqueia quem depende dela, direta ou indiretamente", () => {
    const paradas = new Set(["camara_cadastro"]);
    expect(bloqueadaPor("camara_ceap", paradas)).toBe("camara_cadastro");
    // tse_lacunas → tse_ponte → camara_cadastro
    expect(bloqueadaPor("tse_lacunas", paradas)).toBe("camara_cadastro");
  });

  it("não bloqueia quem não depende dela", () => {
    const paradas = new Set(["camara_cadastro"]);
    expect(bloqueadaPor("senado_vot", paradas)).toBeNull();
    expect(bloqueadaPor("pncp", paradas)).toBeNull();
  });
});
