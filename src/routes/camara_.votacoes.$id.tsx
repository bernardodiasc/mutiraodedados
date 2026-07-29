import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { getVotacaoDetalhe } from "@/lib/data/camara/votacoes.functions";
import { AcoesDaEntidade } from "@/components/AcoesDaEntidade";
import { BotaoBaixarCsv } from "@/components/BotaoBaixarCsv";
import { ExternalLink } from "lucide-react";

export const Route = createFileRoute("/camara_/votacoes/$id")({
  component: VotacaoDetalhe,
  head: ({ params }) => ({
    meta: [{ title: `Votação ${params.id} — Mutirão de Dados` }],
  }),
});

function VotacaoDetalhe() {
  const { id } = Route.useParams();
  const fn = useServerFn(getVotacaoDetalhe);
  const { data, isLoading, error } = useQuery({
    queryKey: ["camara", "vot", id],
    queryFn: () => fn({ data: { id } }),
  });

  const [filtroTipo, setFiltroTipo] = useState<string>("");
  const [filtroPart, setFiltroPart] = useState<string>("");

  const votosFiltrados = useMemo(() => {
    if (!data) return [];
    return data.votos.filter((v) => {
      if (filtroTipo && v.tipoVoto !== filtroTipo) return false;
      if (filtroPart && (v.siglaPartido ?? "") !== filtroPart) return false;
      return true;
    }).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [data, filtroTipo, filtroPart]);

  const tipos = useMemo(
    () => [...new Set((data?.votos ?? []).map((v) => v.tipoVoto))].sort(),
    [data],
  );
  const partidos = useMemo(
    () => [...new Set((data?.votos ?? []).map((v) => v.siglaPartido ?? "—"))].sort(),
    [data],
  );

  if (isLoading) return <div className="mx-auto max-w-7xl px-4 py-10">Carregando…</div>;
  if (error) return <div className="mx-auto max-w-7xl px-4 py-10 text-destructive">{(error as Error).message}</div>;
  if (!data) throw notFound();

  const { votacao: v, disciplina, porUf } = data;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 space-y-8">
      <div>
        <div className="text-xs text-muted-foreground uppercase tracking-wider">
          <Link to="/camara" className="hover:text-accent">Câmara</Link> ·{" "}
          <Link to="/camara/votacoes" className="hover:text-accent">Votações</Link>
        </div>
        <h1 className="font-display text-3xl mt-1 leading-tight">{v.descricao ?? "(sem descrição)"}</h1>
        <div className="text-sm text-muted-foreground mt-2">
          {v.data ?? "—"}{v.siglaOrgao ? ` · ${v.siglaOrgao}` : ""}
        </div>
        {v.proposicaoId && (
          <div className="mt-3 text-sm">
            <Link
              to="/camara/proposicoes/$id"
              params={{ id: String(v.proposicaoId) }}
              className="text-accent hover:underline"
            >
              {v.proposicaoTitulo ?? `Proposição ${v.proposicaoId}`}
            </Link>
          </div>
        )}
        <AcoesDaEntidade
          className="mt-4"
          entidadeTipo="votacao"
          entidadeId={String(v.id)}
          titulo={v.descricao ?? `Votação ${v.id}`}
          url={`/camara/votacoes/${v.id}`}
          contexto={`${v.data ?? "—"}${v.siglaOrgao ? ` · ${v.siglaOrgao}` : ""} · Sim ${v.votosSim} / Não ${v.votosNao}`}
          snapshotDe={v}
          fonteOficialHref={
            v.proposicaoId
              ? `https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao=${v.proposicaoId}`
              : undefined
          }
          fonteOficialLabel="Ver na Câmara"
        />
      </div>

      <section className="grid gap-4 sm:grid-cols-4">
        <Card label="Sim" value={String(v.votosSim)} tone="emerald" />
        <Card label="Não" value={String(v.votosNao)} tone="rose" />
        <Card label="Outros" value={String(v.votosOutros)} tone="muted" />
        <Card
          label="Resultado"
          value={v.aprovacao === 1 ? "Aprovado" : v.aprovacao === 0 ? "Rejeitado" : (v.descricaoResultado ?? "—")}
          tone={v.aprovacao === 1 ? "emerald" : v.aprovacao === 0 ? "rose" : "muted"}
        />
      </section>

      <section>
        <h2 className="font-display text-2xl">Disciplina partidária</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
          Para cada partido, mostramos o voto majoritário e que fração da bancada o seguiu.
          Um índice próximo a 100% indica que a bancada votou unida; valores baixos indicam
          divergência interna ou liberação.
        </p>
        <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2">Partido</th>
                <th className="text-right px-4 py-2">Bancada</th>
                <th className="text-left px-4 py-2">Voto majoritário</th>
                <th className="text-right px-4 py-2">Índice de disciplina</th>
                <th className="text-left px-4 py-2 hidden md:table-cell">Detalhamento</th>
              </tr>
            </thead>
            <tbody>
              {disciplina.map((d) => (
                <tr key={d.partido} className="border-t border-border">
                  <td className="px-4 py-2 font-medium">{d.partido}</td>
                  <td className="px-4 py-2 text-right text-muted-foreground">{d.total}</td>
                  <td className="px-4 py-2">{d.majTipo}</td>
                  <td className="px-4 py-2 text-right font-mono">
                    {(d.indice * 100).toFixed(0)}%
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground hidden md:table-cell">
                    {d.detalhe.map(([t, n]) => `${t}: ${n}`).join(" · ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="font-display text-2xl">Votos por UF</h2>
        <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2">UF</th>
                <th className="text-right px-4 py-2">Votos</th>
                <th className="text-left px-4 py-2">Detalhamento</th>
              </tr>
            </thead>
            <tbody>
              {porUf.map((u) => (
                <tr key={u.uf} className="border-t border-border">
                  <td className="px-4 py-2 font-mono">{u.uf}</td>
                  <td className="px-4 py-2 text-right text-muted-foreground">{u.total}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {u.entradas.map(([t, n]) => `${t}: ${n}`).join(" · ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="font-display text-2xl">Votos nominais ({data.votos.length})</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <select
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
          >
            <option value="">Todos os tipos de voto</option>
            {tipos.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={filtroPart}
            onChange={(e) => setFiltroPart(e.target.value)}
          >
            <option value="">Todos os partidos</option>
            {partidos.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className="self-center">
              Mostrando {votosFiltrados.length} de {data.votos.length}
            </span>
            <BotaoBaixarCsv
              filename={`votos_${v.id}`}
              obterLinhas={() =>
                votosFiltrados.map((vt) => ({
                  deputado: vt.nome,
                  partido: vt.siglaPartido ?? "",
                  uf: vt.siglaUf ?? "",
                  voto: vt.tipoVoto,
                }))
              }
              disabled={votosFiltrados.length === 0}
              rotulo="Baixar CSV"
            />
          </div>
        </div>
        <div className="mt-3 overflow-x-auto rounded-xl border border-border bg-card max-h-[600px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground sticky top-0">
              <tr>
                <th className="text-left px-4 py-2">Deputado</th>
                <th className="text-left px-4 py-2 w-24">Partido</th>
                <th className="text-left px-4 py-2 w-16">UF</th>
                <th className="text-left px-4 py-2 w-32">Voto</th>
              </tr>
            </thead>
            <tbody>
              {votosFiltrados.map((vt) => (
                <tr key={vt.deputadoId} className="border-t border-border">
                  <td className="px-4 py-2">
                    <Link
                      to="/camara/deputados/$id"
                      params={{ id: String(vt.deputadoId) }}
                      className="hover:text-accent"
                    >
                      {vt.nome}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{vt.siglaPartido ?? "—"}</td>
                  <td className="px-4 py-2 font-mono text-muted-foreground">{vt.siglaUf ?? "—"}</td>
                  <td className="px-4 py-2 font-medium">{vt.tipoVoto}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="text-xs">
        <a
          href={`https://dadosabertos.camara.leg.br/api/v2/votacoes/${v.id}`}
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

function Card({ label, value, tone }: { label: string; value: string; tone: "emerald" | "rose" | "muted" }) {
  const color =
    tone === "emerald" ? "text-emerald-500" : tone === "rose" ? "text-rose-500" : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className={`font-display text-2xl mt-1 ${color}`}>{value}</div>
    </div>
  );
}