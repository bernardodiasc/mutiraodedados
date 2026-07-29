import type { ViewVariants } from "@/lib/style-guide/registry";
import type { TseImportPanelViewProps } from "@/components/TseImportPanelView";

const base: TseImportPanelViewProps = {
  tipo: "candidatos",
  ano: 2022,
  uf: "TODAS",
  autoContinuar: true,
  busy: false,
  statusAtual: null,
  progresso: [
    {
      tipo: "candidatos",
      ano: 2022,
      ufsCompletas: 28,
      ufsIniciadas: 28,
      importados: 29327,
      pendentes: [],
    },
    {
      tipo: "receitas",
      ano: 2022,
      ufsCompletas: 12,
      ufsIniciadas: 14,
      importados: 1250033,
      pendentes: ["SP", "MG"],
    },
  ],
  carregandoProgresso: false,
  ponteBusy: null,
  sinaisBusy: null,
  onRodarSinais: () => {},
  onAlterar: () => {},
  onImportar: () => {},
  onCancelar: () => {},
  onAtualizarProgresso: () => {},
  onContinuarPendentes: () => {},
  onSincronizarPonte: () => {},
};

export const tseImportPanelVariants: ViewVariants<TseImportPanelViewProps> = [
  { label: "ocioso com progresso", props: base },
  {
    label: "importando",
    props: { ...base, busy: true, statusAtual: "Candidatos 2022/SP (26/28 · rodada 2)" },
  },
  { label: "sem varreduras", props: { ...base, progresso: [] } },
];
