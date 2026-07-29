import { createFileRoute } from "@tanstack/react-router";
import { Route as RouteIcon } from "lucide-react";
import { ArtigosIndexView } from "@/components/ArtigosIndexView";

export const Route = createFileRoute("/mapas/")({
  component: () => (
    <ArtigosIndexView
      categoria="mapa"
      titulo="Mapas investigativos"
      descricao="O manual técnico da fiscalização. Cada mapa é uma receita prática — uma sequência cirúrgica de passos para responder a uma dúvida específica do banco de dados público. O foco é a engenharia de dados: quais fontes oficiais consultar e como conectá-las pelas chaves de cruzamento (CNPJ, nota de empenho, código do convênio, do edital ao pagamento). Para o método e a mentalidade da investigação, comece pelas Trilhas; aqui é mão na massa."
      icon={RouteIcon}
      basePath="/mapas"
      emptyLabel="Ainda não há mapas publicados. Em breve."
    />
  ),
  head: () => ({
    meta: [
      { title: "Mapas investigativos — Mutirão de Dados" },
      {
        name: "description",
        content:
          "Manual técnico da fiscalização: receitas práticas de cruzamento de dados e sistemas (CNPJ, nota de empenho, convênio) a partir das fontes oficiais brasileiras.",
      },
      { property: "og:title", content: "Mapas investigativos — Mutirão de Dados" },
      { property: "og:description", content: "Receitas práticas de engenharia de dados sobre as fontes oficiais — chaves de cruzamento para responder dúvidas específicas." },
      { property: "og:url", content: "https://mutiraodedados.com.br/mapas" },
    ],
    links: [{ rel: "canonical", href: "https://mutiraodedados.com.br/mapas" }],
  }),
});