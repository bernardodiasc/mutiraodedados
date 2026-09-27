import type { ComponentProps } from "react";
import type { AprendaAInvestigarView } from "@/components/AprendaAInvestigarView";
import type { ViewVariants } from "@/lib/style-guide/registry";

export const aprendaAInvestigarVariants: ViewVariants<
  ComponentProps<typeof AprendaAInvestigarView>
> = [
  {
    label: "com artigos",
    props: {
      artigos: [
        {
          titulo: "Da licitação ao contrato: encontre os documentos",
          resumo:
            "Como sair de uma licitação e chegar ao contrato assinado, com número de processo e CNPJ.",
          categoria: "mapa",
          href: "/mapas/contrato-federal-pncp",
        },
        {
          titulo: "Por que uma busca sem resultados não encerra a investigação",
          resumo: null,
          categoria: "nota",
          href: "/notas/busca-sem-resultados",
        },
      ],
    },
  },
  { label: "nenhum artigo (não renderiza)", props: { artigos: [] } },
];
