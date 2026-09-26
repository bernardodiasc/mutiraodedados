import { describe, expect, it } from "vitest";
import { funcaoRpcAusente, mensagemColunaAusente, textoDoErroDoBanco } from "./erros-banco";

describe("funcaoRpcAusente", () => {
  it("reconhece o PGRST202 do PostgREST", () => {
    expect(
      funcaoRpcAusente({
        code: "PGRST202",
        message: "Could not find the function public.truncar_cache(_tabela) in the schema cache",
      }),
    ).toBe(true);
  });

  it("reconhece pela mensagem, mesmo sem o code", () => {
    expect(
      funcaoRpcAusente({ message: "Could not find the function public.truncar_cache(_tabela)" }),
    ).toBe(true);
    expect(funcaoRpcAusente({ message: "function public.foo(text) does not exist" })).toBe(true);
  });

  it("não confunde com outros erros — o fallback não pode mascarar falha real", () => {
    expect(funcaoRpcAusente(null)).toBe(false);
    expect(funcaoRpcAusente({ code: "42501", message: "permission denied for function" })).toBe(
      false,
    );
    expect(funcaoRpcAusente({ message: "canceling statement due to statement timeout" })).toBe(
      false,
    );
    expect(funcaoRpcAusente({ message: "tabela x não é um cache de importação limpável" })).toBe(
      false,
    );
  });
});

describe("mensagemColunaAusente", () => {
  it("reconhece o erro de cache de esquema do PostgREST", () => {
    const m = mensagemColunaAusente(
      "tse_bens_candidato_cache",
      "Could not find the 'tipo_bem_cod' column of 'tse_bens_candidato_cache' in the schema cache",
    );
    expect(m).toContain('a coluna "tipo_bem_cod" ainda não existe');
    expect(m).toContain("supabase db push");
  });

  it("reconhece o 42703 cru do Postgres, com e sem prefixo de tabela", () => {
    expect(
      mensagemColunaAusente("t", "column tse_bens_candidato_cache.tipo_bem_cod does not exist"),
    ).toContain('"tipo_bem_cod"');
    expect(mensagemColunaAusente("t", 'column "titulo_eleitoral" does not exist')).toContain(
      '"titulo_eleitoral"',
    );
  });

  it("devolve null em qualquer outro erro, para não mascarar a causa real", () => {
    expect(mensagemColunaAusente("t", "canceling statement due to statement timeout")).toBeNull();
    expect(mensagemColunaAusente("t", "duplicate key value violates unique constraint")).toBeNull();
    expect(mensagemColunaAusente("t", "")).toBeNull();
  });

  it("nomeia a tabela que o chamador passou", () => {
    expect(mensagemColunaAusente("minha_tabela", "Could not find the 'x' column")).toMatch(
      /^minha_tabela:/,
    );
  });
});

describe("textoDoErroDoBanco", () => {
  it("traz o código e a mensagem do banco, como o tempo-limite da consulta", () => {
    expect(
      textoDoErroDoBanco(
        {
          code: "57014",
          details: null,
          hint: null,
          message: "canceling statement due to statement timeout",
        },
        500,
      ),
    ).toBe("57014: canceling statement due to statement timeout");
  });

  it("junta detalhe e dica quando vêm", () => {
    expect(
      textoDoErroDoBanco({ code: "42P01", message: "relação não existe", details: "d", hint: "h" }),
    ).toBe("42P01: relação não existe (d; h)");
  });

  it("nunca sai vazio: sem corpo, fica o status HTTP", () => {
    expect(textoDoErroDoBanco({ message: "" }, 500)).toBe("HTTP 500, resposta sem corpo");
    expect(textoDoErroDoBanco({ message: "" })).toBe("resposta sem corpo");
  });
});
