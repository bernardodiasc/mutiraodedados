import type { ViewVariants } from "@/lib/style-guide/registry";
import type { AnomaliaInvestigacaoViewProps } from "./types";
import type { AnomaliaInput } from "@/lib/anomalia";

const noop = () => {};
const noopAsync = async () => {};

const baseAnomalia: AnomaliaInput = {
  id: "mock-anomalia-1",
  origem: "qa",
  fonte: "portal-cgu",
  severidade: "critico",
  status: "aberto",
  regra: "valor_acima_do_limite_dispensa",
  resumo:
    "Contrato firmado por dispensa com valor R$ 250.000, acima do teto de R$ 50.000 (Lei 14.133).",
  entidade: {
    tipo: "contrato",
    id: "12/2025",
    rotulo: "Contrato 12/2025 — Acme Suprimentos",
    url_interno: "/contratos/c-001",
    url_oficial: "https://portaldatransparencia.gov.br/contratos",
  },
  comparacao: {
    armazenado: 250_000,
    esperado: 50_000,
    armazenadoLabel: "Valor do contrato",
    esperadoLabel: "Teto da dispensa",
    observacao: "Teto vigente para serviços comuns nesta modalidade.",
  },
  trilha: [
    {
      em: "2026-05-20T10:00:00Z",
      tipo: "deteccao",
      descricao: "Heurística detectou valor acima do teto.",
    },
    {
      em: "2026-05-20T10:05:00Z",
      tipo: "promovido",
      descricao: "Promovido para investigação.",
    },
  ],
  detectado_em: "2026-05-20T10:00:00Z",
};

const commonView = {
  nota: "",
  onNotaChange: noop,
  busy: null as string | null,
  onRun: noop,
  modalAberto: false,
  onModalOpenChange: noop,
};

export const anomaliaInvestigacaoVariants: ViewVariants<AnomaliaInvestigacaoViewProps> = [
  {
    label: "admin / aberto / crítico",
    props: {
      anomalia: baseAnomalia,
      modo: "admin",
      actions: {
        onConfirmar: noopAsync,
        onReportar: async () => {},
        onMarcarCorrigido: noopAsync,
        onMarcarFalsoPositivo: noopAsync,
        onSalvarNota: async () => {},
      },
      ...commonView,
    },
  },
  {
    label: "público / sem ações",
    props: {
      anomalia: { ...baseAnomalia, severidade: "aviso", status: "confirmado" },
      modo: "publico",
      ...commonView,
    },
  },
  {
    label: "flush / dentro de outro card",
    props: {
      anomalia: { ...baseAnomalia, severidade: "info", status: "corrigido_origem" },
      modo: "admin",
      flush: true,
      ...commonView,
    },
  },
];