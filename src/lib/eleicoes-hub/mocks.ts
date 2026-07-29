import type { ViewVariants } from "@/lib/style-guide/registry";
import type { EleicoesHubViewProps } from "@/components/EleicoesHubView";

const base: EleicoesHubViewProps = {
  estado: "pronto",
  anos: [
    {
      ano: 2022,
      totalCandidatos: 29327,
      cargos: [
        { cargoCod: 7, cargoNome: "Deputado estadual", total: 16500, eleitos: 1035, ufs: 26 },
        { cargoCod: 6, cargoNome: "Deputado federal", total: 10600, eleitos: 513, ufs: 27 },
        { cargoCod: 3, cargoNome: "Governador", total: 224, eleitos: 27, ufs: 27 },
        { cargoCod: 5, cargoNome: "Senador", total: 236, eleitos: 27, ufs: 27 },
        { cargoCod: 1, cargoNome: "Presidente", total: 12, eleitos: 1, ufs: 1 },
      ],
    },
    {
      ano: 2020,
      totalCandidatos: 557420,
      cargos: [
        { cargoCod: 13, cargoNome: "Vereador", total: 538555, eleitos: 57931, ufs: 26 },
        { cargoCod: 11, cargoNome: "Prefeito", total: 18865, eleitos: 5567, ufs: 26 },
      ],
    },
  ],
};

export const eleicoesHubVariants: ViewVariants<EleicoesHubViewProps> = [
  { label: "com eleições", props: base },
  { label: "carregando", props: { estado: "carregando", anos: [] } },
  { label: "vazio", props: { estado: "vazio", anos: [] } },
  { label: "erro", props: { estado: "erro", anos: [] } },
];
