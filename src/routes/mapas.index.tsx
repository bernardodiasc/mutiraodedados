import { createFileRoute } from "@tanstack/react-router";
import { Route as RouteIcon } from "lucide-react";
import { ArtigosIndexView } from "@/components/ArtigosIndexView";

export const Route = createFileRoute("/mapas/")({
  component: () => (
    <ArtigosIndexView
      categoria="mapa"
      titulo="Mapas investigativos"
      descricao="Guias passo-a-passo para investigar dinheiro público — do edital ao pagamento, da emenda ao convênio. Cada mapa parte de uma pergunta concreta e indica as fontes oficiais necessárias."
      icon={RouteIcon}
      basePath="/mapas"
      emptyLabel="Ainda não há mapas publicados. Em breve."
    />
  ),
  head: () => ({
    meta: [
      { title: "Mapas investigativos — Auditoria Cidadã" },
      {
        name: "description",
        content:
          "Guias passo-a-passo para investigar contratos, emendas, transferências e despesas públicas usando dados abertos brasileiros.",
      },
      { property: "og:title", content: "Mapas investigativos — Auditoria Cidadã" },
      { property: "og:description", content: "Caminhos investigativos guiados a partir de fontes oficiais." },
      { property: "og:url", content: "https://auditoriacidada.ia.br/mapas" },
    ],
    links: [{ rel: "canonical", href: "https://auditoriacidada.ia.br/mapas" }],
  }),
});