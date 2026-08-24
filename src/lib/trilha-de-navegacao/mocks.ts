import type { ViewVariants } from "@/lib/style-guide/registry";
import type { ComponentProps } from "react";
import type { TrilhaDeNavegacao } from "@/components/TrilhaDeNavegacao";

export const trilhaDeNavegacaoVariants: ViewVariants<ComponentProps<typeof TrilhaDeNavegacao>> = [
  {
    label: "detalhe de contrato",
    props: {
      itens: [{ label: "Contratos", to: "/contratos" }, { label: "Contrato 123456" }],
    },
  },
  {
    label: "subnível do parlamento",
    props: {
      itens: [
        { label: "Câmara dos Deputados", to: "/camara" },
        { label: "Deputados federais", to: "/camara/deputados" },
        { label: "Ficha do deputado" },
      ],
    },
  },
];
