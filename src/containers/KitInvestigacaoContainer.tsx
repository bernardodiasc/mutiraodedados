import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "@tanstack/react-router";
import { listarPromptsDoMapa } from "@/lib/prompt-modelos.functions";
import { listarPastasComPrompts } from "@/lib/pergunta-itens.functions";
import { useAuth } from "@/hooks/use-auth";
import { useRolarAteAncora } from "@/hooks/use-rolar-ate-ancora";
import { KitInvestigacaoView } from "@/components/KitInvestigacaoView";

export type KitInvestigacaoContainerProps = {
  artigoId: string;
  slug: string;
  titulo: string;
  obterTextoMapa: () => string;
};

export function KitInvestigacaoContainer({
  artigoId,
  slug,
  titulo,
  obterTextoMapa,
}: KitInvestigacaoContainerProps) {
  const { user } = useAuth();
  const fetchPrompts = useServerFn(listarPromptsDoMapa);
  const fetchPastas = useServerFn(listarPastasComPrompts);
  // `#prompt-<id>` (destino da busca) abre o prompt e rola até ele.
  const hash = useLocation({ select: (l) => l.hash });
  const promptAlvo = hash.startsWith("prompt-") ? hash.slice("prompt-".length) : null;

  const { data: prompts, isLoading } = useQuery({
    queryKey: ["mapa-prompts", artigoId],
    queryFn: () => fetchPrompts({ data: { artigoId } }),
  });

  useRolarAteAncora(!isLoading);

  const promptIds = (prompts ?? []).map((p) => p.id);
  const { data: pastas } = useQuery({
    queryKey: ["mapa-pastas", promptIds],
    queryFn: () => fetchPastas({ data: { promptIds } }),
    enabled: Boolean(user) && promptIds.length > 0,
  });

  return (
    <KitInvestigacaoView
      slug={slug}
      titulo={titulo}
      obterTextoMapa={obterTextoMapa}
      prompts={prompts ?? []}
      promptsLoading={isLoading}
      promptAlvo={promptAlvo}
      pastas={pastas ?? []}
    />
  );
}
KitInvestigacaoContainer.displayName = "KitInvestigacaoContainer";
