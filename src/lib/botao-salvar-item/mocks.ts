import type { ViewVariants } from "@/lib/style-guide/registry";
import type { BotaoSalvarItemViewProps } from "@/components/BotaoSalvarItemView";

const noop = () => {};
const base: BotaoSalvarItemViewProps = {
  estado: "salvar",
  titulo: "Contrato 12345/2026",
  onSave: noop,
};

export const botaoSalvarItemVariants: ViewVariants<BotaoSalvarItemViewProps> = [
  { label: "deslogado", props: { ...base, estado: "deslogado" } },
  { label: "verificando", props: { ...base, estado: "verificando" } },
  { label: "salvar", props: base },
  { label: "salvando", props: { ...base, estado: "salvando" } },
  { label: "salvo", props: { ...base, estado: "salvo" } },
];
