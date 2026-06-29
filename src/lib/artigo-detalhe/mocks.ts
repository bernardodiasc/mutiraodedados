import type { ViewVariants } from "@/lib/style-guide/registry";
import type { ArtigoDetalheViewProps } from "./logic";

const base: ArtigoDetalheViewProps = {
  isLoading: false,
  error: null,
  artigo: {
    titulo: "Como auditar emendas parlamentares",
    resumo: "Um guia simples para o cidadão fiscalizar a destinação das emendas PIX.",
    conteudo_md: "## Passo 1\n\nAbra o site...\n\n## Passo 2\n\nIdentifique o favorecido...",
    dificuldade: "iniciante",
    tempo_estimado_min: 15,
    fontes_usadas: ["Transferegov", "SIAFI"],
  },
  voltarTo: "/mapas",
  voltarLabel: "Mapas investigativos",
};

export const artigoDetalheVariants: ViewVariants<ArtigoDetalheViewProps> = [
  {
    label: "carregando",
    props: {
      ...base,
      isLoading: true,
      artigo: null,
    },
  },
  {
    label: "com erro",
    props: {
      ...base,
      error: new Error("Erro na conexão com o banco de dados."),
      artigo: null,
    },
  },
  {
    label: "carregado com sucesso (iniciante)",
    props: base,
  },
  {
    label: "carregado com sucesso (intermediário e sem resumo)",
    props: {
      ...base,
      artigo: {
        ...base.artigo!,
        resumo: null,
        dificuldade: "intermediario",
        tempo_estimado_min: 30,
        fontes_usadas: ["Câmara Federal"],
      },
    },
  },
];
