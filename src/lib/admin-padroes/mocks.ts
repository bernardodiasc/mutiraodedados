import type { ViewVariants } from "@/lib/style-guide/registry";
import type {
  IconeAcaoDemoViewProps,
  ListaOrdenavelDemoViewProps,
} from "@/components/AdminPadroesDemo";

export const iconeAcaoVariants: ViewVariants<IconeAcaoDemoViewProps> = [
  { label: "ativo", props: { ativo: true } },
  { label: "inativo", props: { ativo: false } },
];

export const listaOrdenavelVariants: ViewVariants<ListaOrdenavelDemoViewProps> = [
  { label: "arrastável", props: { desabilitado: false } },
  { label: "desabilitada", props: { desabilitado: true } },
];
