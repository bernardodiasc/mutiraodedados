import type { ComponentProps } from "react";
import type { ReferenciasArtigoView } from "@/components/ReferenciasArtigoView";
import type { ViewVariants } from "@/lib/style-guide/registry";

const noop = () => {};

const base: ComponentProps<typeof ReferenciasArtigoView> = {
  estado: "pronto",
  mensagemErro: null,
  colecoes: ["cgu_licitacoes_cache", "contratos_cache", "pncp_contratos_cache"],
  busy: false,
  manual: { tipo: "registro", a: "cgu_licitacoes_cache", b: "" },
  setManual: noop,
  onConfirmar: noop,
  onRemover: noop,
  onVerificar: noop,
  onAtualizarSugestoes: noop,
  referencias: [
    {
      id: "r1",
      tipo: "registro",
      colecao: "cgu_licitacoes_cache",
      idOrigem: "123456",
      consultaUrl: null,
      rotulo: null,
      tituloCitado: "Licitação 90001/2024 — Universidade Federal",
      verificadoEm: "2026-09-20T12:00:00Z",
      href: "/licitacoes/123456",
      motivos: [],
    },
    {
      id: "r2",
      tipo: "registro",
      colecao: "contratos_cache",
      idOrigem: "998",
      consultaUrl: null,
      rotulo: null,
      tituloCitado: "Contrato 12/2024 — Ministério da Saúde",
      verificadoEm: "2026-08-01T12:00:00Z",
      href: null,
      motivos: ["sumiu"],
    },
    {
      id: "r3",
      tipo: "consulta",
      colecao: null,
      idOrigem: null,
      consultaUrl: "/buscar?q=merenda&tipo=contratos",
      rotulo: null,
      tituloCitado: null,
      verificadoEm: "2026-09-01T12:00:00Z",
      href: "/buscar?q=merenda&tipo=contratos",
      motivos: ["consulta_vazia"],
    },
  ],
  sugestoes: [
    {
      caminho: "/licitacoes/777",
      texto: "a licitação do pregão",
      situacao: "nova",
      tipo: "registro",
      colecao: "cgu_licitacoes_cache",
      idOrigem: "777",
      titulo: "Licitação 5/2025 — Comando do Exército",
    },
    {
      caminho: "/contratos/42",
      texto: "o contrato",
      situacao: "ambigua",
      tipo: "registro",
      candidatos: [
        { colecao: "contratos_cache", idOrigem: "42", titulo: "Contrato 42 — CGU" },
        { colecao: "pncp_contratos_cache", idOrigem: "42", titulo: "Contrato 42 — PNCP" },
      ],
    },
    { caminho: "/emendas/000", texto: "", situacao: "nao_encontrada", tipo: "registro" },
  ],
};

export const referenciasArtigoVariants: ViewVariants<ComponentProps<typeof ReferenciasArtigoView>> =
  [
    { label: "com revisão pendente e sugestões", props: base },
    { label: "sem referências", props: { ...base, referencias: [], sugestoes: [] } },
    {
      label: "cadastro de consulta",
      props: { ...base, manual: { tipo: "consulta", a: "/buscar?q=pregão", b: "" } },
    },
    { label: "carregando", props: { ...base, estado: "carregando" } },
  ];
