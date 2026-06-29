import type { ViewVariants } from "@/lib/style-guide/registry";
import type { CadernoPerguntasSalvasViewProps } from "@/components/CadernoPerguntasSalvasView";
import type { Pergunta } from "@/lib/perguntas.functions";

const noop = () => {};
const noopP = (_: string) => {};

const p1: Pergunta = {
  id: "1",
  user_id: "u",
  modelo_id: null,
  titulo: "Por que esta obra atrasou?",
  descricao: null,
  contexto: "Atrasos em obras públicas envolvem licitação, projeto, fiscalização e repasse.",
  tags: [],
  status: "privada",
  visibilidade_publica: false,
  slug: null,
  publicada_em: null,
  arquivada_em: null,
  encerrada_em: null,
  solicitada_publicacao_em: null,
  motivo_rejeicao: null,
  created_at: "2026-06-15T12:00:00Z",
  updated_at: "2026-06-15T12:00:00Z",
};

const base: CadernoPerguntasSalvasViewProps = {
  perguntas: [],
  isLoading: false,
  errorMsg: null,
  removingId: null,
  onRemover: noopP,
};

void noop;

export const cadernoPerguntasSalvasVariants: ViewVariants<CadernoPerguntasSalvasViewProps> = [
  { label: "vazio", props: base },
  { label: "carregando", props: { ...base, isLoading: true } },
  { label: "erro", props: { ...base, errorMsg: "Erro de exemplo" } },
  { label: "com perguntas", props: { ...base, perguntas: [p1] } },
];