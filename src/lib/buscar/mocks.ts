import type { ViewVariants } from "@/lib/style-guide/registry";
import type { BuscarViewProps } from "@/components/BuscarView";
import type { ItemBusca, ListaBusca, ResumoBusca } from "@/lib/busca/consulta";

const contrato = (i: number, extra: Partial<ItemBusca> = {}): ItemBusca => ({
  colecao: "pncp_contratos_cache",
  id: `46374500000194-2-00${4800 + i}/2026`,
  categoria: "contratos",
  subtipo: null,
  fonte: i % 2 ? "PNCP" : "CGU",
  titulo: `Contrato ${100 + i}/2026 — Prefeitura de Recife`,
  identificador: `PNCP 46374500000194-2-00${4800 + i}/2026`,
  resumo: "Aquisição de gêneros alimentícios para a merenda escolar da rede municipal.",
  data: { valor: "2026-03-10", natureza: "assinatura", precisao: "dia" },
  valor: { n: 150000 + i * 1000, natureza: "valor global contratado", unidade: "BRL" },
  uf: "PE",
  href: "/contratos/46374500000194-2-004859%2F2026",
  urlOficial: "https://pncp.gov.br",
  pai: null,
  exato: false,
  motivo: "texto",
  trecho: "Aquisição de gêneros alimentícios para a [[merenda]] escolar da rede municipal.",
  ...extra,
});

const candidatura: ItemBusca = {
  ...contrato(0),
  colecao: "tse_candidatos_cache",
  id: "10002532416-2026",
  categoria: "pessoas",
  subtipo: "candidatura",
  fonte: "TSE",
  titulo: "Zé da Merenda",
  identificador: "Deputado Estadual · SP · Eleição 2026 · nº 12345",
  resumo: "Deputado Estadual · XYZ · SP · Eleição 2026",
  data: { valor: "2026-01-01", natureza: "eleicao", precisao: "ano" },
  valor: null,
  motivo: "titulo",
  trecho: "Zé da [[Merenda]]",
  href: "/eleicoes/candidatos/10002532416",
  urlOficial: null,
};

const artigo: ItemBusca = {
  ...contrato(0),
  colecao: "artigos",
  id: "a1",
  categoria: "artigos",
  subtipo: "nota",
  fonte: "Mutirão de Dados",
  titulo: "Limites atuais dos dados do PNCP",
  identificador: null,
  valor: null,
  data: { valor: "2026-05-25", natureza: "publicacao", precisao: "dia" },
  trecho: "…exemplo com a busca por [[merenda]] e os filtros de órgão…",
  href: "/notas/limites-pncp",
  urlOficial: null,
};

const facetasResumo = {
  fonte: {
    opcoes: [
      { valor: "PNCP", n: 80 },
      { valor: "CGU", n: 71 },
      { valor: "TSE", n: 64 },
      { valor: "Mutirão de Dados", n: 3 },
    ],
    mais: false,
  },
  ano: {
    opcoes: [
      { valor: "2026", n: 90 },
      { valor: "2025", n: 70 },
      { valor: "2024", n: 55 },
      { valor: "__vazio__", n: 3 },
    ],
    mais: false,
  },
  uf: {
    opcoes: ["SP", "PE", "RJ", "MG", "BA", "RS", "PR", "CE", "PA", "AM", "__vazio__"].map(
      (valor, i) => ({
        valor,
        n: 40 - i * 3,
      }),
    ),
    mais: false,
  },
};

const resumo: ResumoBusca = {
  corte: "2026-09-26T19:00:00.000Z",
  contado: true,
  exato: null,
  facetas: facetasResumo,
  categorias: [
    {
      categoria: "pessoas",
      total: 64,
      previas: [0, 1, 2].map((i) => ({
        ...candidatura,
        id: `1000253241${i}-2026`,
        titulo: `${candidatura.titulo} ${i + 1}`,
      })),
    },
    { categoria: "contratos", total: 151, previas: [contrato(1), contrato(2), contrato(3)] },
    {
      categoria: "emendas",
      total: 12,
      previas: [contrato(4, { categoria: "emendas", titulo: "Emenda 202632980010 — DEP. FULANO" })],
    },
    { categoria: "artigos", total: 3, previas: [artigo] },
  ],
};

const lista: ListaBusca = {
  corte: "2026-09-26T19:00:00.000Z",
  categoria: "contratos",
  pagina: 2,
  itens: 20,
  total: 151,
  temMais: true,
  resultados: Array.from({ length: 5 }, (_, i) => contrato(20 + i)),
  facetas: {
    ...facetasResumo,
    fonte: {
      opcoes: [
        { valor: "PNCP", n: 80 },
        { valor: "CGU", n: 71 },
      ],
      mais: false,
    },
    modalidade: {
      opcoes: [
        { valor: "Pregão", n: 61 },
        { valor: "Dispensa", n: 54 },
        { valor: "Concorrência", n: 36 },
      ],
      mais: false,
    },
    orgao: {
      opcoes: Array.from({ length: 30 }, (_, i) => ({
        valor: `Prefeitura de Município ${i + 1}`,
        n: 30 - i,
      })),
      mais: true,
    },
  },
};

const noop = () => {};

const base: BuscarViewProps = {
  estado: "pronto",
  search: { q: "merenda" },
  atualizando: false,
  resumo,
  lista: null,
  mensagemErro: null,
  trocaPendente: null,
  gruposAbertos: null,
  montarSearchPagina: (pagina) => ({ q: "merenda", pagina }),
  onBuscar: noop,
  onAlternarFiltro: noop,
  onAplicarFiltros: noop,
  onLimparFiltros: noop,
  onIrCategoria: noop,
  onConfirmarTroca: noop,
  onCancelarTroca: noop,
  onGruposAbertos: noop,
  onOrdem: noop,
  onItens: noop,
  onAtualizar: noop,
  onTentarDeNovo: noop,
  onPesquisarOpcoes: async () => [{ valor: "Prefeitura de Município 31", n: 1 }],
  selecao: { ativa: false, chaves: [], deOutraBusca: 0, podeSalvar: true },
  acaoEmAndamento: false,
  onAlternarModoSelecao: noop,
  onAlternarItem: noop,
  onSelecionarPagina: noop,
  onLimparSelecao: noop,
  onSalvarSelecao: noop,
  onCopiarReferencias: noop,
  onExportar: noop,
};

export const buscarVariants: ViewVariants<BuscarViewProps> = [
  { label: "antes da busca", props: { ...base, estado: "inicial", search: {}, resumo: null } },
  { label: "carregando", props: { ...base, estado: "carregando", resumo: null } },
  { label: "visão geral (muitos grupos)", props: base },
  {
    label: "identificador exato",
    props: {
      ...base,
      search: { q: "46374500000194-2-004821/2026" },
      resumo: { ...resumo, exato: contrato(21, { exato: true, motivo: "identificador" }) },
    },
  },
  {
    label: "filtros aplicados e parciais",
    props: {
      ...base,
      search: { q: "merenda", fonte: "PNCP", modalidade: "Pregão", uf: "__vazio__" },
      resumo: { ...resumo, novos: 4 },
    },
  },
  {
    label: "categoria paginada (faceta longa)",
    props: { ...base, search: { q: "merenda", tipo: "contratos", pagina: 2 }, resumo: null, lista },
  },
  {
    label: "troca com filtro incompatível",
    props: {
      ...base,
      search: { q: "merenda", tipo: "contratos", modalidade: "Pregão" },
      resumo: null,
      lista,
      trocaPendente: {
        destino: "artigos",
        incompativeis: [{ chave: "modalidade", rotulo: "Modalidade", valores: ["Pregão"] }],
      },
    },
  },
  {
    label: "seleção ativa",
    props: {
      ...base,
      search: { q: "merenda", tipo: "contratos", pagina: 2 },
      resumo: null,
      lista,
      selecao: {
        ativa: true,
        chaves: [
          `pncp_contratos_cache:${lista.resultados[0].id}`,
          `pncp_contratos_cache:${lista.resultados[2].id}`,
        ],
        deOutraBusca: 0,
        podeSalvar: true,
      },
    },
  },
  {
    label: "seleção de outra busca",
    props: {
      ...base,
      search: { q: "merenda", tipo: "contratos", uf: "PE" },
      resumo: null,
      lista,
      selecao: { ativa: true, chaves: [], deOutraBusca: 7, podeSalvar: false },
    },
  },
  {
    label: "contagem indisponível",
    props: {
      ...base,
      resumo: {
        ...resumo,
        contado: false,
        facetas: undefined,
        categorias: resumo.categorias.map((c) => ({ ...c, total: null })),
      },
    },
  },
  {
    label: "texto extenso",
    props: {
      ...base,
      search: { q: "merenda", tipo: "contratos" },
      resumo: null,
      lista: {
        ...lista,
        pagina: 1,
        resultados: [
          contrato(1, {
            titulo:
              "Contrato 00012/2026 — Fundo Nacional de Desenvolvimento da Educação — Coordenação-Geral de Programas de Alimentação e Nutrição Escolar",
            trecho: `${"Fornecimento continuado de gêneros alimentícios perecíveis e não perecíveis para atendimento do Programa Nacional de Alimentação Escolar, ".repeat(4)}com entrega fracionada da [[merenda]] nas unidades.`,
          }),
        ],
      },
    },
  },
  {
    label: "nada encontrado",
    props: {
      ...base,
      estado: "vazio",
      search: { q: "xyzzy" },
      resumo: { ...resumo, categorias: [] },
    },
  },
  {
    label: "nada com estes filtros",
    props: {
      ...base,
      estado: "vazio",
      search: { q: "merenda", uf: "AC" },
      resumo: { ...resumo, categorias: [] },
    },
  },
  {
    label: "erro",
    props: {
      ...base,
      estado: "erro",
      resumo: null,
      mensagemErro: "Não foi possível fazer a busca agora. Tente de novo em instantes.",
    },
  },
];
