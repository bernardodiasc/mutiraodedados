import type { ViewVariants } from "@/lib/style-guide/registry";
import type { FlagsCidadaViewProps, FlagRow } from "@/components/FlagsCidadaView";

const noop = () => {};

const flag1: FlagRow = {
  id: "f1",
  user_id: "u1",
  entidade_tipo: "contrato",
  entidade_id: "c-1",
  tipo: "suspeita",
  comentario: "Valor parece bem acima do mercado para serviço de copa.",
  created_at: "2026-05-01T10:00:00Z",
  displayName: "Ana",
};
const flag2: FlagRow = {
  id: "f2",
  user_id: "u2",
  entidade_tipo: "contrato",
  entidade_id: "c-1",
  tipo: "contexto",
  comentario: "Contrato emergencial pós-enchente; ver portaria 123/2026.",
  created_at: "2026-05-02T10:00:00Z",
  displayName: "João",
};

const base: FlagsCidadaViewProps = {
  hasUser: true,
  loading: false,
  flags: [],
  votes: {},
  tipo: "suspeita",
  onTipoChange: noop,
  comentario: "",
  onComentarioChange: noop,
  onSubmit: noop,
  onVote: noop,
};

export const flagsCidadaVariants: ViewVariants<FlagsCidadaViewProps> = [
  { label: "deslogado", props: { ...base, hasUser: false } },
  { label: "vazio / logado", props: base },
  { label: "carregando", props: { ...base, loading: true } },
  {
    label: "com marcações",
    props: { ...base, flags: [flag1, flag2], votes: { f1: 3, f2: -1 } },
  },
];