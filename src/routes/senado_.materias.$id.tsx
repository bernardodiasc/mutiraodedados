import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMateriaDetalhe } from "@/lib/data/senado/materias.functions";
import { AcoesDaEntidade } from "@/components/AcoesDaEntidade";
import { ExternalLink } from "lucide-react";

export const Route = createFileRoute("/senado_/materias/$id")({
  component: MateriaDetalhe,
  head: ({ params }) => ({
    meta: [{ title: `Matéria ${params.id} — Senado — Auditoria Cidadã` }],
  }),
});

function MateriaDetalhe() {
  const { id } = Route.useParams();
  const numId = Number(id);
  const fn = useServerFn(getMateriaDetalhe);
  const { data, isLoading, error } = useQuery({
    queryKey: ["senado", "mat", numId],
    queryFn: () => fn({ data: { id: numId } }),
  });

  if (isLoading) return <div className="mx-auto max-w-7xl px-4 py-10">Carregando…</div>;
  if (error) return <div className="mx-auto max-w-7xl px-4 py-10 text-destructive">{(error as Error).message}</div>;
  if (!data) throw notFound();

  const { materia, autores } = data;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 space-y-8">
      <div>
        <div className="text-xs text-muted-foreground uppercase tracking-wider">
          <Link to="/senado" className="hover:text-accent">Senado</Link>
          {" · "}
          <Link to="/senado/materias" className="hover:text-accent">Matérias</Link>
        </div>
        <h1 className="font-display text-4xl mt-2 font-mono">
          {materia.siglaSubtipo} {materia.numero}/{materia.ano}
        </h1>
        <div className="mt-2 text-sm text-muted-foreground">
          Apresentada em {materia.dataApresentacao ?? "—"}
          {materia.ultimaSituacao && <> · {materia.ultimaSituacao}</>}
          {materia.ultimaData && <> ({materia.ultimaData})</>}
        </div>
        {materia.urlTexto && (
          <a
            href={materia.urlTexto}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-accent hover:underline mt-2 inline-flex items-center gap-1"
          >
            <ExternalLink className="size-3" /> Página oficial no Senado
          </a>
        )}
        <AcoesDaEntidade
          className="mt-4"
          entidadeTipo="materia"
          entidadeId={String(numId)}
          titulo={`${materia.siglaSubtipo} ${materia.numero}/${materia.ano}`}
          url={`/senado/materias/${numId}`}
          contexto={materia.ementa ?? materia.ultimaSituacao ?? undefined}
          snapshotDe={materia}
          fonteOficialHref={
            materia.urlTexto ??
            `https://www25.senado.leg.br/web/atividade/materias/-/materia/${numId}`
          }
          fonteOficialLabel="Ver no Senado"
        />
      </div>

      <section>
        <h2 className="font-display text-xl">Ementa</h2>
        <p className="text-sm mt-2 leading-relaxed">{materia.ementa ?? "(sem ementa)"}</p>
      </section>

      <section>
        <h2 className="font-display text-xl">Autoria ({autores.length})</h2>
        <div className="mt-3 rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2">Nome</th>
                <th className="text-left px-4 py-2 w-32">Papel</th>
              </tr>
            </thead>
            <tbody>
              {autores.map((a, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="px-4 py-2">{a.nome}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {a.proponente ? <span className="text-accent">{a.tipo ?? "Principal"}</span> : (a.tipo ?? "Coautor")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}