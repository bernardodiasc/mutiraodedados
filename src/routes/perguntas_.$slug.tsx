import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Globe, ExternalLink } from "lucide-react";
import { obterPerguntaPublica } from "@/lib/perguntas.functions";
import { listarItensPublicos } from "@/lib/pergunta-itens.functions";

export const Route = createFileRoute("/perguntas_/$slug")({
  component: PerguntaPublicaPage,
  loader: async ({ params, context }) => {
    const p = await context.queryClient.ensureQueryData({
      queryKey: ["perguntas", "publica", params.slug],
      queryFn: () => obterPerguntaPublica({ data: { slug: params.slug } }),
    });
    if (!p) throw notFound();
    await context.queryClient.ensureQueryData({
      queryKey: ["pergunta-itens", "publica", p.id],
      queryFn: () => listarItensPublicos({ data: { pergunta_id: p.id } }),
    });
    return { pergunta: p };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.pergunta?.titulo ?? "Pergunta"} — Mutirão de Dados` },
      {
        name: "description",
        content:
          loaderData?.pergunta?.descricao ??
          loaderData?.pergunta?.contexto?.slice(0, 160) ??
          "Investigação cidadã pública.",
      },
      { property: "og:title", content: loaderData?.pergunta?.titulo ?? "" },
      { property: "og:description", content: loaderData?.pergunta?.descricao ?? "" },
    ],
  }),
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-2xl px-4 py-16">{error.message}</div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      <h1 className="font-display text-2xl">Investigação não encontrada</h1>
      <Link to="/perguntas" className="text-sm text-accent">
        ← Ver investigações públicas
      </Link>
    </div>
  ),
});

function fmt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("pt-BR");
}

function PerguntaPublicaPage() {
  const { slug } = Route.useParams();
  const obter = useServerFn(obterPerguntaPublica);
  const listar = useServerFn(listarItensPublicos);
  const { data: pergunta } = useSuspenseQuery({
    queryKey: ["perguntas", "publica", slug],
    queryFn: () => obter({ data: { slug } }),
  });
  const { data: itens } = useSuspenseQuery({
    queryKey: ["pergunta-itens", "publica", pergunta?.id ?? "_"],
    queryFn: () => listar({ data: { pergunta_id: pergunta!.id } }),
    // when pergunta is null the loader threw notFound; safe.
  });

  if (!pergunta) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <Link
        to="/perguntas"
        className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
      >
        <ArrowLeft className="size-3.5" /> Voltar
      </Link>
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <span className="text-[11px] font-semibold inline-flex items-center gap-1 text-accent">
          <Globe className="size-3" /> Investigação pública
        </span>
        {pergunta.status === "encerrada" && (
          <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-muted text-muted-foreground">
            Encerrada
          </span>
        )}
      </div>
      <h1 className="font-display text-3xl sm:text-4xl mt-2 leading-tight">{pergunta.titulo}</h1>
      {pergunta.descricao && (
        <p className="mt-3 text-lg text-muted-foreground leading-relaxed">{pergunta.descricao}</p>
      )}
      {pergunta.contexto && (
        <p className="mt-4 leading-relaxed whitespace-pre-wrap">{pergunta.contexto}</p>
      )}
      <div className="mt-3 text-[11px] text-muted-foreground">
        Publicada em {fmt(pergunta.publicada_em)} · Atualizada em {fmt(pergunta.updated_at)}
        {pergunta.encerrada_em ? ` · Encerrada em ${fmt(pergunta.encerrada_em)}` : ""}
      </div>

      <section className="mt-10">
        <h2 className="font-display text-xl">Itens reunidos</h2>
        {itens.length === 0 ? (
          <p className="text-sm text-muted-foreground mt-2">Sem itens reunidos publicamente.</p>
        ) : (
          <ul className="mt-4 grid gap-2">
            {itens.map((it) => (
              <li key={it.id} className="border border-border rounded-xl p-4 bg-card">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold px-2 py-0.5 rounded bg-muted">
                    {it.tipo}
                  </span>
                  {it.url ? (
                    <a
                      href={it.url}
                      className="text-sm font-semibold hover:text-accent inline-flex items-center gap-1"
                    >
                      {it.titulo} <ExternalLink className="size-3" />
                    </a>
                  ) : (
                    <span className="text-sm font-semibold">{it.titulo}</span>
                  )}
                </div>
                {it.nota && <p className="text-xs text-muted-foreground mt-1">{it.nota}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
