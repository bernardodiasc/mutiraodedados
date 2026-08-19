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
import { KitInvestigacaoView } from "@/components/KitInvestigacaoView";
import { kitInvestigacaoVariants } from "@/lib/kit-investigacao/mocks";
import { ArtigoDetalheView } from "@/components/ArtigoDetalheView";
import { artigoDetalheVariants } from "@/lib/artigo-detalhe/mocks";
import { QualidadeBannerView } from "@/components/QualidadeBannerView";
import { qualidadeBannerVariants } from "@/lib/qualidade-banner/mocks";
import { IconeAcaoDemoView, ListaOrdenavelDemoView } from "@/components/AdminPadroesDemo";
import { iconeAcaoVariants, listaOrdenavelVariants } from "@/lib/admin-padroes/mocks";
import { FiltroAbas } from "@/components/FiltroAbas";
import { SecaoLista } from "@/components/SecaoLista";
import { filtroAbasVariants, secaoListaVariants } from "@/lib/secao-lista/mocks";
import { EleicoesHubView } from "@/components/EleicoesHubView";
import { eleicoesHubVariants } from "@/lib/eleicoes-hub/mocks";
import { CandidatosListaView } from "@/components/CandidatosListaView";
import { candidatosListaVariants } from "@/lib/candidatos-lista/mocks";
import { CandidatoFichaView } from "@/components/CandidatoFichaView";
import { HistoricoCandidaturasView } from "@/components/HistoricoCandidaturasView";
import { ComparadorPatrimonioView } from "@/components/ComparadorPatrimonioView";
import { VinculoParlamentarView } from "@/components/VinculoParlamentarView";
import {
  candidatoFichaVariants,
  comparadorPatrimonioVariants,
  historicoCandidaturasVariants,
  vinculoParlamentarVariants,
} from "@/lib/candidato-ficha/mocks";
import { TseImportPanelView } from "@/components/TseImportPanelView";
import { tseImportPanelVariants } from "@/lib/tse-import/mocks";
import { SecaoEleicaoView } from "@/components/SecaoEleicaoView";
import { secaoEleicaoVariants } from "@/lib/secao-eleicao/mocks";
import { DoacoesEleitoraisView } from "@/components/DoacoesEleitoraisView";
import { doacoesEleitoraisVariants } from "@/lib/doacoes-eleitorais/mocks";

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
    name: "CandidatoFicha",
    description:
      "Ficha eleitoral de um candidato (TSE): identidade, votação, bens declarados e histórico de candidaturas.",
    View: CandidatoFichaView,
    variants: candidatoFichaVariants,
  },
  {
    name: "CandidatosLista",
    description:
      "Busca de candidatos por eleição, UF e nome, com badge de situação e total de bens (fonte TSE).",
    View: CandidatosListaView,
    variants: candidatosListaVariants,
  },
  {
    name: "CoberturaMatrix",
    description: "Matriz ano × mês × fonte com ações de re-importação por célula, linha e coluna.",
    View: CoberturaMatrixView,
    variants: coberturaMatrixVariants,
  },
  {
    name: "CoberturaResumo",
    description:
      "Cabeçalho do painel público de cobertura: 3 KPIs sobre fontes, atualização e volume.",
    View: CoberturaResumo,
    variants: coberturaResumoVariants,
  },
  {
    name: "FiltroAbas",
    description:
      "Navegação de filtro por abas com contadores — padrão das listas do admin (Tudo / status).",
    View: FiltroAbas,
    variants: filtroAbasVariants,
  },
  {
    name: "FonteCard",
    description:
      "Card de uma fonte na página de cobertura — variantes compact, full (heatmap), anual e sem dados.",
    View: FonteCard,
    variants: fonteCardVariants,
  },
  {
    name: "ComparadorPatrimonio",
    description:
      "Comparação dos bens declarados em duas candidaturas da mesma pessoa: total, categorias e as duas listas lado a lado (fonte TSE).",
    View: ComparadorPatrimonioView,
    variants: comparadorPatrimonioVariants,
  },
  {
    name: "HistoricoCandidaturas",
    description:
      "Candidaturas da mesma pessoa ligadas pelo CPF, com patrimônio declarado por eleição, variação e minigráfico (fonte TSE).",
    View: HistoricoCandidaturasView,
    variants: historicoCandidaturasVariants,
  },
  {
    name: "VinculoParlamentar",
    description:
      "Ponte da candidatura para a ficha de parlamentar em exercício da mesma pessoa, com aviso quando o vínculo veio de nome e não de CPF.",
    View: VinculoParlamentarView,
    variants: vinculoParlamentarVariants,
  },
  {
    name: "DoacoesEleitorais",
    description:
      "Seção da ficha do fornecedor: campanhas que receberam doações deste CNPJ (fonte TSE), com aviso metodológico.",
    View: DoacoesEleitoraisView,
    variants: doacoesEleitoraisVariants,
  },
  {
    name: "EleicoesHub",
    description:
      "Hub público /eleicoes: blocos por eleição com contagens de candidaturas e eleitos por cargo (fonte TSE).",
    View: EleicoesHubView,
    variants: eleicoesHubVariants,
  },
  {
    name: "FlagsCidada",
    description: "Marcações cidadãs (suspeita / confirmar / contexto) com votação simples.",
    View: FlagsCidadaView,
    variants: flagsCidadaVariants,
  },
  {
    name: "IconeAcao",
    description:
      "Padrão de botões de ação (só ícone) das linhas de listas do admin: copiar, alternar, editar, excluir.",
    View: IconeAcaoDemoView,
    variants: iconeAcaoVariants,
  },
  {
    name: "InvestigacaoInline",
    description: "Wrapper que abre investigação (finding) embutida abaixo de um card de entidade.",
    View: InvestigacaoInlineView,
    variants: investigacaoInlineVariants,
  },
  {
    name: "KitInvestigacao",
    description:
      "Painel lateral dos mapas: copiar o procedimento, salvar no caderno e a lista de prompts para a IA do usuário.",
    View: KitInvestigacaoView,
    variants: kitInvestigacaoVariants,
  },
  {
    name: "ListaOrdenavel",
    description:
      "Lista reordenável por drag-and-drop (arraste pela alça). Usada para definir a ordem pública das listas do admin.",
    View: ListaOrdenavelDemoView,
    variants: listaOrdenavelVariants,
  },
  {
    name: "QualidadeBanner",
    description: "Banner sinalizando inconsistências (QA findings) ativas para uma entidade.",
    View: QualidadeBannerView,
    variants: qualidadeBannerVariants,
  },
  {
    name: "SecaoLista",
    description:
      "Cabeçalho padrão das listas do admin: título + filtro por abas + Baixar CSV (do subconjunto filtrado).",
    View: SecaoLista,
    variants: secaoListaVariants,
  },
  {
    name: "SecaoEleicao",
    description:
      "Seção 'Eleições' das fichas de deputado/senador: candidaturas, bens, top doadores e fornecedores de campanha (via ponte TSE).",
    View: SecaoEleicaoView,
    variants: secaoEleicaoVariants,
  },
  {
    name: "ReporteOficialModal",
    description: "Modal para registrar reporte oficial em canal externo (Fala.BR, Compras, etc.).",
    View: ReporteOficialModalView,
    variants: reporteOficialVariants,
    iframe: true,
  },
  {
    name: "TseImportPanel",
    description:
      "Aba TSE do admin: importação por (arquivo, ano, UF) com auto-continuar e progresso das varreduras.",
    View: TseImportPanelView,
    variants: tseImportPanelVariants,
  },
];
