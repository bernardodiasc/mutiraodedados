import { describe, it, expect } from "vitest";
import type { PromptModelo } from "@/lib/prompt-modelos.functions";
import {
  comVariavelAdicionada,
  comVariavelAtualizada,
  comVariavelRemovida,
  contarPrompts,
  filtrarPrompts,
  formFromPrompt,
  formPromptValido,
  FORM_VAZIO,
  payloadDoForm,
  promptParaLinhaCsv,
  promptParaTextoCopiavel,
  splitLista,
  variavelDoBanco,
} from "./logic";

const base: PromptModelo = {
  id: "p1",
  titulo: "Radar de fornecedor",
  descricao: "Analisa concentração de contratos.",
  prompt_template: "Você vai analisar {{csv}}.",
  variaveis: [{ nome: "csv", dica: null, href: null, hrefLabel: null }],
  tags: ["fornecedor", "cnpj"],
  ordem: 2,
  ativo: true,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("promptParaLinhaCsv", () => {
  it("achata variáveis e tags e traduz ativo", () => {
    const l = promptParaLinhaCsv(base);
    expect(l.variaveis).toBe("csv");
    expect(l.tags).toBe("fornecedor | cnpj");
    expect(l.ativo).toBe("sim");
  });
  it("tolera variável em formato legado (string)", () => {
    const l = promptParaLinhaCsv({
      ...base,
      variaveis: ["antiga"] as unknown as PromptModelo["variaveis"],
    });
    expect(l.variaveis).toBe("antiga");
  });
});

describe("splitLista", () => {
  it("separa e limpa", () => {
    expect(splitLista("a, b ,, c")).toEqual(["a", "b", "c"]);
  });
});

describe("variavelDoBanco", () => {
  it("tolera formato legado (string)", () => {
    expect(variavelDoBanco("csv")).toEqual({ nome: "csv", dica: "", href: "", hrefLabel: "" });
  });
  it("lê o formato estruturado", () => {
    expect(variavelDoBanco({ nome: "x", dica: "d", href: "/h", hrefLabel: "L" })).toEqual({
      nome: "x",
      dica: "d",
      href: "/h",
      hrefLabel: "L",
    });
  });
});

describe("payloadDoForm / formFromPrompt", () => {
  it("monta o payload limpando variáveis sem nome e as tags", () => {
    const p = payloadDoForm({
      ...FORM_VAZIO,
      titulo: " T ",
      prompt_template: " corpo ",
      tags: "a, b",
      variaveis: [
        { nome: " csv ", dica: " d ", href: "", hrefLabel: "" },
        { nome: "", dica: "x", href: "", hrefLabel: "" },
      ],
    });
    expect(p.titulo).toBe("T");
    expect(p.prompt_template).toBe("corpo");
    expect(p.tags).toEqual(["a", "b"]);
    expect(p.variaveis).toEqual([{ nome: "csv", dica: "d", href: null, hrefLabel: null }]);
  });
  it("formFromPrompt faz o caminho de volta", () => {
    const f = formFromPrompt(base);
    expect(f.titulo).toBe(base.titulo);
    expect(f.tags).toBe("fornecedor, cnpj");
    expect(f.variaveis[0].nome).toBe("csv");
  });
});

describe("formPromptValido", () => {
  it("exige título >= 5 e template >= 10", () => {
    expect(
      formPromptValido({ ...FORM_VAZIO, titulo: "abcde", prompt_template: "1234567890" }),
    ).toBe(true);
    expect(formPromptValido({ ...FORM_VAZIO, titulo: "abc", prompt_template: "1234567890" })).toBe(
      false,
    );
  });
});

describe("transforms de variáveis", () => {
  it("adiciona, atualiza e remove", () => {
    let f = comVariavelAdicionada(FORM_VAZIO);
    expect(f.variaveis).toHaveLength(1);
    f = comVariavelAtualizada(f, 0, { nome: "csv" });
    expect(f.variaveis[0].nome).toBe("csv");
    f = comVariavelRemovida(f, 0);
    expect(f.variaveis).toHaveLength(0);
  });
});

describe("filtrarPrompts / contarPrompts", () => {
  const lista = [base, { ...base, id: "p2", ativo: false }];
  it("filtra por ativo", () => {
    expect(filtrarPrompts(lista, "ativos").map((p) => p.id)).toEqual(["p1"]);
    expect(filtrarPrompts(lista, "inativos").map((p) => p.id)).toEqual(["p2"]);
    expect(filtrarPrompts(lista, "tudo")).toHaveLength(2);
  });
  it("conta por status", () => {
    expect(contarPrompts(lista)).toEqual({ tudo: 2, ativos: 1, inativos: 1 });
  });
});

describe("promptParaTextoCopiavel", () => {
  it("prefixa a descrição e inclui o template", () => {
    expect(promptParaTextoCopiavel(base)).toBe(
      "Analisa concentração de contratos.\n\nVocê vai analisar {{csv}}.",
    );
  });
  it("sem descrição devolve só o template", () => {
    expect(promptParaTextoCopiavel({ ...base, descricao: null })).toBe(
      "Você vai analisar {{csv}}.",
    );
  });
});
