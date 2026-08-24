import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  PainelInvestigarView,
  type PainelInvestigarViewProps,
} from "@/components/PainelInvestigarView";
import { listarPromptsDoMapa } from "@/lib/prompt-modelos.functions";

export type PainelInvestigarContainerProps = Omit<
  PainelInvestigarViewProps,
  "prompts" | "promptsLoading"
> & {
  /** Artigo (mapa) cujos prompts do banco entram no painel — nunca hardcode prompts. */
  mapaArtigoId?: string;
};

/** Container do painel "Investigar": busca os prompts do mapa vinculado, se houver. */
export function PainelInvestigarContainer({
  mapaArtigoId,
  ...viewProps
}: PainelInvestigarContainerProps) {
  const listar = useServerFn(listarPromptsDoMapa);
  const { data: prompts, isLoading } = useQuery({
    queryKey: ["prompts-mapa", mapaArtigoId],
    enabled: !!mapaArtigoId,
    staleTime: 60_000,
    queryFn: () => listar({ data: { artigoId: mapaArtigoId! } }),
  });

  return (
    <PainelInvestigarView
      {...viewProps}
      prompts={mapaArtigoId ? prompts : undefined}
      promptsLoading={!!mapaArtigoId && isLoading}
    />
  );
}
