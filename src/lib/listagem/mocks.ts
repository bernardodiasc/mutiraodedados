import type { ViewVariants } from "@/lib/style-guide/registry";
import type { ComponentProps } from "react";
import type { ControlePaginacao } from "@/components/ControlePaginacao";
import type { SeletorItensPorPagina } from "@/components/SeletorItensPorPagina";
import type { SeletorOrdenacao } from "@/components/SeletorOrdenacao";
import type { BarraDeFiltros } from "@/components/BarraDeFiltros";

const montarSearch = (pagina: number) => ({ pagina, ate: "2026-08-24" });

export const controlePaginacaoVariants: ViewVariants<ComponentProps<typeof ControlePaginacao>> = [
  {
    label: "meio de uma lista longa",
    props: { pagina: 5, itens: 100, total: 1180, to: "/licitacoes", montarSearch },
  },
  {
    label: "página única (só o total)",
    props: { pagina: 1, itens: 100, total: 42, to: "/licitacoes", montarSearch },
  },
  {
    label: "sem resultados",
    props: { pagina: 1, itens: 100, total: 0, to: "/licitacoes", montarSearch },
  },
];

export const seletorOrdenacaoVariants: ViewVariants<ComponentProps<typeof SeletorOrdenacao>> = [
  {
    label: "ordenações de contrato",
    props: {
      opcoes: [
        { valor: "data-desc", label: "Mais recentes" },
        { valor: "data-asc", label: "Mais antigos" },
        { valor: "valor-desc", label: "Maior valor" },
        { valor: "valor-asc", label: "Menor valor" },
      ],
      valor: "data-desc",
      aoMudar: () => {},
    },
  },
];

export const seletorItensPorPaginaVariants: ViewVariants<
  ComponentProps<typeof SeletorItensPorPagina>
> = [
  { label: "padrão (100)", props: { valor: 100, aoMudar: () => {} } },
  { label: "ampliado (500)", props: { valor: 500, aoMudar: () => {} } },
];

export const barraDeFiltrosVariants: ViewVariants<ComponentProps<typeof BarraDeFiltros>> = [
  {
    label: "com filtros e ações",
    props: {
      children: "…selects e inputs de filtro…",
      acoes: "…ordenação, itens por página, salvar busca…",
    },
  },
];
