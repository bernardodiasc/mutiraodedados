import { createFileRoute, Link } from "@tanstack/react-router";
import { HelpCircle, ArrowRight, Sparkles, Globe, Plus } from "lucide-react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listarModelosAtivos } from "@/lib/pergunta-modelos.functions";
import { listarPerguntasPublicas } from "@/lib/perguntas.functions";

export const Route = createFileRoute("/perguntas")({
  component: PerguntasPage,
  head: () => ({
    meta: [
      { title: "Perguntas — Auditoria Cidadã" },
      { name: "description", content: "Modelos de pergunta e investigações públicas. Comece sua pasta de investigação." },
      { property: "og:title", content: "Perguntas — Auditoria Cidadã" },
      { property: "og:description", content: "Modelos para começar uma investigação e perguntas já em andamento publicamente." },
      { property: "og:url", content: "https://auditoriacidada.ia.br/perguntas" },
    ],
    links: [{ rel: "canonical", href: "https://auditoriacidada.ia.br/perguntas" }],
  }),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData({
        queryKey: ["pergunta-modelos", "ativos"],
        queryFn: () => listarModelosAtivos(),
      }),
      context.queryClient.ensureQueryData({
        queryKey: ["perguntas", "publicas"],
        queryFn: () => listarPerguntasPublicas(),
      }),
    ]);
  },
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="font-display text-2xl">Erro</h1>
      <p className="text-sm text-muted-foreground">{error.message}</p>
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-4 py-16">Página não encontrada.</div>
  ),
});

function formatarData(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("pt-BR");
}

function PerguntasPage() {
  const listarModelos = useServerFn(listarModelosAtivos);
  const listarPublicas = useServerFn(listarPerguntasPublicas);
  const { data: modelos } = useSuspenseQuery({
    queryKey: ["pergunta-modelos", "ativos"],
    queryFn: () => listarModelos(),
  });
  const { data: publicas } = useSuspenseQuery({
    queryKey: ["perguntas", "publicas"],
    queryFn: () => listarPublicas(),
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <header className="max-w-3xl">
        <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-accent">
          <HelpCircle className="size-4" /> Modo perguntar
        </div>
        <h1 className="font-display text-4xl sm:text-5xl mt-3 leading-tight">
          Toda investigação começa por uma pergunta.
        </h1>
        <p className="text-muted-foreground mt-4 text-lg">
          Uma pergunta é uma <strong>pasta de investigação</strong>. Nasce privada no seu
          caderno, ganha itens e anotações, e pode (se você quiser) virar pública.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            to="/caderno/nova"
            className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-md bg-foreground text-background hover:opacity-90"
          >
            <Plus className="size-3.5" /> Criar pergunta no meu caderno
          </Link>
        </div>
      </header>

      <section className="mt-12">
        <h2 className="font-display text-2xl inline-flex items-center gap-2">
          <Globe className="size-5 text-accent" /> Investigações públicas
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Perguntas que cidadãos publicaram. O autor é anônimo; o conteúdo é público.
        </p>
        {publicas.length === 0 ? (
          <div className="mt-6 border border-dashed border-border rounded-xl p-6 bg-card text-sm text-muted-foreground">
            Nenhuma investigação publicada ainda. Seja o primeiro — crie a sua e solicite publicação.
          </div>
        ) : (
          <ul className="mt-6 grid gap-3">
            {publicas.map((p) => (
              <li
                key={p.id}
                className="border border-border rounded-xl p-5 bg-card flex flex-col gap-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <Link
                    to="/perguntas/$slug"
                    params={{ slug: p.slug ?? "" }}
                    className="font-display text-lg leading-snug hover:text-accent"
                  >
                    {p.titulo}
                  </Link>
                  {p.status === "encerrada" && (
                    <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-muted text-muted-foreground">
                      Encerrada
                    </span>
                  )}
                </div>
                {p.descricao ? (
                  <p className="text-sm text-muted-foreground leading-relaxed">{p.descricao}</p>
                ) : null}
                <div className="text-[11px] text-muted-foreground">
                  Publicada em {formatarData(p.publicada_em)} · Atualizada em {formatarData(p.updated_at)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {modelos.length > 0 && (
        <aside className="mt-12 border-t border-border pt-6">
          <h2 className="font-display text-sm uppercase tracking-wider text-muted-foreground inline-flex items-center gap-2">
            <Sparkles className="size-3.5 text-accent" /> Modelos para começar
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Pontos de partida curados. Use como template para abrir uma pergunta no seu caderno.
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {modelos.map((m) => (
              <li key={m.id}>
                <Link
                  to="/caderno/nova"
                  search={{ modelo: m.id }}
                  title={m.contexto ?? undefined}
                  className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border border-border bg-card hover:border-accent hover:text-accent"
                >
                  <Plus className="size-3" /> {m.titulo}
                </Link>
              </li>
            ))}
          </ul>
        </aside>
      )}

      <div className="mt-12 flex flex-col gap-2">
        <Link to="/aprender" className="inline-flex items-center gap-1.5 text-sm font-semibold hover:text-accent">
          Aprender antes de perguntar <ArrowRight className="size-3.5" />
        </Link>
        <Link to="/anomalias" className="inline-flex items-center gap-1.5 text-sm font-semibold hover:text-accent">
          Ir para os sinais investigativos <ArrowRight className="size-3.5" />
        </Link>
        <Link to="/lacunas" className="inline-flex items-center gap-1.5 text-sm font-semibold hover:text-accent">
          Ver o que falta saber <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}