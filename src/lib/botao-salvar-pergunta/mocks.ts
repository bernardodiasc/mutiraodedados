import type { ViewVariants } from "@/lib/style-guide/registry";
import type { BotaoSalvarPerguntaViewProps } from "@/components/BotaoSalvarPerguntaView";

const noop = () => {};

export const botaoSalvarPerguntaVariants: ViewVariants<BotaoSalvarPerguntaViewProps> = [
  { label: "deslogado", props: { estado: "deslogado", onSave: noop } },
  { label: "salvar", props: { estado: "salvar", onSave: noop } },
  { label: "salvando", props: { estado: "salvando", onSave: noop } },
  { label: "salvo", props: { estado: "salvo", onSave: noop } },
];
