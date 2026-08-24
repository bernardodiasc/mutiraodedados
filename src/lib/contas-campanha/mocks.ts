import type { ViewVariants } from "@/lib/style-guide/registry";
import type { ContasDeCampanhaViewProps } from "@/components/ContasDeCampanhaView";

const base: ContasDeCampanhaViewProps = {
  estado: "pronto",
  ano: 2022,
  topDoadores: [
    { documento: "00000000000191", nome: "EMPRESA EXEMPLO SA", total: 50_000 },
    { documento: "***.123.456-**", nome: "FULANO DE TAL", total: 10_000 },
  ],
  topFornecedores: [{ documento: "07874659000116", nome: "GRAFICA MODELO LTDA", total: 80_000 }],
  totalReceitas: 60_000,
  totalDespesas: 80_000,
};

export const contasDeCampanhaVariants: ViewVariants<ContasDeCampanhaViewProps> = [
  { label: "com doadores e fornecedores (CNPJ vira link)", props: base },
  { label: "carregando", props: { ...base, estado: "carregando" } },
  {
    label: "vazio (não renderiza nada)",
    props: { ...base, estado: "vazio", topDoadores: [], topFornecedores: [] },
  },
];
