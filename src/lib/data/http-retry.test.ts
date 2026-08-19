import { describe, it, expect } from "vitest";
import {
  atrasoDaTentativa,
  atrasoDoRetryAfter,
  ehStatusTransitorio,
  fetchComRetry,
  RETRY_PADRAO,
} from "./http-retry";

const semJitter = { ...RETRY_PADRAO, jitter: false };

/** Resposta mínima com o que o wrapper lê: ok, status e headers. */
function resposta(status: number, headers: Record<string, string> = {}): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (h: string) => headers[h.toLowerCase()] ?? null },
  } as unknown as Response;
}

describe("http-retry/status transitório", () => {
  it("429 e 5xx são transitórios", () => {
    expect(ehStatusTransitorio(429)).toBe(true);
    expect(ehStatusTransitorio(500)).toBe(true);
    expect(ehStatusTransitorio(503)).toBe(true);
  });

  it("4xx comum e 2xx não são", () => {
    expect(ehStatusTransitorio(200)).toBe(false);
    expect(ehStatusTransitorio(400)).toBe(false);
    expect(ehStatusTransitorio(401)).toBe(false);
    expect(ehStatusTransitorio(404)).toBe(false);
  });
});

describe("http-retry/backoff", () => {
  it("a primeira tentativa não espera", () => {
    expect(atrasoDaTentativa(1, semJitter)).toBe(0);
  });

  it("cresce por fator: 500 → 1500 → 4500", () => {
    expect(atrasoDaTentativa(2, semJitter)).toBe(500);
    expect(atrasoDaTentativa(3, semJitter)).toBe(1500);
    expect(atrasoDaTentativa(4, semJitter)).toBe(4500);
  });

  it("respeita o teto", () => {
    expect(atrasoDaTentativa(10, { ...semJitter, tetoMs: 2000 })).toBe(2000);
  });

  it("jitter fica na faixa de ±25%", () => {
    expect(atrasoDaTentativa(2, RETRY_PADRAO, () => 0)).toBe(375);
    expect(atrasoDaTentativa(2, RETRY_PADRAO, () => 1)).toBe(625);
    expect(atrasoDaTentativa(2, RETRY_PADRAO, () => 0.5)).toBe(500);
  });
});

describe("http-retry/Retry-After", () => {
  it("aceita segundos", () => {
    expect(atrasoDoRetryAfter("30", 0)).toBe(30_000);
  });

  it("aceita data HTTP e devolve o intervalo até ela", () => {
    const agora = Date.parse("2026-08-19T12:00:00Z");
    expect(atrasoDoRetryAfter("Wed, 19 Aug 2026 12:00:10 GMT", agora)).toBe(10_000);
  });

  it("nunca devolve negativo para data no passado", () => {
    const agora = Date.parse("2026-08-19T12:00:00Z");
    expect(atrasoDoRetryAfter("Wed, 19 Aug 2026 11:59:00 GMT", agora)).toBe(0);
  });

  it("ignora valor ausente ou sem sentido", () => {
    expect(atrasoDoRetryAfter(null, 0)).toBeNull();
    expect(atrasoDoRetryAfter("depois", 0)).toBeNull();
  });
});

describe("http-retry/fetchComRetry", () => {
  const semEspera = { sleepImpl: async () => {}, politica: { jitter: false } };

  it("devolve na primeira tentativa quando dá certo", async () => {
    let chamadas = 0;
    const res = await fetchComRetry("u", undefined, {
      ...semEspera,
      fetchImpl: async () => {
        chamadas++;
        return resposta(200);
      },
    });
    expect(res.status).toBe(200);
    expect(chamadas).toBe(1);
  });

  it("insiste em 503 e devolve o sucesso seguinte", async () => {
    let chamadas = 0;
    const res = await fetchComRetry("u", undefined, {
      ...semEspera,
      fetchImpl: async () => {
        chamadas++;
        return chamadas < 3 ? resposta(503) : resposta(200);
      },
    });
    expect(res.status).toBe(200);
    expect(chamadas).toBe(3);
  });

  it("não insiste em 404 — erro definitivo volta na hora", async () => {
    let chamadas = 0;
    const res = await fetchComRetry("u", undefined, {
      ...semEspera,
      fetchImpl: async () => {
        chamadas++;
        return resposta(404);
      },
    });
    expect(res.status).toBe(404);
    expect(chamadas).toBe(1);
  });

  it("esgotando as tentativas, devolve a última resposta ruim", async () => {
    let chamadas = 0;
    const res = await fetchComRetry("u", undefined, {
      ...semEspera,
      fetchImpl: async () => {
        chamadas++;
        return resposta(503);
      },
    });
    expect(res.status).toBe(503);
    expect(chamadas).toBe(RETRY_PADRAO.tentativas);
  });

  it("insiste em erro de rede e devolve o sucesso seguinte", async () => {
    let chamadas = 0;
    const res = await fetchComRetry("u", undefined, {
      ...semEspera,
      fetchImpl: async () => {
        chamadas++;
        if (chamadas < 2) throw new Error("ECONNRESET");
        return resposta(200);
      },
    });
    expect(res.status).toBe(200);
    expect(chamadas).toBe(2);
  });

  it("lança quando toda tentativa falhou na rede", async () => {
    await expect(
      fetchComRetry("u", undefined, {
        ...semEspera,
        fetchImpl: async () => {
          throw new Error("ECONNRESET");
        },
      }),
    ).rejects.toThrow("ECONNRESET");
  });

  it("prefere o Retry-After do servidor ao backoff calculado", async () => {
    const esperas: number[] = [];
    let chamadas = 0;
    await fetchComRetry("u", undefined, {
      politica: { jitter: false },
      sleepImpl: async (ms) => {
        esperas.push(ms);
      },
      agora: () => 0,
      fetchImpl: async () => {
        chamadas++;
        return chamadas < 2 ? resposta(429, { "retry-after": "7" }) : resposta(200);
      },
    });
    expect(esperas).toEqual([7000]);
  });

  it("tentativas: 1 desliga o retry", async () => {
    let chamadas = 0;
    const res = await fetchComRetry("u", undefined, {
      ...semEspera,
      politica: { tentativas: 1 },
      fetchImpl: async () => {
        chamadas++;
        return resposta(503);
      },
    });
    expect(res.status).toBe(503);
    expect(chamadas).toBe(1);
  });
});
