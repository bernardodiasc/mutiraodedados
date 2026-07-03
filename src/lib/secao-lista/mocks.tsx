import type { ViewVariants } from "@/lib/style-guide/registry";
import type { FiltroAbasProps } from "@/components/FiltroAbas";
import type { SecaoListaProps } from "@/components/SecaoLista";

const abas = [
  { chave: "tudo", label: "Tudo", qtd: 12 },
  { chave: "ativos", label: "Ativos", qtd: 8 },
  { chave: "inativos", label: "Inativos", qtd: 4 },
];

export const filtroAbasVariants: ViewVariants<FiltroAbasProps> = [
  { label: "primeira ativa", props: { abas, ativa: "tudo", onChange: () => {} } },
  { label: "outra ativa", props: { abas, ativa: "ativos", onChange: () => {} } },
];

const listaExemplo = (
  <ul className="space-y-2">
    <li className="rounded-xl border border-border bg-card p-4 text-sm">Primeiro item</li>
    <li className="rounded-xl border border-border bg-card p-4 text-sm">Segundo item</li>
  </ul>
);

const base: SecaoListaProps = {
  titulo: "Itens",
  abas,
  abaAtiva: "tudo",
  onAbaChange: () => {},
  onBaixarCsv: () => {},
  children: listaExemplo,
};

export const secaoListaVariants: ViewVariants<SecaoListaProps> = [
  { label: "com filtro", props: base },
  { label: "sem filtro", props: { ...base, abas: undefined } },
  { label: "csv desabilitado", props: { ...base, csvDesabilitado: true } },
];
