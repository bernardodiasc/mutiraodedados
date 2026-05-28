import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { listarSenadores, rankingGastosSenadores } from "@/lib/data/senado/queries.functions";
import { EmptyState } from "@/components/EmptyState";
import { Input } from "@/components/ui/input";
import { fmtBRL } from "@/lib/fmt";

export const Route = createFileRoute("/senado_/senadores/")({
  component: ListaSenadores,
  head: () => ({
    meta: [
      { title: "Senadores — Auditoria Cidadã" },
      {
        name: "description",
        content:
          "Lista navegável dos 81 senadores, com filtros por UF e partido e ranking de gastos da Cota (CEAPS).",
      },
    ],
  }),
});

function ListaSenadores() {
  const listFn = useServerFn(listarSenadores);
  const rankFn = useServerFn(rankingGastosSenadores);
  const { data: sens, isLoading } = useQuery({ queryKey: ["senado", "senadores"], queryFn: () => listFn() });
  const { data: rank } = useQuery({ queryKey: ["senado", "ranking"], queryFn: () => rankFn() });

  const [q, setQ] = useState("");
  const [uf, setUf] = useState("");
  const [partido, setPartido] = useState("");

  const ufs = useMemo(
    () => [...new Set((sens ?? []).map((d) => d.siglaUf).filter(Boolean))].sort() as string[],
    [sens],
  );
  const partidos = useMemo(
    () => [...new Set((sens ?? []).map((d) => d.siglaPartido).filter(Boolean))].sort() as string[],
    [sens],
  );

  const gastoPorId = useMemo(() => {
    const m = new Map<number, number>();
    for (const r of rank ?? []) m.set(r.id, r.total);
    return m;
  }, [rank]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (sens ?? []).filter((d) => {
      if (term && !d.nome.toLowerCase().includes(term)) return false;
      if (uf && d.siglaUf !== uf) return false;
      if (partido && d.siglaPartido !== partido) return false;
      return true;
    });
  }, [sens, q, uf, partido]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs text-muted-foreground uppercase tracking-wider">
            <Link to="/senado" className="hover:text-accent">Senado</Link> · Senadores
          </div>
          <h1 className="font-display text-4xl mt-1">Senadores</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            {sens?.length ?? 0} senadores em cache. Cada estado tem três representantes
            com mandato de oito anos.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <Input placeholder="Buscar por nome…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={uf}
          onChange={(e) => setUf(e.target.value)}
        >
          <option value="">Todas UFs</option>
          {ufs.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
        <select
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={partido}
          onChange={(e) => setPartido(e.target.value)}
        >
          <option value="">Todos partidos</option>
          {partidos.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="mt-10 text-sm text-muted-foreground">Carregando…</div>
      ) : filtered.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            title="Nenhum senador em cache"
            hint="Um administrador precisa importar o cadastro de senadores pelo painel admin."
          />
        </div>
      ) : (
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((d) => {
            const total = gastoPorId.get(d.id);
            return (
              <Link
                key={d.id}
                to="/senado/senadores/$id"
                params={{ id: String(d.id) }}
                className="border border-border rounded-xl p-4 bg-card hover:border-accent transition-colors flex gap-3 items-start"
              >
                {d.urlFoto ? (
                  <img
                    src={d.urlFoto}
                    alt=""
                    loading="lazy"
                    className="size-14 rounded-md object-cover border border-border"
                  />
                ) : (
                  <div className="size-14 rounded-md bg-muted" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-display text-base leading-tight truncate">{d.nome}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {d.siglaPartido ?? "—"} · {d.siglaUf ?? "—"}
                  </div>
                  {total !== undefined && (
                    <div className="text-xs font-mono mt-2 text-foreground">
                      {fmtBRL(total)} <span className="text-muted-foreground">em CEAPS</span>
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}