import { Building2, HandCoins } from "lucide-react";
import type { ViewVariants } from "@/lib/style-guide/registry";
import type { SecaoVinculosProps } from "@/components/SecaoVinculos";

export const secaoVinculosVariants: ViewVariants<SecaoVinculosProps> = [
  {
    label: "vínculos internos com valor",
    props: {
      titulo: "Doadores que são fornecedores federais",
      icone: HandCoins,
      descricao:
        "CNPJs que doaram para esta campanha e também aparecem como fornecedores do governo federal.",
      itens: [
        {
          chave: "cnpj-00000000000191",
          titulo: "BANCO DO BRASIL SA",
          subtitulo: "00.000.000/0001-91",
          valorFmt: "R$ 50.000,00",
          to: "/fornecedores/$cnpj",
          params: { cnpj: "00.000.000/0001-91" },
        },
      ],
      verTodos: { label: "Ver todos os contratos deste fornecedor", to: "/contratos" },
    },
  },
  {
    label: "match deduzido por nome (aviso)",
    props: {
      titulo: "Autor da emenda",
      icone: Building2,
      itens: [
        {
          chave: "dep-1",
          titulo: "José da Silva",
          subtitulo: "Deputado federal · Câmara",
          to: "/camara/deputados/$id",
          params: { id: "1" },
          inferido: true,
        },
      ],
    },
  },
  {
    label: "sem vínculo (não renderiza nada)",
    props: { titulo: "Licitações deste órgão", icone: Building2, itens: [] },
  },
];
