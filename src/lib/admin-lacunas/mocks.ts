import type { AdminLacunasViewProps } from "@/components/AdminLacunasView";
import type { Lacuna } from "@/lib/lacunas.functions";
import type { ViewVariants } from "@/lib/style-guide/registry";

const noop = async () => {};

const lacuna = (over: Partial<Lacuna>): Lacuna => ({
  id: "00000000-0000-0000-0000-000000000001",
  titulo: "Convênio sem plano de trabalho publicado",
  descricao:
    "O instrumento aparece assinado no Portal, mas o plano de trabalho — obrigatório por lei — não é encontrado em nenhuma das fontes consultadas.",
  tipo: "documental",
  ciclo: "nasce",
  entidade_tipo: "instrumento",
  entidade_id: "912345",
  origem_qa_finding_id: null,
  tags: ["transferegov"],
  publicada: true,
  resolvida_em: null,
  created_at: "2026-08-01T12:00:00Z",
  updated_at: "2026-08-01T12:00:00Z",
  ...over,
});

const base: AdminLacunasViewProps = {
  lacunas: [],
  isLoading: false,
  filtroTipo: "",
  setFiltroTipo: () => {},
  filtroCiclo: "",
  setFiltroCiclo: () => {},
  findings: [],
  findingsLoading: false,
  onCriar: noop,
  onAtualizar: noop,
  onConverter: noop,
};

export const adminLacunasVariants: ViewVariants<AdminLacunasViewProps> = [
  { label: "vazio", props: base },
  {
    label: "com lacunas e findings",
    props: {
      ...base,
      lacunas: [
        lacuna({}),
        lacuna({
          id: "00000000-0000-0000-0000-000000000002",
          titulo: "Valor truncado confirmado na origem",
          tipo: "mensuracao",
          ciclo: "qualificada",
          origem_qa_finding_id: "00000000-0000-0000-0000-0000000000aa",
          publicada: false,
        }),
        lacuna({
          id: "00000000-0000-0000-0000-000000000003",
          titulo: "Série histórica interrompida em 2019",
          tipo: "transparencia",
          ciclo: "encerra",
          resolvida_em: "2026-07-01T00:00:00Z",
        }),
      ],
      findings: [
        {
          id: "00000000-0000-0000-0000-0000000000bb",
          fonte: "cgu",
          regra: "valor_zerado_com_vigencia",
          severidade: "aviso",
          status: "confirmado",
          entidade_tipo: "contrato",
          entidade_id: "123456",
        },
      ],
    },
  },
  { label: "carregando", props: { ...base, isLoading: true, findingsLoading: true } },
];
