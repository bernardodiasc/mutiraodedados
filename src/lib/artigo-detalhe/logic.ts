import type { ReactNode } from "react";

export type ArtigoDificuldade = "iniciante" | "intermediario" | "avancado";

export const DIFICULDADE_LABEL: Record<string, string> = {
  iniciante: "Iniciante",
  intermediario: "Intermediário",
  avancado: "Avançado",
};

export function obterRotuloDificuldade(dificuldade: string | null | undefined): string {
  if (!dificuldade) return "";
  return DIFICULDADE_LABEL[dificuldade] ?? dificuldade;
}

export type ArtigoDetalheViewProps = {
  isLoading: boolean;
  error: Error | null;
  artigo: {
    titulo: string;
    resumo?: string | null;
    conteudo_md: string;
    dificuldade?: string | null;
    tempo_estimado_min?: number | null;
    fontes_usadas: string[];
  } | null;
  voltarTo: "/mapas" | "/tutoriais" | "/notas";
  voltarLabel: string;
  /** Kit de investigação (aside sticky) — presente só em mapas. */
  kit?: ReactNode;
  /** Ações do artigo (copiar/salvar) — usadas em tutoriais e notas. */
  acoes?: ReactNode;
};

/** H1 da página de um artigo (mapa, nota ou tutorial) — também vira o título da aba. */
export function h1DoArtigo(artigo: { titulo: string } | null | undefined): string | null {
  return artigo?.titulo ?? null;
}
