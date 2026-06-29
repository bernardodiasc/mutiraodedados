import type { ViewVariants } from "@/lib/style-guide/registry";
import type { QualidadeBannerViewProps } from "./logic";

const base: QualidadeBannerViewProps = {
  findingsCount: 1,
  principalFinding: {
    id: "finding-1",
    status: "aberto",
    regra: "valor_unitario_anomalo",
  },
  isLoading: false,
};

export const qualidadeBannerVariants: ViewVariants<QualidadeBannerViewProps> = [
  {
    label: "com um achado aberto",
    props: base,
  },
  {
    label: "com múltiplos achados (divergência confirmada)",
    props: {
      ...base,
      findingsCount: 3,
      principalFinding: {
        id: "finding-2",
        status: "confirmado",
        regra: "aditivo_excedente",
      },
    },
  },
  {
    label: "carregando",
    props: {
      ...base,
      isLoading: true,
      principalFinding: null,
      findingsCount: 0,
    },
  },
  {
    label: "sem inconsistências (não deve renderizar nada)",
    props: {
      ...base,
      findingsCount: 0,
      principalFinding: null,
    },
  },
];
