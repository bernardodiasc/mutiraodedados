import type { ViewVariants } from "@/lib/style-guide/registry";
import type { PainelExplicarProps } from "@/components/PainelExplicar";

export const painelExplicarVariants: ViewVariants<PainelExplicarProps> = [
  {
    label: "fechado (padrão)",
    props: {
      titulo: "De onde vêm estes dados?",
      children:
        "Os contratos vêm do Portal da Transparência (CGU), que cobre o Executivo federal. O PNCP, criado pela Lei 14.133, recebe contratações de todos os entes.",
    },
  },
  {
    label: "aberto, com aviso de sinais",
    props: {
      titulo: "Como ler os sinais desta página",
      abertoInicial: true,
      avisoSinais: true,
      children:
        "Cada sinal nasce de uma regra aplicada durante a atualização do acervo e passa por re-checagem contra a fonte oficial antes de aparecer aqui.",
    },
  },
];
