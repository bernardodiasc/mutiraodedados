import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { carregarH1 } from "./loader";

type Registro = { nome: string } | null;

function novoClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

describe("carregarH1", () => {
  it("devolve o H1 derivado do dado carregado", async () => {
    const r = await carregarH1<Registro>(novoClient(), {
      queryKey: ["registro", 1],
      queryFn: async () => ({ nome: "Ministério da Saúde" }),
      h1: (d) => d.nome,
    });
    expect(r).toEqual({ h1: "Ministério da Saúde" });
  });

  it("devolve h1 nulo quando o dado não existe, sem chamar a função de H1", async () => {
    let chamou = false;
    const r = await carregarH1<Registro>(novoClient(), {
      queryKey: ["registro", 2],
      queryFn: async () => null,
      h1: () => {
        chamou = true;
        return "não deveria";
      },
    });
    expect(r).toEqual({ h1: null });
    expect(chamou).toBe(false);
  });

  it("devolve h1 nulo quando a consulta falha", async () => {
    const r = await carregarH1<Registro>(novoClient(), {
      queryKey: ["registro", 3],
      queryFn: async () => {
        throw new Error("fora do ar");
      },
      h1: (d) => d.nome,
    });
    expect(r).toEqual({ h1: null });
  });

  it("deixa o dado no cache sob a queryKey, para o componente reaproveitar", async () => {
    const qc = novoClient();
    await carregarH1<Registro>(qc, {
      queryKey: ["registro", 4],
      queryFn: async () => ({ nome: "Prefeitura de Recife" }),
      h1: (d) => d.nome,
    });
    expect(qc.getQueryData(["registro", 4])).toEqual({ nome: "Prefeitura de Recife" });
  });
});
