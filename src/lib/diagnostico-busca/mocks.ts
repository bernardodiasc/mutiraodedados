import type { ComponentProps } from "react";
import type { DiagnosticoBuscaView } from "@/components/DiagnosticoBuscaView";
import type { ViewVariants } from "@/lib/style-guide/registry";
import { linhaDiagnostico } from "./logic";

const AGORA = new Date("2026-09-26T12:00:00Z");
const noop = () => {};

const linhas = [
  linhaDiagnostico(
    {
      colecao: "pncp_contratos_cache",
      medidas: { cache: 48210, publicaveis: 48210, indice: 48210 },
      fontes: [
        { titulo: "PNCP — contratos públicos", ultima: "2026-09-20T10:00:00Z", limiarDias: 45 },
      ],
    },
    AGORA,
  ),
  linhaDiagnostico(
    {
      colecao: "cgu_licitacoes_cache",
      medidas: { cache: 186, publicaveis: 186, indice: 183 },
      fontes: [
        {
          titulo: "Portal CGU — licitações do Executivo",
          ultima: "2026-06-01T10:00:00Z",
          limiarDias: 45,
        },
      ],
    },
    AGORA,
  ),
  linhaDiagnostico(
    {
      colecao: "tse_candidatos_cache",
      medidas: { cache: 1_204_331, publicaveis: null, indice: 1_204_310 },
      fontes: [{ titulo: "TSE — eleições", ultima: null, limiarDias: 400 }],
    },
    AGORA,
  ),
  linhaDiagnostico(
    { colecao: "artigos", medidas: { cache: 25, publicaveis: 21, indice: 21 }, fontes: [] },
    AGORA,
  ),
];

const base: ComponentProps<typeof DiagnosticoBuscaView> = {
  estado: "pronto",
  linhas,
  mensagemErro: null,
  atualizando: false,
  onAtualizar: noop,
  recorte: null,
  onAbrirRecorte: noop,
  onIdsTexto: noop,
  onCancelarRecorte: noop,
  onReindexar: noop,
  reindexando: false,
  resultado: null,
};

export const diagnosticoBuscaVariants: ViewVariants<ComponentProps<typeof DiagnosticoBuscaView>> = [
  { label: "conciliação por coleção", props: base },
  {
    label: "reindexar recorte aberto",
    props: {
      ...base,
      recorte: { colecao: "cgu_licitacoes_cache", idsTexto: "123456\n123457" },
      resultado: null,
    },
  },
  {
    label: "depois de reindexar",
    props: {
      ...base,
      resultado: {
        colecao: "cgu_licitacoes_cache",
        texto: "3 linhas gravadas ou retiradas do índice.",
      },
    },
  },
  { label: "carregando", props: { ...base, estado: "carregando", linhas: [] } },
  {
    label: "erro",
    props: {
      ...base,
      estado: "erro",
      linhas: [],
      mensagemErro: "Acesso restrito: somente administradores.",
    },
  },
];
