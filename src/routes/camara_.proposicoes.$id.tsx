import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getProposicaoDetalhe } from "@/lib/data/camara/proposicoes.functions";
import { AcoesDaEntidade } from "@/components/AcoesDaEntidade";
import { ExternalLink } from "lucide-react";

export const Route = createFileRoute("/camara_/proposicoes/$id")({
  component: ProposicaoDetalhe,
  head: ({ params }) => ({
    meta: [{ title: `Proposição ${params.id} — Auditoria Cidadã` }],
  }),
});

function ProposicaoDetalhe() {
  const { id } = Route.useParams();
  const numId = Number(id);
  const fn = useServerFn(getProposicaoDetalhe);
  const { data, isLoading, error } = useQuery({
    queryKey: ["camara", "prop", numId],
    queryFn: () => fn({ data: { id: numId } }),
  });

  if (isLoading) return <div className="mx-auto max-w-4xl px-4 py-10">Carregando…</div>;
  if (error) return <div className="mx-auto max-w-4xl px-4 py-10 text-destructive">{(error as Error).message}</div>;
  if (!data) throw notFound();

  const { proposicao: p, autores } = data;
  const principais = autores.filter((a) => a.proponente || (a.ordemAssinatura ?? 99) <= 1);
  const demais = autores.filter((a) => !principais.includes(a));

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 space-y-8">
      <div>
        <div className="text-xs text-muted-foreground uppercase tracking-wider">
          <Link to="/camara" className="hover:text-accent">Câmara</Link> ·{" "}
          <Link to="/camara/proposicoes" className="hover:text-accent">Proposições</Link>
        </div>
        <h1 className="font-display text-4xl mt-1">
          {p.siglaTipo} {p.numero}/{p.ano}
        </h1>
        {p.descricaoTipo && (
          <div className="text-sm text-muted-foreground mt-1">{p.descricaoTipo}</div>
        )}
        {p.dataApresentacao && (
          <div className="text-xs text-muted-foreground mt-2">
            Apresentada em {p.dataApresentacao}
          </div>
        )}
        <AcoesDaEntidade
          className="mt-4"
          entidadeTipo="proposicao"
          entidadeId={String(p.id)}
          titulo={`${p.siglaTipo} ${p.numero}/${p.ano}`}
          url={`/camara/proposicoes/${p.id}`}
          contexto={p.ementa ?? p.descricaoTipo ?? undefined}
          snapshotDe={p}
          fonteOficialHref={`https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao=${p.id}`}
          fonteOficialLabel="Ficha na Câmara"
        />
      </div>

      <section>
        <h2 className="font-display text-lg">Ementa</h2>
        <p className="mt-2 leading-relaxed">{p.ementa ?? "(sem ementa)"}</p>
        {p.ementaDetalhada && p.ementaDetalhada !== p.ementa && (
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{p.ementaDetalhada}</p>
        )}
        {p.keywords && (
          <p className="mt-3 text-xs text-muted-foreground">
            <strong>Palavras-chave:</strong> {p.keywords}
          </p>
        )}
      </section>

      <section>
        <h2 className="font-display text-lg">Autoria</h2>
        {principais.length > 0 && (
          <ul className="mt-2 space-y-1 text-sm">
            {principais.map((a) => (
              <li key={a.nome}>
                {a.deputadoId ? (
                  <Link
                    to="/camara/deputados/$id"
                    params={{ id: String(a.deputadoId) }}
                    className="text-accent hover:underline"
                  >
                    {a.nome}
                  </Link>
                ) : (
                  <span>{a.nome}</span>
                )}
                {a.tipo && <span className="text-muted-foreground"> · {a.tipo}</span>}
                {a.proponente && (
                  <span className="ml-2 text-[10px] uppercase tracking-wider text-accent">
                    proponente
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        {demais.length > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
              Outros {demais.length} coautores
            </summary>
            <ul className="mt-2 grid sm:grid-cols-2 gap-x-4 gap-y-1 text-sm">
              {demais.map((a) => (
                <li key={a.nome}>
                  {a.deputadoId ? (
                    <Link
                      to="/camara/deputados/$id"
                      params={{ id: String(a.deputadoId) }}
                      className="hover:text-accent"
                    >
                      {a.nome}
                    </Link>
                  ) : (
                    a.nome
                  )}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <section>
        <h2 className="font-display text-lg">Tramitação atual</h2>
        <div className="mt-2 rounded-xl border border-border bg-card p-4 text-sm space-y-1">
          {p.ultimoStatusData && (
            <div className="text-xs text-muted-foreground">Atualizado em {p.ultimoStatusData}</div>
          )}
          {p.ultimoStatusSituacao && (
            <div><strong>Situação:</strong> {p.ultimoStatusSituacao}</div>
          )}
          {p.ultimoStatusOrgaoSigla && (
            <div><strong>Órgão:</strong> {p.ultimoStatusOrgaoSigla}</div>
          )}
          {p.ultimoStatusDescricao && (
            <div className="text-muted-foreground">{p.ultimoStatusDescricao}</div>
          )}
          {p.ultimoStatusDespacho && (
            <p className="text-muted-foreground leading-relaxed mt-2">{p.ultimoStatusDespacho}</p>
          )}
        </div>
      </section>

      <section className="flex flex-wrap gap-3 text-xs">
        {p.urlInteiroTeor && (
          <a
            href={p.urlInteiroTeor}
            target="_blank"
            rel="noreferrer"
            className="text-accent hover:underline inline-flex items-center gap-1"
          >
            <ExternalLink className="size-3" /> Texto integral (PDF)
          </a>
        )}
        <a
          href={`https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao=${p.id}`}
          target="_blank"
          rel="noreferrer"
          className="text-accent hover:underline inline-flex items-center gap-1"
        >
          <ExternalLink className="size-3" /> Ficha de tramitação na Câmara
        </a>
        <a
          href={`https://dadosabertos.camara.leg.br/api/v2/proposicoes/${p.id}`}
          target="_blank"
          rel="noreferrer"
          className="text-muted-foreground hover:text-accent inline-flex items-center gap-1"
        >
          <ExternalLink className="size-3" /> Dados primários (JSON)
        </a>
      </section>
    </div>
  );
}