import { Map as MapIcon } from "lucide-react";
import type { ViewVariants } from "@/lib/style-guide/registry";
import type { ArtigosIndexListViewProps } from "@/components/ArtigosIndexListView";
import type { Artigo } from "@/lib/data/artigos.functions";

const baseArtigo: Artigo = {
  id: "a1",
  slug: "mapa-emendas-2026",
  titulo: "Mapa: Emendas parlamentares 2026",
  resumo: "Como rastrear o caminho de uma emenda do orçamento ao pagamento.",
  conteudo_md: "",
  categoria: "mapa",
  capa_url: null,
  dificuldade: "intermediario",
  tempo_estimado_min: 12,
  fontes_usadas: ["transferegov", "siconfi"],
  notas_internas: null,
  publico: true,
  publicado_em: "2026-04-15T12:00:00Z",
  autor_id: null,
  created_at: "2026-04-15T12:00:00Z",
  updated_at: "2026-04-15T12:00:00Z",
};

const baseProps: ArtigosIndexListViewProps = {
  categoria: "mapa",
  titulo: "Mapas",
  descricao: "Guias visuais para entender estruturas e fluxos do setor público.",
  icon: MapIcon,
  basePath: "/mapas",
  emptyLabel: "Nenhum mapa publicado ainda.",
  itens: [],
  isLoading: false,
};

export const artigosIndexListVariants: ViewVariants<ArtigosIndexListViewProps> = [
  { label: "carregando", props: { ...baseProps, isLoading: true } },
  { label: "vazio", props: baseProps },
  {
    label: "com itens",
    props: {
      ...baseProps,
      itens: [
        baseArtigo,
        { ...baseArtigo, id: "a2", slug: "mapa-pncp", titulo: "Mapa: PNCP", dificuldade: "iniciante", tempo_estimado_min: 6 },
      ],
    },
  },
];