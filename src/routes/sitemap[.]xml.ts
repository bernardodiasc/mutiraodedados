import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

const BASE_URL = "https://mutiraodedados.com.br";

interface SitemapEntry {
  path: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

// Siglas das 27 UFs — cada estado tem página própria em /entes/$uf.
const UFS = [
  "ac",
  "al",
  "am",
  "ap",
  "ba",
  "ce",
  "df",
  "es",
  "go",
  "ma",
  "mg",
  "ms",
  "mt",
  "pa",
  "pb",
  "pe",
  "pi",
  "pr",
  "rj",
  "rn",
  "ro",
  "rr",
  "rs",
  "sc",
  "se",
  "sp",
  "to",
];

const ENTRIES: SitemapEntry[] = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  // Explorar — ferramentas
  { path: "/buscar", changefreq: "monthly", priority: "0.5" },
  { path: "/explorar", changefreq: "monthly", priority: "0.6" },
  { path: "/orgaos", changefreq: "weekly", priority: "0.8" },
  ...UFS.map((uf) => ({
    path: `/entes/${uf}`,
    changefreq: "weekly" as const,
    priority: "0.6",
  })),
  // Explorar — parlamento
  { path: "/congresso", changefreq: "weekly", priority: "0.8" },
  { path: "/camara", changefreq: "weekly", priority: "0.7" },
  { path: "/camara/deputados", changefreq: "weekly", priority: "0.6" },
  { path: "/camara/proposicoes", changefreq: "weekly", priority: "0.6" },
  { path: "/camara/votacoes", changefreq: "weekly", priority: "0.6" },
  { path: "/senado", changefreq: "weekly", priority: "0.7" },
  { path: "/senado/materias", changefreq: "weekly", priority: "0.6" },
  { path: "/senado/senadores", changefreq: "weekly", priority: "0.6" },
  { path: "/senado/votacoes", changefreq: "weekly", priority: "0.6" },
  // Explorar — por fonte
  { path: "/portal-cgu", changefreq: "monthly", priority: "0.6" },
  { path: "/pncp", changefreq: "weekly", priority: "0.6" },
  { path: "/siconfi", changefreq: "monthly", priority: "0.5" },
  { path: "/transferegov", changefreq: "monthly", priority: "0.6" },
  { path: "/tse", changefreq: "monthly", priority: "0.6" },
  // Explorar — por tipo
  { path: "/contratos", changefreq: "weekly", priority: "0.7" },
  { path: "/licitacoes", changefreq: "weekly", priority: "0.7" },
  { path: "/fornecedores", changefreq: "weekly", priority: "0.7" },
  { path: "/convenios", changefreq: "weekly", priority: "0.7" },
  { path: "/emendas", changefreq: "weekly", priority: "0.7" },
  { path: "/eleicoes", changefreq: "weekly", priority: "0.7" },
  { path: "/eleicoes/candidatos", changefreq: "weekly", priority: "0.6" },
  { path: "/relatorios-fiscais", changefreq: "weekly", priority: "0.6" },
  { path: "/transferencias", changefreq: "monthly", priority: "0.4" },
  // Investigar
  { path: "/anomalias", changefreq: "daily", priority: "0.9" },
  { path: "/qualidade", changefreq: "daily", priority: "0.6" },
  { path: "/cobertura", changefreq: "weekly", priority: "0.5" },
  { path: "/lacunas", changefreq: "weekly", priority: "0.5" },
  { path: "/perguntas", changefreq: "weekly", priority: "0.5" },
  { path: "/afirmacoes", changefreq: "weekly", priority: "0.5" },
  { path: "/transparencia-institucional", changefreq: "monthly", priority: "0.5" },
  { path: "/contestar", changefreq: "yearly", priority: "0.4" },
  // Aprender
  { path: "/aprender", changefreq: "monthly", priority: "0.7" },
  { path: "/metodologia", changefreq: "monthly", priority: "0.7" },
  { path: "/trilhas", changefreq: "monthly", priority: "0.5" },
  { path: "/tutoriais", changefreq: "monthly", priority: "0.5" },
  { path: "/mapas", changefreq: "monthly", priority: "0.5" },
  { path: "/notas", changefreq: "monthly", priority: "0.4" },
  // Sobre
  { path: "/sobre", changefreq: "monthly", priority: "0.6" },
  { path: "/roadmap", changefreq: "weekly", priority: "0.4" },
  { path: "/referencias", changefreq: "monthly", priority: "0.3" },
  { path: "/contribuir", changefreq: "monthly", priority: "0.4" },
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
