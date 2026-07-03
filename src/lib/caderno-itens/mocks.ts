import type { ViewVariants } from "@/lib/style-guide/registry";
import type { CadernoItensSalvosViewProps } from "@/components/CadernoItensSalvosView";
import type { ItemSalvo } from "@/lib/itens-salvos.functions";

const noopP = (_: string) => {};

const i1: ItemSalvo = {
  id: "1",
  user_id: "u",
  entidade_tipo: "contrato",
  entidade_id: "c-1",
  titulo: "Contrato 12345/2026 — Aquisição de material",
  url: "/contratos/c-1",
  contexto: "Valor R$ 2,3 mi; órgão XPTO.",
  tags: [],
  conteudo_snapshot: '{\n  "valor": 2300000\n}',
  snapshot_em: "2026-06-01T10:00:00Z",
  snapshot_hash: "abc123",
  snapshot_verificado_em: null,
  snapshot_divergiu_em: null,
  created_at: "2026-06-01T10:00:00Z",
  updated_at: "2026-06-01T10:00:00Z",
};

const base: CadernoItensSalvosViewProps = {
  itens: [],
  isLoading: false,
  errorMsg: null,
  removingId: null,
  onRemover: noopP,
  verificandoId: null,
  onVerificar: noopP,
  onAtualizarSnapshot: noopP,
};

export const cadernoItensSalvosVariants: ViewVariants<CadernoItensSalvosViewProps> = [
  { label: "vazio", props: base },
  { label: "carregando", props: { ...base, isLoading: true } },
  { label: "com itens", props: { ...base, itens: [i1] } },
];