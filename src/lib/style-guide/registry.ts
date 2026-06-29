// Auto-registro de composições para a aba "Composições" em /estilo.
//
// Cada feature refatorada (Container/View) exporta de
// `src/lib/<feature>/mocks.ts` um array `<feature>Variants`:
//
//   export const fooVariants: ViewVariants<FooViewProps> = [
//     { label: "default", props: { ... } },
//     { label: "vazio",   props: { ... } },
//   ];
//
// E aqui registramos `{ name, View, variants }`. O style guide importa apenas
// Views (stateless) e mocks — NUNCA containers ou server-fns.

import type { ComponentType } from "react";
import { AnomaliaInvestigacaoView } from "@/components/AnomaliaInvestigacaoView";
import { anomaliaInvestigacaoVariants } from "@/lib/anomalia-investigacao/mocks";
import { CoberturaMatrixView } from "@/components/CoberturaMatrixView";
import { coberturaMatrixVariants } from "@/lib/cobertura-matrix/mocks";
import { ArtigosIndexListView } from "@/components/ArtigosIndexListView";
import { artigosIndexListVariants } from "@/lib/artigos-index/mocks";
import { FlagsCidadaView } from "@/components/FlagsCidadaView";
import { flagsCidadaVariants } from "@/lib/flags-cidada/mocks";
import { InvestigacaoInlineView } from "@/components/InvestigacaoInlineView";
import { investigacaoInlineVariants } from "@/lib/investigacao-inline/mocks";
import { ReporteOficialModalView } from "@/components/ReporteOficialModalView";
import { reporteOficialVariants } from "@/lib/reporte-oficial/mocks";
import { CoberturaResumo, FonteCard } from "@/components/CoberturaSecao";
import { coberturaResumoVariants, fonteCardVariants } from "@/lib/cobertura-secao/mocks";
import { BotaoSalvarPerguntaView } from "@/components/BotaoSalvarPerguntaView";
import { botaoSalvarPerguntaVariants } from "@/lib/botao-salvar-pergunta/mocks";
import { BotaoSalvarItemView } from "@/components/BotaoSalvarItemView";
import { botaoSalvarItemVariants } from "@/lib/botao-salvar-item/mocks";
import { AnotacoesCadernoView } from "@/components/AnotacoesCadernoView";
import { anotacoesCadernoVariants } from "@/lib/anotacoes-caderno/mocks";
import { CadernoPerguntasSalvasView } from "@/components/CadernoPerguntasSalvasView";
import { cadernoPerguntasSalvasVariants } from "@/lib/caderno-perguntas/mocks";
import { CadernoItensSalvosView } from "@/components/CadernoItensSalvosView";
import { cadernoItensSalvosVariants } from "@/lib/caderno-itens/mocks";
import { ArtigoDetalheView } from "@/components/ArtigoDetalheView";
import { artigoDetalheVariants } from "@/lib/artigo-detalhe/mocks";
import { QualidadeBannerView } from "@/components/QualidadeBannerView";
import { qualidadeBannerVariants } from "@/lib/qualidade-banner/mocks";

export type ViewVariant<P> = { label: string; props: P };
export type ViewVariants<P> = ReadonlyArray<ViewVariant<P>>;

export type ComposicaoEntry<P = unknown> = {
  name: string;
  description?: string;
  View: ComponentType<P>;
  variants: ViewVariants<P>;
  /** Renderiza cada variante em iframe isolado. Útil quando o componente usa modais/portais. */
  iframe?: boolean;
};

// Lista populada conforme cada onda da refatoração adiciona Views puras.
// Manter ordenado alfabeticamente por `name`.
export const composicoesRegistry: ReadonlyArray<ComposicaoEntry<any>> = [
  {
    name: "AnomaliaInvestigacao",
    description:
      "Card de investigação de uma anomalia: cabeçalho, comparação, trilha, ações de admin e cURL.",
    View: AnomaliaInvestigacaoView,
    variants: anomaliaInvestigacaoVariants,
  },
  {
    name: "AnotacoesCaderno",
    description: "CRUD de anotações markdown privadas do caderno do cidadão.",
    View: AnotacoesCadernoView,
    variants: anotacoesCadernoVariants,
  },
  {
    name: "ArtigoDetalhe",
    description: "Visualização detalhada de um mapa, tutorial ou nota com metadados.",
    View: ArtigoDetalheView,
    variants: artigoDetalheVariants,
  },
  {
    name: "ArtigosIndexList",
    description: "Listagem de mapas / tutoriais / notas (categoria de artigos públicos).",
    View: ArtigosIndexListView,
    variants: artigosIndexListVariants,
  },
  {
    name: "BotaoSalvarItem",
    description: "Botão polimórfico de salvar entidade no caderno (estado deslogado/salvar/salvo).",
    View: BotaoSalvarItemView,
    variants: botaoSalvarItemVariants,
  },
  {
    name: "BotaoSalvarPergunta",
    description: "Botão de salvar pergunta no caderno do cidadão.",
    View: BotaoSalvarPerguntaView,
    variants: botaoSalvarPerguntaVariants,
  },
  {
    name: "CadernoItensSalvos",
    description: "Lista dos itens (entidades) salvos no caderno do cidadão.",
    View: CadernoItensSalvosView,
    variants: cadernoItensSalvosVariants,
  },
  {
    name: "CadernoPerguntasSalvas",
    description: "Lista das perguntas salvas no caderno do cidadão.",
    View: CadernoPerguntasSalvasView,
    variants: cadernoPerguntasSalvasVariants,
  },
  {
    name: "CoberturaMatrix",
    description:
      "Matriz ano × mês × fonte com ações de re-importação por célula, linha e coluna.",
    View: CoberturaMatrixView,
    variants: coberturaMatrixVariants,
  },
  {
    name: "CoberturaResumo",
    description: "Cabeçalho do painel público de cobertura: 3 KPIs sobre fontes, atualização e volume.",
    View: CoberturaResumo,
    variants: coberturaResumoVariants,
  },
  {
    name: "FonteCard",
    description: "Card de uma fonte na página de cobertura — variantes compact, full (heatmap), anual e sem dados.",
    View: FonteCard,
    variants: fonteCardVariants,
  },
  {
    name: "FlagsCidada",
    description: "Marcações cidadãs (suspeita / confirmar / contexto) com votação simples.",
    View: FlagsCidadaView,
    variants: flagsCidadaVariants,
  },
  {
    name: "InvestigacaoInline",
    description: "Wrapper que abre investigação (finding) embutida abaixo de um card de entidade.",
    View: InvestigacaoInlineView,
    variants: investigacaoInlineVariants,
  },
  {
    name: "QualidadeBanner",
    description: "Banner sinalizando inconsistências (QA findings) ativas para uma entidade.",
    View: QualidadeBannerView,
    variants: qualidadeBannerVariants,
  },
  {
    name: "ReporteOficialModal",
    description: "Modal para registrar reporte oficial em canal externo (Fala.BR, Compras, etc.).",
    View: ReporteOficialModalView,
    variants: reporteOficialVariants,
    iframe: true,
  },
];