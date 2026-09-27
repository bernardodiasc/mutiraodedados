import type { ViewVariants } from "@/lib/style-guide/registry";
import type { CoberturaMatrixViewProps } from "@/components/CoberturaMatrixView";
import type { CoberturaResult } from "@/lib/data/cobertura.functions";

const noop = () => {};

const ANO = 2026;

function mkData(): CoberturaResult {
  return {
    fontes: [
      {
        fonte: "cgu",
        titulo: "Portal da Transparência (CGU)",
        descricao: "Contratos e despesas por órgão e mês.",
        granularidade: "mes",
        linhas: [
          {
            id: "26000",
            label: "MS",
            sublabel: "Ministério da Saúde",
            celulas: [
              {
                ano: ANO,
                mes: 1,
                qtd: 120,
                ultimo: `${ANO}-02-01T00:00:00Z`,
                tentado: true,
                estado: "concluido",
                motivo: "Janela completa: 120 de 120 registros da origem.",
              },
              {
                ano: ANO,
                mes: 2,
                qtd: 80,
                ultimo: `${ANO}-03-01T00:00:00Z`,
                tentado: true,
                estado: "erro",
                motivo: "Contagem diverge da origem: 80 importados, a origem informa 95.",
                execucaoId: "51779a6b-9936-4e51-887a-ae850187c504",
              },
              {
                ano: ANO,
                mes: 3,
                qtd: 0,
                tentado: true,
                tentativaEm: `${ANO}-04-01T00:00:00Z`,
                estado: "vazio_confirmado",
                motivo: "Janela completa, sem registros no período.",
              },
              {
                ano: ANO,
                mes: 4,
                qtd: 45,
                ultimo: `${ANO}-05-01T00:00:00Z`,
                tentado: true,
                estado: "parcial",
              },
              { ano: ANO, mes: 5, qtd: 0, tentado: true, estado: "indisponivel" },
            ],
          },
        ],
      },
      {
        fonte: "pncp",
        titulo: "PNCP",
        descricao: "Compras públicas centralizadas.",
        granularidade: "mes",
        linhas: [
          {
            id: "pncp-1",
            label: "Todos órgãos",
            celulas: [
              { ano: ANO, mes: 1, qtd: 500, ultimo: `${ANO}-02-15T00:00:00Z`, tentado: true },
              { ano: ANO, mes: 2, qtd: 0, tentado: false },
            ],
          },
        ],
      },
    ],
  } as CoberturaResult;
}

const baseProps: CoberturaMatrixViewProps = {
  ano: ANO,
  onAnoChange: noop,
  isRunning: false,
  loading: false,
  data: mkData(),
  fonteIds: ["cgu", "pncp"],
  selecionadas: new Set(["cgu"]),
  onSelecionadasChange: noop,
  onRefresh: noop,
  cobertosLen: 25,
  carregadosSize: 14,
  contratosCount: 12_345,
  totalContratado: 987_654_321,
  onPreencherLacunasSelecionadas: noop,
  onPreencherLacunas: noop,
  onCelulaClick: noop,
  onLinhaClick: noop,
  onColunaClick: noop,
};

export const coberturaMatrixVariants: ViewVariants<CoberturaMatrixViewProps> = [
  { label: "default", props: baseProps },
  {
    label: "carregando",
    props: { ...baseProps, loading: true, data: null },
  },
  {
    label: "executando jobs",
    props: { ...baseProps, isRunning: true },
  },
];
