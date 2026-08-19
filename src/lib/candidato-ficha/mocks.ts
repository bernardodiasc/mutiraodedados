import type { ViewVariants } from "@/lib/style-guide/registry";
import type { CandidatoFichaViewProps } from "@/components/CandidatoFichaView";
import type { HistoricoCandidaturasViewProps } from "@/components/HistoricoCandidaturasView";
import type { ComparadorPatrimonioViewProps } from "@/components/ComparadorPatrimonioView";
import type { VinculoParlamentarViewProps } from "@/components/VinculoParlamentarView";
import type { CandidatoDetalhe } from "@/lib/data/tse/queries.functions";
import type { CandidaturaHistorico } from "@/lib/candidato-ficha/logic";

const detalhe: CandidatoDetalhe = {
  candidato: {
    sq_candidato: "10001642313",
    ano_eleicao: 2022,
    nr_turno: 1,
    cargo_nome: "Deputado Estadual",
    uf: "AC",
    municipio_cod: "AC",
    nome_completo: "JOSÉ ALTANIZIO TAUMATURGO SÁ",
    nome_urna: "TANIZIO SÁ",
    partido_sigla: "MDB",
    numero_candidato: "15555",
    situacao_candidatura: "APTO",
    situacao_totalizacao: "ELEITO POR MÉDIA",
    ocupacao: "Deputado",
    grau_instrucao: "Superior completo",
    genero: "Masculino",
    cor_raca: "Parda",
    bens_total_declarado: 1250000,
  },
  bens: [
    {
      ordem_bem: 1,
      tipo_bem_cod: "12",
      tipo_bem: "Casa",
      descricao: "IMÓVEL RESIDENCIAL EM RIO BRANCO",
      valor: 800000,
    },
    {
      ordem_bem: 2,
      tipo_bem_cod: "21",
      tipo_bem: "Veículo automotor terrestre",
      descricao: "CAMINHONETE",
      valor: 250000,
    },
    {
      ordem_bem: 3,
      tipo_bem_cod: "61",
      tipo_bem: "Depósito bancário",
      descricao: "CONTA CORRENTE",
      valor: 200000,
    },
  ],
  bensTotalLinhas: 3,
  votosTotais: 8412,
  topMunicipios: [
    { municipio_nome: "MANOEL URBANO", votos: 2318 },
    { municipio_nome: "RIO BRANCO", votos: 1904 },
    { municipio_nome: "SENA MADUREIRA", votos: 1411 },
  ],
  // Cobre de propósito os três casos que a View não pode confundir:
  // 2022 com valor, 2018 com ZERO declarado, 2016 SEM DADO (null).
  historico: [
    {
      sq_candidato: "10001642313",
      ano_eleicao: 2022,
      nr_turno: 1,
      cargo_nome: "Deputado Estadual",
      uf: "AC",
      partido_sigla: "MDB",
      situacao_totalizacao: "ELEITO POR MÉDIA",
      bens_total_declarado: 1250000,
    },
    {
      sq_candidato: "10000601234",
      ano_eleicao: 2018,
      nr_turno: 1,
      cargo_nome: "Deputado Estadual",
      uf: "AC",
      partido_sigla: "PSB",
      situacao_totalizacao: "ELEITO POR QP",
      bens_total_declarado: 0,
    },
    {
      sq_candidato: "10000512345",
      ano_eleicao: 2016,
      nr_turno: 1,
      cargo_nome: "Vereador",
      uf: "AC",
      partido_sigla: "PSB",
      situacao_totalizacao: "NÃO ELEITO",
      bens_total_declarado: null,
    },
    {
      sq_candidato: "10000411111",
      ano_eleicao: 2014,
      nr_turno: 1,
      cargo_nome: "Deputado Estadual",
      uf: "AC",
      partido_sigla: "PSB",
      situacao_totalizacao: "SUPLENTE",
      bens_total_declarado: 180000,
    },
  ],
  historicoIndisponivel: false,
  parlamentares: [
    {
      tipo: "deputado",
      id: "209787",
      nome: "Tanizio Sá",
      partido: "MDB",
      uf: "AC",
      anoOrigem: 2022,
      origemEhAtual: true,
      matchMetodo: "cpf",
      matchConfianca: 1,
    },
  ],
};

const candidaturas: CandidaturaHistorico[] = detalhe.historico.map((h) => ({
  sq: h.sq_candidato,
  ano: h.ano_eleicao,
  turno: h.nr_turno,
  cargo: h.cargo_nome,
  uf: h.uf,
  partido: h.partido_sigla,
  situacao: h.situacao_totalizacao,
  bensTotal: h.bens_total_declarado,
  atual: h.sq_candidato === detalhe.candidato.sq_candidato,
}));

const base: CandidatoFichaViewProps = {
  estado: "pronto",
  detalhe,
  urlOficial:
    "https://divulgacandcontas.tse.jus.br/divulga/#/candidato/2022/2040602022/AC/10001642313",
};

export const candidatoFichaVariants: ViewVariants<CandidatoFichaViewProps> = [
  { label: "eleito com bens e votos", props: base },
  {
    label: "sem votos e sem bens",
    props: {
      ...base,
      detalhe: {
        ...detalhe,
        bens: [],
        bensTotalLinhas: 0,
        votosTotais: 0,
        topMunicipios: [],
        candidato: { ...detalhe.candidato, bens_total_declarado: null },
      },
    },
  },
  { label: "carregando", props: { ...base, estado: "carregando", detalhe: null } },
  { label: "não encontrada", props: { ...base, estado: "nao-encontrado", detalhe: null } },
  { label: "erro", props: { ...base, estado: "erro", detalhe: null } },
];

export const historicoCandidaturasVariants: ViewVariants<HistoricoCandidaturasViewProps> = [
  {
    label: "quatro eleições, uma sem dado e uma com zero",
    props: { candidaturas, indisponivel: false },
  },
  {
    label: "candidatura única",
    props: { candidaturas: [candidaturas[0]], indisponivel: false },
  },
  {
    label: "CPF não divulgado pela fonte",
    props: { candidaturas: [candidaturas[0]], indisponivel: true },
  },
];

const comparacaoBase: ComparadorPatrimonioViewProps = {
  opcoes: candidaturas.filter((c) => !c.atual),
  sqSelecionado: "10000411111",
  onSelecionar: () => {},
  carregando: false,
  erro: false,
  comparacao: {
    a: {
      sq: "10000411111",
      ano: 2014,
      cargo: "Deputado Estadual",
      uf: "AC",
      partido: "PSB",
      totalDeclarado: 180000,
      totalLinhas: 180000,
      quantidadeBens: 2,
      categorias: [
        { categoria: "imoveis", total: 150000, quantidade: 1 },
        { categoria: "veiculos", total: 30000, quantidade: 1 },
      ],
      bens: [
        {
          ordem_bem: 1,
          tipo_bem_cod: "12",
          tipo_bem: "Casa",
          descricao: "IMÓVEL RESIDENCIAL EM RIO BRANCO",
          valor: 150000,
        },
        {
          ordem_bem: 2,
          tipo_bem_cod: "21",
          tipo_bem: "Veículo automotor terrestre",
          descricao: "AUTOMÓVEL",
          valor: 30000,
        },
      ],
      truncado: false,
    },
    b: {
      sq: "10001642313",
      ano: 2022,
      cargo: "Deputado Estadual",
      uf: "AC",
      partido: "MDB",
      totalDeclarado: 1250000,
      totalLinhas: 1250000,
      quantidadeBens: 3,
      categorias: [
        { categoria: "imoveis", total: 800000, quantidade: 1 },
        { categoria: "veiculos", total: 250000, quantidade: 1 },
        { categoria: "dinheiro", total: 200000, quantidade: 1 },
      ],
      bens: detalhe.bens,
      truncado: false,
    },
  },
};

export const comparadorPatrimonioVariants: ViewVariants<ComparadorPatrimonioViewProps> = [
  { label: "2014 × 2022, patrimônio cresceu", props: comparacaoBase },
  { label: "carregando", props: { ...comparacaoBase, carregando: true, comparacao: null } },
  { label: "erro", props: { ...comparacaoBase, erro: true, comparacao: null } },
  {
    label: "um dos anos sem declaração importada",
    props: {
      ...comparacaoBase,
      comparacao: {
        ...comparacaoBase.comparacao!,
        a: {
          ...comparacaoBase.comparacao!.a,
          totalDeclarado: null,
          totalLinhas: 0,
          quantidadeBens: 0,
          categorias: [],
          bens: [],
        },
      },
    },
  },
];

export const vinculoParlamentarVariants: ViewVariants<VinculoParlamentarViewProps> = [
  { label: "vínculo por CPF (confiança total)", props: { parlamentares: detalhe.parlamentares } },
  {
    // Sem CPF na origem, a ponte casa por nome — e a ficha precisa dizer isso.
    label: "vínculo deduzido por nome (pode errar em homônimo)",
    props: {
      parlamentares: [
        {
          tipo: "senador",
          id: "5322",
          nome: "Fulana de Tal",
          partido: "PSB",
          uf: "AC",
          anoOrigem: 2018,
          origemEhAtual: false,
          matchMetodo: "nome_uf_partido",
          matchConfianca: 0.75,
        },
      ],
    },
  },
  { label: "sem vínculo (seção não renderiza)", props: { parlamentares: [] } },
];
