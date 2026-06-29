import type { ViewVariants } from "@/lib/style-guide/registry";
import type { AnotacoesCadernoViewProps } from "@/components/AnotacoesCadernoView";
import type { Anotacao } from "@/lib/anotacoes.functions";
import { DRAFT_INICIAL } from "./logic";

const noop = () => {};
const noopP = (_: unknown) => {};

const a1: Anotacao = {
  id: "1",
  user_id: "u",
  titulo: "Pista sobre fornecedor X",
  conteudo_md: "Apareceu em 3 contratos seguidos sem licitação aparente.",
  entidade_tipo: null,
  entidade_id: null,
  pergunta_id: null,
  tags: [],
  created_at: "2026-06-01T10:00:00Z",
  updated_at: "2026-06-10T10:00:00Z",
};

const base: AnotacoesCadernoViewProps = {
  anotacoes: [],
  isLoading: false,
  errorMsg: null,
  draft: null,
  isSaving: false,
  removingId: null,
  onComecarNova: noop,
  onComecarEditar: noopP as AnotacoesCadernoViewProps["onComecarEditar"],
  onCancelar: noop,
  onAlterarDraft: noopP as AnotacoesCadernoViewProps["onAlterarDraft"],
  onSalvarDraft: noop,
  onRemover: noopP as AnotacoesCadernoViewProps["onRemover"],
};

export const anotacoesCadernoVariants: ViewVariants<AnotacoesCadernoViewProps> = [
  { label: "vazio", props: base },
  { label: "carregando", props: { ...base, isLoading: true } },
  { label: "com anotações", props: { ...base, anotacoes: [a1] } },
  {
    label: "editando nova",
    props: { ...base, draft: { ...DRAFT_INICIAL, titulo: "Rascunho" } },
  },
];