import type { ViewVariants } from "@/lib/style-guide/registry";
import type { DoacoesEleitoraisViewProps } from "@/components/DoacoesEleitoraisView";

const base: DoacoesEleitoraisViewProps = {
  estado: "pronto",
  total: 185000,
  itens: [
    {
      sq: "10001642313",
      ano: 2022,
      valor: 100000,
      data: "2022-09-01",
      candidato: "TANIZIO SÁ",
      detalhe: "Deputado Estadual · AC · MDB",
    },
    {
      sq: "10001643446",
      ano: 2022,
      valor: 60000,
      data: "2022-08-20",
      candidato: "DR. JENILSON LEITE",
      detalhe: "Senador · AC · PSB",
    },
    {
      sq: "10000001234",
      ano: 2020,
      valor: 25000,
      data: "2020-10-02",
      candidato: "MARIA DA SILVA",
      detalhe: "Prefeito · AC · PP",
    },
  ],
};

export const doacoesEleitoraisVariants: ViewVariants<DoacoesEleitoraisViewProps> = [
  { label: "com doações", props: base },
  { label: "carregando", props: { estado: "carregando", itens: [], total: 0 } },
  { label: "erro", props: { estado: "erro", itens: [], total: 0 } },
];
