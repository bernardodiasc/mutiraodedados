import type { ViewVariants } from "@/lib/style-guide/registry";
import type { PainelInvestigarViewProps } from "@/components/PainelInvestigarView";
import { passosParaAnomalia } from "./logic";

const passosFornecedor = passosParaAnomalia({
  entidadeTipo: "fornecedor",
  entidadeId: "00.000.000/0001-91",
});

export const painelInvestigarVariants: ViewVariants<PainelInvestigarViewProps> = [
  {
    label: "roteiro de anomalia (fornecedor)",
    props: { passos: passosFornecedor, rotuloGatilho: "Investigar este caso" },
  },
  {
    label: "com passo de comando copiável",
    props: {
      titulo: "Confira na fonte",
      passos: [
        {
          icone: "terminal",
          titulo: "Reproduza a consulta na API oficial",
          texto:
            "Para quem quer conferir com as próprias mãos: o comando abaixo lista os arquivos do pacote de candidatos no portal de dados abertos do TSE.",
          codigo:
            'curl -s "https://dadosabertos.tse.jus.br/api/3/action/package_show?id=candidatos-2022"',
        },
      ],
    },
  },
  {
    label: "carregando prompts do mapa",
    props: { passos: passosFornecedor, promptsLoading: true },
  },
];
