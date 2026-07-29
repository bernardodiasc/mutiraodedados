import type { ViewVariants } from "@/lib/style-guide/registry";
import type { CandidatosListaViewProps } from "@/components/CandidatosListaView";

const filtros = {
  ano: 2022,
  anos: [2024, 2022, 2020, 2018, 2016, 2014],
  uf: "AC",
  ufs: ["AC", "SP", "RJ"],
  q: "",
};

const base: CandidatosListaViewProps = {
  estado: "pronto",
  itens: [
    {
      sq: "10001643446",
      ano: 2022,
      nomeUrna: "DR. JENILSON LEITE",
      nomeCompleto: "JANILSON LOPES LEITE",
      cargo: "Senador",
      uf: "AC",
      partido: "PSB",
      numero: "400",
      situacao: "NÃO ELEITO",
      bensTotal: 850000,
    },
    {
      sq: "10001642313",
      ano: 2022,
      nomeUrna: "TANIZIO SÁ",
      nomeCompleto: "JOSÉ ALTANIZIO TAUMATURGO SÁ",
      cargo: "Deputado estadual",
      uf: "AC",
      partido: "MDB",
      numero: "15555",
      situacao: "ELEITO POR MÉDIA",
      bensTotal: 1200000,
    },
  ],
  total: 2,
  filtros,
  onAlterarFiltro: () => {},
  onCarregarMais: () => {},
  temMais: false,
  carregandoMais: false,
};

export const candidatosListaVariants: ViewVariants<CandidatosListaViewProps> = [
  { label: "com candidatos", props: base },
  { label: "com mais páginas", props: { ...base, temMais: true, total: 236 } },
  { label: "carregando", props: { ...base, estado: "carregando", itens: [] } },
  { label: "vazio", props: { ...base, estado: "vazio", itens: [], total: 0 } },
  { label: "erro", props: { ...base, estado: "erro", itens: [] } },
];
