import { describe, expect, it } from "vitest";
import { mapearConvenioCache } from "@/lib/data/real/convenio-row";

describe("mapearConvenioCache — valores ausentes", () => {
  it('"-" da CGU vira null (não localizado não é zero); valor informado passa', () => {
    const row = mapearConvenioCache({
      id: 123,
      valor: "1.000,00",
      valorLiberado: "-",
      valorContrapartida: null,
    });
    expect(row).toMatchObject({ valor: 1000, valor_liberado: null, valor_contrapartida: null });
  });

  it("zero explícito continua zero", () => {
    const row = mapearConvenioCache({ id: 1, valor: 0, valorLiberado: "0,00" });
    expect(row).toMatchObject({ valor: 0, valor_liberado: 0 });
  });
});
