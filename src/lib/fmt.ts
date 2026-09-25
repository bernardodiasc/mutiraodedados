/** `null`/`undefined` = valor não informado pela fonte — nunca vira R$ 0,00. */
export const fmtBRL = (v: number | null | undefined) =>
  v == null
    ? "Não informado"
    : v.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

export const fmtNum = (v: number) => v.toLocaleString("pt-BR");

export const fmtPct = (v: number) => `${(v * 100).toFixed(1).replace(".", ",")}%`;
