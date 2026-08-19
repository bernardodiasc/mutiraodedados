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
  {
    // Eleição em curso: o TSE publica os arquivos em etapas, e o botão precisa
    // dizer o que falta em vez de disparar uma rodada que termina em 404.
    label: "2026 — tipo ainda não publicado pelo TSE",
    props: { ...base, tipo: "resultados", ano: 2026, progresso: [] },
  },
  {
    // Borda de baixo: esperar não resolve, o arquivo nunca existiu.
    label: "1998 — tipo que o TSE só passou a publicar depois",
    props: { ...base, tipo: "bens", ano: 1998, progresso: [] },
  },
];
