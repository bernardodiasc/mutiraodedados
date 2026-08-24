import type { ViewVariants } from "@/lib/style-guide/registry";
import { Building2 } from "lucide-react";
import type { ComponentProps } from "react";
import { CampoDado, Cartao, Estatistica } from "@/components/Cartao";

export const cartaoVariants: ViewVariants<ComponentProps<typeof Cartao>> = [
  {
    label: "com título e ícone",
    props: {
      titulo: "Órgão contratante",
      icone: Building2,
      children: "Ministério da Saúde — 26000",
    },
  },
  { label: "sem título", props: { children: "Conteúdo livre do cartão." } },
];

export const estatisticaVariants: ViewVariants<ComponentProps<typeof Estatistica>> = [
  { label: "valor monetário", props: { rotulo: "Valor", valor: "R$ 1.234.567,00" } },
  {
    label: "com detalhe",
    props: { rotulo: "Assinado em", valor: "12/03/2024", detalhe: "vigência até 12/03/2026" },
  },
];

export const campoDadoVariants: ViewVariants<ComponentProps<typeof CampoDado>> = [
  { label: "texto simples", props: { rotulo: "Modalidade", children: "Pregão eletrônico" } },
  { label: "valor ausente", props: { rotulo: "Situação", children: "—" } },
];
