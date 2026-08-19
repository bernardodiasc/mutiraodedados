export const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export const fmtNum = (v: number) => v.toLocaleString("pt-BR");

export const fmtPct = (v: number) => `${(v * 100).toFixed(1).replace(".", ",")}%`;
