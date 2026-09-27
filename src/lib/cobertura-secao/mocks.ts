import type { FonteCobertura } from "@/lib/data/cobertura-publica.functions";
import type { ViewVariants } from "@/lib/style-guide/registry";
import type { CoberturaResumo, FonteCard } from "@/components/CoberturaSecao";
import type { ComponentProps } from "react";
import {
  resumirJanelas,
  type EstadoCobertura,
  type EstadosDaFonte,
} from "@/lib/data/cobertura-estado";

/** Estados de exemplo: uma célula por (ano, mês), na ordem dada. */
function estados(
  celulas: { ano: number; mes: number; estado: EstadoCobertura }[],
  extra: Partial<EstadosDaFonte> = {},
): EstadosDaFonte {
  return {
    universoEnumerado: true,
    resumo: resumirJanelas(celulas.map((c) => c.estado)),
    celulas: celulas.map((c) => ({ escopo: "", ...c })),
    ultimaImportacaoValida: "2026-06-10T03:00:00Z",
    desatualizada: false,
    ...extra,
  };
}

const ESTADOS_2025: EstadoCobertura[] = [
  "concluido",
  "concluido",
  "concluido_sem_total",
  "vazio_confirmado",
  "concluido",
  "parcial",
  "concluido",
  "erro",
  "concluido",
  "indisponivel",
  "concluido",
  "concluido",
];
const ESTADOS_2026: EstadoCobertura[] = [
  "concluido",
  "concluido",
  "parcial",
  "processando",
  "nao_consultado",
  "nao_consultado",
];

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
  estados: estados([
    ...ESTADOS_2025.map((estado, i) => ({ ano: 2025, mes: i + 1, estado })),
    ...ESTADOS_2026.map((estado, i) => ({ ano: 2026, mes: i + 1, estado })),
  ]),
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
  estados: estados(
    [2022, 2023, 2024, 2025].map((ano) => ({ ano, mes: 0, estado: "concluido_sem_total" })),
    {
      universoEnumerado: false,
      ultimaImportacaoValida: "2025-01-10T10:00:00Z",
      desatualizada: true,
    },
  ),
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
  estados: estados(
    [2025, 2026].flatMap((ano) =>
      [1, 2, 3].map((mes) => ({ ano, mes, estado: "nao_consultado" as const })),
    ),
    { ultimaImportacaoValida: null, desatualizada: true },
  ),
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
