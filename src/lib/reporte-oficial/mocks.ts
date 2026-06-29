import type { ViewVariants } from "@/lib/style-guide/registry";
import type { ReporteOficialModalViewProps } from "@/components/ReporteOficialModalView";
import type { AnomaliaInput } from "@/lib/anomalia";
import { QA_CANAIS } from "@/lib/data/qa-canais";

const noop = () => {};

const anomalia: AnomaliaInput = {
  id: "A1",
  origem: "qa",
  fonte: "cgu",
  severidade: "critico",
  status: "aberto",
  regra: "valor_acima_do_teto",
  resumo: "Contrato por dispensa acima do teto legal.",
  entidade: {
    tipo: "contrato",
    id: "12/2025",
    rotulo: "Contrato 12/2025",
    url_oficial: "https://portaldatransparencia.gov.br/contratos/12-2025",
  },
  trilha: [],
  detectado_em: "2026-05-20T10:00:00Z",
};

const base: ReporteOficialModalViewProps = {
  open: true,
  onOpenChange: noop,
  anomalia,
  canal: QA_CANAIS.cgu,
  assunto: "Possível inconsistência no Portal da Transparência",
  onAssuntoChange: noop,
  corpo: "Prezados,\n\nIdentifiquei uma divergência…",
  onCorpoChange: noop,
  protocolo: "",
  onProtocoloChange: noop,
  identificacao: "Tipo: contrato\nID: 12/2025\nURL: https://portaldatransparencia.gov.br/contratos/12-2025",
  busy: false,
  onSubmit: noop,
  onCopiar: noop,
};

export const reporteOficialVariants: ViewVariants<ReporteOficialModalViewProps> = [
  { label: "canal CGU", props: base },
  { label: "enviando", props: { ...base, busy: true } },
  { label: "canal não catalogado", props: { ...base, canal: null } },
];