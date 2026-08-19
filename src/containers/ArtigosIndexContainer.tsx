import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import { listarArtigosPublicos, type ArtigoCategoria } from "@/lib/data/artigos.functions";
import { ArtigosIndexListView } from "@/components/ArtigosIndexListView";
import type { ArtigoBasePath } from "@/lib/artigos-index/logic";

export type ArtigosIndexContainerProps = {
  categoria: ArtigoCategoria;
  titulo: string;
  descricao: string;
  icon: LucideIcon;
  /** Caminho base sem trailing slash, ex: "/mapas" */
  basePath: ArtigoBasePath;
  emptyLabel: string;
};

export function ArtigosIndexContainer(props: ArtigosIndexContainerProps) {
  const fetchLista = useServerFn(listarArtigosPublicos);
  const { data: itens = [], isLoading } = useQuery({
    queryKey: ["artigos-publicos", props.categoria],
    queryFn: () => fetchLista({ data: { categoria: props.categoria } }),
  });

  return <ArtigosIndexListView {...props} itens={itens} isLoading={isLoading} />;
}

ArtigosIndexContainer.displayName = "ArtigosIndexContainer";
