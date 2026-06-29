import type { ViewVariants } from "@/lib/style-guide/registry";
import type { InvestigacaoInlineViewProps } from "@/components/InvestigacaoInlineView";
import type { AnomaliaInput } from "@/lib/anomalia";

const noop = () => {};

const finding: AnomaliaInput = {
  id: "f-1",
  origem: "qa",
  fonte: "cgu",
  severidade: "aviso",
  status: "aberto",
  regra: "fornecedor_sem_cnpj",
  resumo: "Fornecedor sem CNPJ registrado em contrato vigente.",
  entidade: { tipo: "contrato", id: "9/2026", rotulo: "Contrato 9/2026" },
  trilha: [],
  detectado_em: "2026-05-10T12:00:00Z",
};

const childCard = (
  <div className="text-sm">
    <div className="font-semibold">Contrato 9/2026</div>
    <div className="text-muted-foreground">Acme Suprimentos · R$ 120.000,00</div>
  </div>
);

const base: InvestigacaoInlineViewProps = {
  children: childCard,
  isLoading: false,
  finding: null,
  promovendo: false,
  onPromover: noop,
};

export const investigacaoInlineVariants: ViewVariants<InvestigacaoInlineViewProps> = [
  { label: "carregando", props: { ...base, isLoading: true } },
  { label: "sem finding / botão promover", props: base },
  { label: "promovendo…", props: { ...base, promovendo: true } },
  { label: "com finding", props: { ...base, finding } },
];