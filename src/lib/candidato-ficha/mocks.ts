import type { ViewVariants } from "@/lib/style-guide/registry";
import type { CandidatoFichaViewProps } from "@/components/CandidatoFichaView";
import type { CandidatoDetalhe } from "@/lib/data/tse/queries.functions";

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
    cpf: "12345678901",
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
      tipo_bem: "Casa",
      descricao: "IMÓVEL RESIDENCIAL EM RIO BRANCO",
      valor: 800000,
    },
    {
      ordem_bem: 2,
      tipo_bem: "Veículo automotor terrestre",
      descricao: "CAMINHONETE",
      valor: 250000,
    },
    { ordem_bem: 3, tipo_bem: "Depósito bancário", descricao: "CONTA CORRENTE", valor: 200000 },
  ],
  votosTotais: 8412,
  topMunicipios: [
    { municipio_nome: "MANOEL URBANO", votos: 2318 },
    { municipio_nome: "RIO BRANCO", votos: 1904 },
    { municipio_nome: "SENA MADUREIRA", votos: 1411 },
  ],
  outrasCandidaturas: [
    {
      ano_eleicao: 2018,
      cargo_nome: "Deputado Estadual",
      situacao_totalizacao: "ELEITO POR QP",
      sq_candidato: "10000601234",
    },
  ],
};

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
      detalhe: { ...detalhe, bens: [], votosTotais: 0, topMunicipios: [], outrasCandidaturas: [] },
    },
  },
  { label: "carregando", props: { ...base, estado: "carregando", detalhe: null } },
  { label: "não encontrada", props: { ...base, estado: "nao-encontrado", detalhe: null } },
  { label: "erro", props: { ...base, estado: "erro", detalhe: null } },
];
