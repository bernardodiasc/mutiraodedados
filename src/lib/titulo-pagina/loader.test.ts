import { QueryClient } from "@tanstack/react-query";
import { isNotFound } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";
import { carregarFicha } from "./loader";

type Registro = { nome: string } | null;

function novoClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

describe("carregarFicha", () => {
  it("devolve o registro e o H1 derivado dele", async () => {
    const r = await carregarFicha<Registro>(novoClient(), {
      queryKey: ["registro", 1],
      queryFn: async () => ({ nome: "Ministério da Saúde" }),
      h1: (d) => d.nome,
    });
    expect(r).toEqual({ dado: { nome: "Ministério da Saúde" }, h1: "Ministério da Saúde" });
  });

  it("lança notFound quando o registro não existe, sem chamar a função de H1", async () => {
    let chamou = false;
    const erro = await carregarFicha<Registro>(novoClient(), {
      queryKey: ["registro", 2],
      queryFn: async () => null,
      h1: () => {
        chamou = true;
        return "não deveria";
      },
    }).catch((e: unknown) => e);
    expect(isNotFound(erro)).toBe(true);
    expect(chamou).toBe(false);
  });

  it("deixa a falha da consulta subir para o errorComponent", async () => {
    await expect(
      carregarFicha<Registro>(novoClient(), {
        queryKey: ["registro", 3],
        queryFn: async () => {
          throw new Error("fora do ar");
        },
        h1: (d) => d.nome,
      }),
    ).rejects.toThrow("fora do ar");
  });

  it("reaproveita o registro do cache em navegações seguintes", async () => {
    const qc = novoClient();
    let chamadas = 0;
    const opts = {
      queryKey: ["registro", 4],
      queryFn: async () => {
        chamadas++;
        return { nome: "Prefeitura de Recife" };
      },
      h1: (d: { nome: string }) => d.nome,
    };
    await carregarFicha<Registro>(qc, opts);
    await carregarFicha<Registro>(qc, opts);
    expect(chamadas).toBe(1);
  });
});
