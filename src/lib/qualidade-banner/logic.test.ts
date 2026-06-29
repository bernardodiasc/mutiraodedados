import { describe, it, expect } from "vitest";
import { obterRotuloStatus } from "./logic";

describe("obterRotuloStatus", () => {
  it("retorna o rótulo amigável correto para status conhecidos", () => {
    expect(obterRotuloStatus("aberto")).toBe("em análise");
    expect(obterRotuloStatus("confirmado")).toBe("divergência confirmada");
    expect(obterRotuloStatus("reportado")).toBe("reportada ao órgão");
  });

  it("devolve a própria string se o status for desconhecido", () => {
    expect(obterRotuloStatus("outro_status")).toBe("outro_status");
  });
});
