import { createFileRoute } from "@tanstack/react-router";
import { StickyNote } from "lucide-react";
import { ArtigosIndexView } from "@/components/ArtigosIndexView";

export const Route = createFileRoute("/notas/")({
  component: () => (
    <ArtigosIndexView
      categoria="nota"
      titulo="Notas de campo"
      descricao="Textos curtos e datados: análises de caso, mudanças em fontes oficiais e limitações de dados."
      icon={StickyNote}
      basePath="/notas"
      emptyLabel="Ainda não há notas publicadas."
    />
  ),
  head: () => ({
    meta: [
      { title: "Notas de campo — Auditoria Cidadã" },
      { name: "description", content: "Notas curtas sobre casos, mudanças em fontes e limitações de dados." },
      { property: "og:title", content: "Notas de campo — Auditoria Cidadã" },
      { property: "og:description", content: "Notas curtas sobre casos, fontes e dados públicos." },
      { property: "og:url", content: "https://auditoriacidada.ia.br/notas" },
    ],
    links: [{ rel: "canonical", href: "https://auditoriacidada.ia.br/notas" }],
  }),
});