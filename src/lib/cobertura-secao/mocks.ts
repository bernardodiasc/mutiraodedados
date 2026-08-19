import type { FonteCobertura } from "@/lib/data/cobertura-publica.functions";
import type { ViewVariants } from "@/lib/style-guide/registry";
import type { CoberturaResumo, FonteCard } from "@/components/CoberturaSecao";
import type { ComponentProps } from "react";

const HOJE = "2026-06-15T12:00:00Z";

const fonteMes: FonteCobertura = {
  id: "pncp-contratos",
  titulo: "PNCP — contratos",
  descricao: "Contratos publicados no Portal Nacional de Contratações Públicas.",
  granularidade: "mes",
  totalRegistros: 12480,
  ultimaAtualizacao: "2026-06-10T03:00:00Z",
  primeiraData: "2023-01-01",
  ultimaData: "2026-06-10",
  porAno: [
    { ano: 2023, qtd: 3200 },
    { ano: 2024, qtd: 4100 },
    { ano: 2025, qtd: 3900 },
    { ano: 2026, qtd: 1280 },
  ],
  porAnoMes: [
    ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((mes) => ({
      ano: 2025,
      mes,
      qtd: 200 + mes * 20,
    })),
    ...[1, 2, 3, 4, 5, 6].map((mes) => ({ ano: 2026, mes, qtd: 180 + mes * 15 })),
  ],
  mesesAnoCorrente: [1, 2, 3, 4, 5, 6],
  rota: "/pncp",
};

const fonteAno: FonteCobertura = {
  id: "siconfi-dca",
  titulo: "Siconfi — DCA",
  descricao: "Declaração de Contas Anuais (granularidade anual).",
  granularidade: "ano",
  totalRegistros: 5570,
  ultimaAtualizacao: "2026-04-01T10:00:00Z",
  primeiraData: "2022-01-01",
  ultimaData: "2025-12-31",
  porAno: [
    { ano: 2022, qtd: 1300 },
    { ano: 2023, qtd: 1400 },
    { ano: 2024, qtd: 1450 },
    { ano: 2025, qtd: 1420 },
  ],
  porAnoMes: [],
  mesesAnoCorrente: [],
  rota: "/relatorios-fiscais",
};

const fonteSemDados: FonteCobertura = {
  id: "fonte-vazia",
  titulo: "Fonte sem dados",
  descricao: "Exemplo de fonte cadastrada porém ainda sem importação concluída.",
  granularidade: "mes",
  totalRegistros: 0,
  ultimaAtualizacao: null,
  primeiraData: null,
  ultimaData: null,
  porAno: [],
  porAnoMes: [],
  mesesAnoCorrente: [],
};

const cobertura = {
  anoCorrente: 2026,
  geradoEm: HOJE,
  fontes: [fonteMes, fonteAno, fonteSemDados],
};

export const coberturaResumoVariants: ViewVariants<ComponentProps<typeof CoberturaResumo>> = [
  { label: "default", props: { cobertura } },
  {
    label: "tudo vazio",
    props: { cobertura: { ...cobertura, fontes: [fonteSemDados] } },
  },
];

export const fonteCardVariants: ViewVariants<ComponentProps<typeof FonteCard>> = [
  { label: "mensal · compact", props: { fonte: fonteMes, anoCorrente: 2026, variant: "compact" } },
  {
    label: "mensal · full (heatmap)",
    props: { fonte: fonteMes, anoCorrente: 2026, variant: "full" },
  },
  { label: "anual", props: { fonte: fonteAno, anoCorrente: 2026, variant: "compact" } },
  { label: "sem dados", props: { fonte: fonteSemDados, anoCorrente: 2026, variant: "compact" } },
];
