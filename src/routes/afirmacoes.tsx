import { createFileRoute, Link } from "@tanstack/react-router";
import { Megaphone, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/afirmacoes")({
  component: AfirmacoesPage,
  head: () => ({
    meta: [
      { title: "Afirmações públicas — Mutirão de Dados" },
      {
        name: "description",
        content:
          "O que foi prometido, declarado ou afirmado publicamente sobre o funcionamento do Estado. Curadoria editorial — sem motor automático.",
      },
      { property: "og:title", content: "Afirmações públicas — Mutirão de Dados" },
      {
        property: "og:description",
        content:
          "Acompanhe declarações públicas relevantes e o que elas permitem perguntar, investigar e cobrar.",
      },
      { property: "og:url", content: "https://mutiraodedados.com.br/afirmacoes" },
    ],
    links: [{ rel: "canonical", href: "https://mutiraodedados.com.br/afirmacoes" }],
  }),
});

type Afirmacao = {
  id: string;
  texto: string;
  fonte: string;
  url: string;
  data: string;
  autor: string;
  perguntas: string[];
};

const AFIRMACOES: Afirmacao[] = [
  {
    id: "transparencia-ativa-2024",
    texto:
      "Todos os órgãos federais publicarão dados orçamentários abertos em formato reutilizável.",
    fonte: "Decreto de Governo Aberto",
    url: "https://www.gov.br/cgu/pt-br",
    data: "2024",
    autor: "Executivo federal",
    perguntas: [
      "Quais órgãos ainda não publicam dados em formato aberto?",
      "Quem fiscaliza o cumprimento desta promessa?",
    ],
  },
  {
    id: "emendas-rastreaveis",
    texto: "Toda emenda parlamentar passará a ter identificador único e rastreável até a execução.",
    fonte: "Acórdão TCU 1.247/2023",
    url: "https://portal.tcu.gov.br",
    data: "2023",
    autor: "Tribunal de Contas da União",
    perguntas: [
      "Quantas emendas pagas em 2024 ainda não têm identificador rastreável?",
      "É possível ligar emenda → contrato → fornecedor?",
    ],
  },
  {
    id: "pncp-unificacao",
    texto: "O PNCP unificará todas as contratações públicas do país em uma única base consultável.",
    fonte: "Lei 14.133/2021",
    url: "https://pncp.gov.br",
    data: "2021",
    autor: "Legislativo federal",
    perguntas: [
      "Quantos entes ainda não publicam no PNCP?",
      "Quais contratos faltam quando comparamos PNCP × Portal da Transparência?",
    ],
  },
];

function AfirmacoesPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <header className="max-w-3xl">
        <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-accent">
          <Megaphone className="size-4" /> O que foi prometido / declarado
        </div>
        <h1 className="font-display text-4xl sm:text-5xl mt-3 leading-tight">
          Afirmações públicas viram pontos de partida para investigar.
        </h1>
        <p className="text-muted-foreground mt-4 text-lg">
          Esta página é uma curadoria editorial — não um motor automático. Cada afirmação aponta
          para a fonte e propõe perguntas que ajudam a verificar seu cumprimento.
        </p>
      </header>

      <ul className="mt-10 space-y-5">
        {AFIRMACOES.map((a) => (
          <li key={a.id} className="border border-border rounded-xl p-6 bg-card">
            <blockquote className="font-display text-xl leading-snug">“{a.texto}”</blockquote>
            <div className="text-xs text-muted-foreground mt-3 flex flex-wrap gap-x-3 gap-y-1">
              <span>{a.autor}</span>
              <span>·</span>
              <a href={a.url} className="hover:text-accent" target="_blank" rel="noreferrer">
                {a.fonte}
              </a>
              <span>·</span>
              <span>{a.data}</span>
            </div>
            <div className="mt-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Perguntas que esta afirmação permite
              </div>
              <ul className="mt-2 space-y-1.5 text-sm">
                {a.perguntas.map((p) => (
                  <li key={p} className="flex gap-2">
                    <span className="text-accent">•</span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-10">
        <Link
          to="/perguntas"
          className="inline-flex items-center gap-1.5 text-sm font-semibold hover:text-accent"
        >
          Ver perguntas abertas <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}
