import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

const BASE_URL = "https://auditoriacidada.ia.br";

interface SitemapEntry {
  path: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

const ENTRIES: SitemapEntry[] = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/anomalias", changefreq: "daily", priority: "0.9" },
  { path: "/orgaos", changefreq: "weekly", priority: "0.8" },
  { path: "/congresso", changefreq: "weekly", priority: "0.8" },
  { path: "/camara", changefreq: "weekly", priority: "0.7" },
  { path: "/camara/deputados", changefreq: "weekly", priority: "0.6" },
  { path: "/camara/proposicoes", changefreq: "weekly", priority: "0.6" },
  { path: "/camara/votacoes", changefreq: "weekly", priority: "0.6" },
  { path: "/senado", changefreq: "weekly", priority: "0.7" },
  { path: "/senado/materias", changefreq: "weekly", priority: "0.6" },
  { path: "/senado/senadores", changefreq: "weekly", priority: "0.6" },
  { path: "/senado/votacoes", changefreq: "weekly", priority: "0.6" },
  { path: "/pncp", changefreq: "weekly", priority: "0.6" },
  { path: "/siconfi", changefreq: "monthly", priority: "0.5" },
  { path: "/transferencias", changefreq: "weekly", priority: "0.6" },
  { path: "/buscar", changefreq: "monthly", priority: "0.5" },
  { path: "/explorar", changefreq: "monthly", priority: "0.5" },
  { path: "/aprender", changefreq: "monthly", priority: "0.7" },
  { path: "/metodologia", changefreq: "monthly", priority: "0.7" },
  { path: "/sobre", changefreq: "monthly", priority: "0.6" },
  { path: "/transparencia-institucional", changefreq: "monthly", priority: "0.5" },
  { path: "/contestar", changefreq: "yearly", priority: "0.4" },
  { path: "/privacidade", changefreq: "yearly", priority: "0.3" },
  { path: "/termos", changefreq: "yearly", priority: "0.3" },
  { path: "/tratamento-de-dados", changefreq: "yearly", priority: "0.3" },
];

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const urls = ENTRIES.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});