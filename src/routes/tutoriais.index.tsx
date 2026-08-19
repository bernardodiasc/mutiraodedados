import { createFileRoute } from "@tanstack/react-router";
import { GraduationCap } from "lucide-react";
import { ArtigosIndexView } from "@/components/ArtigosIndexView";

export const Route = createFileRoute("/tutoriais/")({
  component: () => (
    <ArtigosIndexView
      categoria="tutorial"
      titulo="Tutoriais da ferramenta"
      descricao="Como usar as ferramentas do site: busca unificada, radar de risco, marcações, cota parlamentar e mais."
      icon={GraduationCap}
      basePath="/tutoriais"
      emptyLabel="Ainda não há tutoriais publicados."
    />
  ),
  head: () => ({
    meta: [
      { title: "Tutoriais da ferramenta — Mutirão de Dados" },
      {
        name: "description",
        content: "Tutoriais práticos sobre como usar as ferramentas do Mutirão de Dados.",
      },
      { property: "og:title", content: "Tutoriais da ferramenta — Mutirão de Dados" },
      {
        property: "og:description",
        content: "Tutoriais práticos sobre como usar as ferramentas do site.",
      },
      { property: "og:url", content: "https://mutiraodedados.com.br/tutoriais" },
    ],
    links: [{ rel: "canonical", href: "https://mutiraodedados.com.br/tutoriais" }],
  }),
});
