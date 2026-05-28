import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { getVotacaoSenadoDetalhe } from "@/lib/data/senado/votacoes.functions";

export const Route = createFileRoute("/senado_/votacoes/$id")({
  component: VotacaoSenadoDetalhe,
  head: ({ params }) => ({
    meta: [{ title: `Votação ${params.id} — Senado — Auditoria Cidadã` }],
  }),
});

function VotacaoSenadoDetalhe() {
  const { id } = Route.useParams();
  const fn = useServerFn(getVotacaoSenadoDetalhe);
  const { data, isLoading, error } = useQuery({
    queryKey: ["senado", "vot", id],
    queryFn: () => fn({ data: { id } }),
  });

  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroPart, setFiltroPart] = useState("");

  const tipos = useMemo(
    () => [...new Set((data?.votos ?? []).map((v) => v.tipoVoto))].sort(),
    [data],
  );
  const partidos = useMemo(
    () => [...new Set((data?.votos ?? []).map((v) => v.siglaPartido).filter(Boolean))].sort() as string[],
    [data],
  );

  const votosFiltrados = useMemo(() => {
    return (data?.votos ?? []).filter((v) => {
      if (filtroTipo && v.tipoVoto !== filtroTipo) return false;
      if (filtroPart && v.siglaPartido !== filtroPart) return false;
      return true;
    });
  }, [data, filtroTipo, filtroPart]);

  if (isLoading) return <div className="mx-auto max-w-7xl px-4 py-10">Carregando…</div>;
  if (error) return <div className="mx-auto max-w-7xl px-4 py-10 text-destructive">{(error as Error).message}</div>;
  if (!data) throw notFound();

  const { votacao, disciplina, porUf } = data;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 space-y-8">
      <div>
        <div className="text-xs text-muted-foreground uppercase tracking-wider">
          <Link to="/senado" className="hover:text-accent">Senado</Link>
          {" · "}
          <Link to="/senado/votacoes" className="hover:text-accent">Votações</Link>
        </div>
        <h1 className="font-display text-3xl mt-2 leading-tight">{votacao.descricao ?? "(sem descrição)"}</h1>
        <div className="mt-2 text-sm text-muted-foreground">
          {votacao.data ?? "—"}
          {votacao.materiaTitulo && <> · {votacao.materiaTitulo}</>}
          {votacao.resultado && <> · {votacao.resultado}</>}
        </div>
        <div className="mt-3 font-mono text-sm">
          <span className="text-emerald-500">Sim {votacao.votosSim}</span>{" · "}
          <span className="text-rose-500">Não {votacao.votosNao}</span>{" · "}
          <span className="text-muted-foreground">Outros {votacao.votosOutros}</span>
        </div>
      </div>

      <section>
        <h2 className="font-display text-xl">Disciplina partidária</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Índice = % de senadores do partido que seguiram o voto majoritário.
        </p>
        <div className="mt-3 rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2">Partido</th>
                <th className="text-left px-4 py-2 w-28">Maioria</th>
                <th className="text-right px-4 py-2 w-20">Total</th>
                <th className="text-right px-4 py-2 w-28">Disciplina</th>
              </tr>
            </thead>
            <tbody>
              {disciplina.map((d) => (
                <tr key={d.partido} className="border-t border-border">
                  <td className="px-4 py-2 font-medium">{d.partido}</td>
                  <td className="px-4 py-2">{d.majTipo}</td>
                  <td className="px-4 py-2 text-right text-muted-foreground">{d.total}</td>
                  <td className="px-4 py-2 text-right font-mono">
                    {(d.indice * 100).toFixed(0)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="font-display text-xl">Por UF</h2>
        <div className="mt-3 grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          {porUf.map((u) => (
            <div key={u.uf} className="rounded-md border border-border bg-card p-3 text-xs">
              <div className="font-display text-base">{u.uf}</div>
              <div className="mt-1 text-muted-foreground">
                {u.entradas.map(([t, n]) => (
                  <div key={t}>{t}: <span className="font-mono text-foreground">{n}</span></div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-display text-xl">Votos individuais</h2>
        <div className="mt-3 flex gap-3 flex-wrap">
          <select
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
          >
            <option value="">Todos os votos</option>
            {tipos.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={filtroPart}
            onChange={(e) => setFiltroPart(e.target.value)}
          >
            <option value="">Todos partidos</option>
            {partidos.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="mt-3 rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2">Senador</th>
                <th className="text-left px-4 py-2 w-20">Partido</th>
                <th className="text-left px-4 py-2 w-16">UF</th>
                <th className="text-left px-4 py-2 w-32">Voto</th>
              </tr>
            </thead>
            <tbody>
              {votosFiltrados.map((v) => (
                <tr key={v.senadorId} className="border-t border-border">
                  <td className="px-4 py-2">
                    <Link
                      to="/senado/senadores/$id"
                      params={{ id: String(v.senadorId) }}
                      className="hover:text-accent"
                    >
                      {v.nome}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-xs">{v.siglaPartido ?? "—"}</td>
                  <td className="px-4 py-2 text-xs">{v.siglaUf ?? "—"}</td>
                  <td className="px-4 py-2">{v.tipoVoto}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}