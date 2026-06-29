import { createFileRoute, Link } from "@tanstack/react-router";
import { CircleDashed, ArrowRight } from "lucide-react";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { listarLacunasPublicas, type Lacuna } from "@/lib/lacunas.functions";

const lacunasQuery = queryOptions({
  queryKey: ["lacunas", "publicas"],
  queryFn: () => listarLacunasPublicas({ data: {} }),
});

export const Route = createFileRoute("/lacunas")({
  component: LacunasPage,
  loader: ({ context }) => context.queryClient.ensureQueryData(lacunasQuery),
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-2xl font-display">Não foi possível carregar lacunas</h1>
      <p className="text-sm text-muted-foreground mt-2">{error.message}</p>
    </div>
  ),
  notFoundComponent: () => <div className="p-8">Lacuna não encontrada.</div>,
  head: () => ({
    meta: [
      { title: "Informação que falta — Auditoria Cidadã" },
      { name: "description", content: "O que ainda não é público sobre o funcionamento do Estado: lacunas de transparência, avaliação, mensuração, documento, instituição e método." },
      { property: "og:title", content: "Informação que falta — Auditoria Cidadã" },
      { property: "og:description", content: "A ausência de informação é, ela mesma, um achado. Mapa de lacunas do Estado brasileiro." },
      { property: "og:url", content: "https://auditoriacidada.ia.br/lacunas" },
    ],
    links: [{ rel: "canonical", href: "https://auditoriacidada.ia.br/lacunas" }],
  }),
});

const TIPOS = [
  { key: "transparencia", tipo: "Transparência", desc: "O dado existe mas não está publicado." },
  { key: "avaliacao", tipo: "Avaliação", desc: "Política sem indicador público que permita avaliar resultado." },
  { key: "mensuracao", tipo: "Mensuração", desc: "Não há método claro para medir o que se quer saber." },
  { key: "documental", tipo: "Documental", desc: "Falta o documento original que sustenta a decisão." },
  { key: "institucional", tipo: "Institucional", desc: "Não está claro qual órgão é responsável." },
  { key: "metodologica", tipo: "Metodológica", desc: "Os dados existem mas não são comparáveis entre si." },
] as const;

const TIPO_LABEL: Record<string, string> = Object.fromEntries(
  TIPOS.map((t) => [t.key, t.tipo]),
);
const CICLO_LABEL: Record<string, string> = {
  nasce: "Nasce",
  qualificada: "Qualificada",
  evolui: "Evolui",
  conecta: "Conecta",
  encerra: "Encerrada",
};

function LacunasPage() {
  const { data: lacunas } = useSuspenseQuery(lacunasQuery);
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <header className="max-w-3xl">
        <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-accent">
          <CircleDashed className="size-4" /> O que ainda não é público
        </div>
        <h1 className="font-display text-4xl sm:text-5xl mt-3 leading-tight">
          A ausência de informação também é um achado.
        </h1>
        <p className="text-muted-foreground mt-4 text-lg">
          Mapeamos seis tipos de lacuna no funcionamento público. Cada lacuna é registrada,
          qualificada e acompanhada — e não desaparece quando é resolvida: vira memória.
        </p>
      </header>

      <section className="mt-10">
        <h2 className="font-display text-2xl">Tipologia</h2>
        <ul className="mt-4 grid sm:grid-cols-2 gap-3">
          {TIPOS.map((t) => (
            <li key={t.tipo} className="border border-border rounded-xl p-5 bg-card">
              <div className="font-semibold">{t.tipo}</div>
              <p className="text-sm text-muted-foreground mt-1">{t.desc}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-2xl">Ciclo de vida de uma lacuna</h2>
        <ol className="mt-4 grid sm:grid-cols-5 gap-2 text-sm">
          {["Nasce", "Qualificada", "Evolui", "Conecta", "Encerra"].map((etapa, i) => (
            <li
              key={etapa}
              className="border border-border rounded-md px-3 py-2 bg-card flex items-center gap-2"
            >
              <span className="text-[11px] font-semibold text-accent">{i + 1}</span>
              {etapa}
            </li>
          ))}
        </ol>
        <p className="text-xs text-muted-foreground mt-3">
          Uma lacuna encerrada permanece visível como memória pública — só ganha
          <span className="mx-1 font-semibold">resolvida em</span>.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-2xl">Lacunas registradas</h2>
        {lacunas.length === 0 ? (
          <p className="text-sm text-muted-foreground mt-3">
            Nenhuma lacuna publicada ainda. As primeiras serão convertidas a partir
            de findings de <Link to="/qualidade" className="underline">qualidade dos dados</Link>.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {lacunas.map((l: Lacuna) => (
              <li key={l.id} className="border border-border rounded-xl p-5 bg-card">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <CircleDashed className="size-3.5" />
                  {TIPO_LABEL[l.tipo] ?? l.tipo}
                  <span className="text-accent">· {CICLO_LABEL[l.ciclo] ?? l.ciclo}</span>
                  {l.resolvida_em ? (
                    <span className="ml-auto text-emerald-600 dark:text-emerald-400">
                      resolvida
                    </span>
                  ) : null}
                </div>
                <div className="font-semibold mt-1.5">{l.titulo}</div>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed whitespace-pre-line">
                  {l.descricao}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link to="/qualidade" className="inline-flex items-center gap-1.5 text-sm font-semibold hover:text-accent">
          De onde vêm: qualidade dos dados <ArrowRight className="size-3.5" />
        </Link>
        <Link to="/perguntas" className="inline-flex items-center gap-1.5 text-sm font-semibold hover:text-accent">
          Perguntas relacionadas <ArrowRight className="size-3.5" />
        </Link>
      </div>

      <p className="text-xs text-muted-foreground mt-8 leading-relaxed max-w-3xl">
        Página inicial do mapa de lacunas. Em breve, cada lacuna terá registro próprio,
        vínculo com perguntas e entidades, e ciclo de vida visível.
      </p>
    </div>
  );
}