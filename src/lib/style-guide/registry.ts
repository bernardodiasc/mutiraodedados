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
import { AdminEntesView } from "@/components/AdminEntesView";
import { adminEntesVariants } from "@/lib/admin-entes/mocks";
import { adminLacunasVariants } from "@/lib/admin-lacunas/mocks";
import { AdminLacunasView } from "@/components/AdminLacunasView";
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
import { BarraDeFiltros } from "@/components/BarraDeFiltros";
import { ControlePaginacao } from "@/components/ControlePaginacao";
import { SeletorItensPorPagina } from "@/components/SeletorItensPorPagina";
import { SeletorOrdenacao } from "@/components/SeletorOrdenacao";
import {
  barraDeFiltrosVariants,
  controlePaginacaoVariants,
  seletorItensPorPaginaVariants,
  seletorOrdenacaoVariants,
} from "@/lib/listagem/mocks";
import { CampoDado, Cartao, Estatistica } from "@/components/Cartao";
import { ContasDeCampanhaView } from "@/components/ContasDeCampanhaView";
import { contasDeCampanhaVariants } from "@/lib/contas-campanha/mocks";
import { campoDadoVariants, cartaoVariants, estatisticaVariants } from "@/lib/cartao/mocks";
import { PainelExplicar } from "@/components/PainelExplicar";
import { painelExplicarVariants } from "@/lib/painel-explicar/mocks";
import { PainelInvestigarView } from "@/components/PainelInvestigarView";
import { painelInvestigarVariants } from "@/lib/painel-investigar/mocks";
import { SecaoVinculos } from "@/components/SecaoVinculos";
import { secaoVinculosVariants } from "@/lib/secao-vinculos/mocks";
import { TrilhaDeNavegacao } from "@/components/TrilhaDeNavegacao";
import { trilhaDeNavegacaoVariants } from "@/lib/trilha-de-navegacao/mocks";

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
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- registro heterogêneo: cada entrada tem seu próprio tipo de props
export const composicoesRegistry: ReadonlyArray<ComposicaoEntry<any>> = [
  {
    name: "AdminEntes",
    description:
      "Aba Estados/Municípios do admin: varredura em massa do SICONFI, seleção de ente e importações avulsas (PNCP, Transferegov).",
    View: AdminEntesView,
    variants: adminEntesVariants,
  },
  {
    name: "AdminLacunas",
    description:
      "Tela /admin/lacunas: curadoria de lacunas (criar, editar ciclo, publicar) e conversão de findings em linguagem cidadã.",
    View: AdminLacunasView,
    variants: adminLacunasVariants,
  },
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
  {
    name: "BarraDeFiltros",
    description:
      "Faixa padronizada de filtros das listagens (abas p/ recorte, select p/ enum, input p/ texto).",
    View: BarraDeFiltros,
    variants: barraDeFiltrosVariants,
  },
  {
    name: "CampoDado",
    description: 'Par rótulo/valor das fichas de detalhe (idiom "Field").',
    View: CampoDado,
    variants: campoDadoVariants,
  },
  {
    name: "Cartao",
    description:
      "Cartão padrão do site (border/rounded-xl/p-5/bg-card) — substitui as function Card locais.",
    View: Cartao,
    variants: cartaoVariants,
  },
  {
    name: "ContasDeCampanha",
    description:
      "Contas de campanha na ficha do candidato: top doadores e fornecedores, com CNPJ cruzável com a ficha de fornecedor.",
    View: ContasDeCampanhaView,
    variants: contasDeCampanhaVariants,
  },
  {
    name: "ControlePaginacao",
    description:
      "Navegação numérica das listagens, com links compartilháveis que preservam filtros e o corte `ate`.",
    View: ControlePaginacao,
    variants: controlePaginacaoVariants,
  },
  {
    name: "Estatistica",
    description: 'Número de destaque com rótulo (idiom "Stat") dos cabeçalhos de detalhe.',
    View: Estatistica,
    variants: estatisticaVariants,
  },
  {
    name: "PainelExplicar",
    description:
      'Painel "Explicar": collapsible fechado no fluxo para explicação que não cabe na abertura; opcionalmente com o aviso de sinais.',
    View: PainelExplicar,
    variants: painelExplicarVariants,
  },
  {
    name: "PainelInvestigar",
    description:
      'Painel "Investigar": Sheet lateral com roteiro cidadão passo a passo e prompts do banco quando há mapa vinculado.',
    View: PainelInvestigarView,
    variants: painelInvestigarVariants,
    iframe: true,
  },
  {
    name: "SecaoVinculos",
    description:
      "Seção padronizada de vínculos entre fontes — itens com link interno/externo, valor e aviso de match deduzido.",
    View: SecaoVinculos,
    variants: secaoVinculosVariants,
  },
  {
    name: "SeletorItensPorPagina",
    description: "Itens por página (25/50/100; checkbox libera 250/500).",
    View: SeletorItensPorPagina,
    variants: seletorItensPorPaginaVariants,
  },
  {
    name: "SeletorOrdenacao",
    description: "Select padrão de ordenação (campo-direção) das listagens.",
    View: SeletorOrdenacao,
    variants: seletorOrdenacaoVariants,
  },
  {
    name: "TrilhaDeNavegacao",
    description: "Breadcrumb canônico da página — hierarquia da rota, com os rótulos da nav.",
    View: TrilhaDeNavegacao,
    variants: trilhaDeNavegacaoVariants,
  },
];
