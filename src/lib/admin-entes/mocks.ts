import type { AdminEntesViewProps } from "@/components/AdminEntesView";
import type { ViewVariants } from "@/lib/style-guide/registry";

const noop = () => {};

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const base: AdminEntesViewProps = {
  ano: 2026,
  mes: 5,
  setAno: noop,
  setMes: noop,
  anos: [2026, 2025, 2024, 2023],
  meses: MESES,
  ini: "2026-05-01",
  fim: "2026-05-31",
  ibge: "",
  setIbge: noop,
  tipoRel: "RREO",
  setTipoRel: noop,
  periodo: 1,
  exer: 2026,
  setExer: noop,
  ocupado: false,
  busy: () => false,
  progressoFontes: {},
  onCancelarFonte: noop,
  onImportPncp: noop,
  onImportSiconfi: noop,
  onImportSiconfiConjunto: noop,
  onImportTransferegov: noop,
  onImportIbge: noop,
  onEnriquecerOrigem: noop,
  conjunto: "ufs",
  setConjunto: noop,
  ufVarredura: "",
  setUfVarredura: noop,
  exIni: 2013,
  setExIni: noop,
  exFim: 2026,
  setExFim: noop,
  progresso: null,
  onVarrerSiconfi: noop,
  onCancelarVarredura: noop,
};

export const adminEntesVariants: ViewVariants<AdminEntesViewProps> = [
  { label: "padrão (nada selecionado)", props: base },
  {
    label: "ente selecionado",
    props: { ...base, ibge: "3550308", exer: 2024 },
  },
  {
    label: "varredura por municípios de uma UF",
    props: { ...base, conjunto: "municipios", ufVarredura: "SP", exIni: 2024, exFim: 2026 },
  },
  {
    label: "varredura em andamento",
    props: {
      ...base,
      ocupado: true,
      busy: (k: string) => k === "Varredura SICONFI",
      progresso: {
        consultas: 1420,
        total: 3780,
        percentual: 38,
        importados: 184_302,
        semDados: 311,
      },
    },
  },
  {
    // O caso que motivou a barra: origem fora do ar, laço girando sem avançar.
    label: "PNCP travado na origem",
    props: {
      ...base,
      ocupado: true,
      busy: (k: string) => k === "PNCP",
      progressoFontes: {
        PNCP: {
          rodada: 2,
          importados: 0,
          cursor: 1,
          erro: "p1: TRANSIENT: PNCP 504 (serviço indisponível)",
        },
      },
    },
  },
  {
    label: "varredura concluída",
    props: {
      ...base,
      progresso: {
        consultas: 3780,
        total: 3780,
        percentual: 100,
        importados: 502_115,
        semDados: 894,
      },
    },
  },
];
