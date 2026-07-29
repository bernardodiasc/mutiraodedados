import type { ViewVariants } from "@/lib/style-guide/registry";
import type { SecaoEleicaoViewProps } from "@/components/SecaoEleicaoView";
import type { EleicoesParlamentar } from "@/lib/data/tse/queries.functions";

const dados: EleicoesParlamentar = {
  candidaturas: [
    {
      sq_candidato: "10001642313",
      ano_eleicao: 2022,
      cargo_nome: "Deputado Federal",
      uf: "AC",
      partido_sigla: "MDB",
      situacao_totalizacao: "ELEITO POR QP",
      bens_total_declarado: 1250000,
      match_metodo: "cpf",
      match_confianca: 1,
    },
    {
      sq_candidato: "10000601234",
      ano_eleicao: 2018,
      cargo_nome: "Deputado Estadual",
      uf: "AC",
      partido_sigla: "MDB",
      situacao_totalizacao: "NÃO ELEITO",
      bens_total_declarado: 640000,
      match_metodo: "cpf",
      match_confianca: 1,
    },
  ],
  topDoadores: [
    {
      documento: "00887169000105",
      nome: "Direção Nacional do Partido",
      total: 850000,
      quantidade: 3,
    },
    { documento: "***.123.456-**", nome: "MARIA APARECIDA DE SOUZA", total: 50000, quantidade: 1 },
  ],
  topFornecedores: [
    {
      documento: "18035283000172",
      nome: "GRÁFICA E EDITORA ACRE LTDA",
      total: 320000,
      quantidade: 8,
    },
    { documento: "01295083221", nome: "COORDENAÇÃO DE CAMPANHA", total: 90000, quantidade: 12 },
  ],
  totalReceitas: 990000,
  totalDespesas: 870000,
};

const base: SecaoEleicaoViewProps = { estado: "pronto", dados };

export const secaoEleicaoVariants: ViewVariants<SecaoEleicaoViewProps> = [
  { label: "com histórico e contas", props: base },
  {
    label: "vínculo por nome (aviso)",
    props: {
      ...base,
      dados: {
        ...dados,
        candidaturas: [
          { ...dados.candidaturas[0], match_metodo: "nome_uf_partido", match_confianca: 0.75 },
        ],
      },
    },
  },
  { label: "sem vínculo", props: { estado: "sem-vinculo", dados: null } },
  { label: "carregando", props: { estado: "carregando", dados: null } },
  { label: "erro", props: { estado: "erro", dados: null } },
];
