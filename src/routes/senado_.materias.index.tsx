import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { listarMaterias, senadoMateriasOverview } from "@/lib/data/senado/materias.functions";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/EmptyState";
import { BotaoBaixarCsv } from "@/components/BotaoBaixarCsv";

export const Route = createFileRoute("/senado_/materias/")({
  component: ListaMaterias,
  head: () => ({
    meta: [
      { title: "Matérias legislativas — Senado — Mutirão de Dados" },
      {
        name: "description",
        content:
          "Projetos de lei, PECs, medidas provisórias e demais matérias apresentadas no Senado Federal.",
      },
    ],
  }),
});

const TIPOS_COMUNS = ["PL", "PEC", "PLP", "MPV", "PDL", "PRS", "PLS"];

function ListaMaterias() {
  const listFn = useServerFn(listarMaterias);
  const ovFn = useServerFn(senadoMateriasOverview);

  const [tipo, setTipo] = useState("");
  const [ano, setAno] = useState<string>("");
  const [termo, setTermo] = useState("");

  const filtros = useMemo(
    () => ({
      sigla: tipo || undefined,
      ano: ano ? Number(ano) : undefined,
      termo: termo.trim() || undefined,
    }),
    [tipo, ano, termo],
  );

  const { data: rows, isLoading } = useQuery({
    queryKey: ["senado", "mats", filtros],
    queryFn: () => listFn({ data: filtros }),
  });
  const { data: overview } = useQuery({
    queryKey: ["senado", "mats-ov"],
    queryFn: () => ovFn(),
  });

  const anosDisponiveis = useMemo(() => {
    const cur = new Date().getFullYear();
    return Array.from({ length: 8 }, (_, i) => cur - i);
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 space-y-6">
      <header>
        <div className="text-xs text-muted-foreground uppercase tracking-wider">
          <Link to="/senado" className="hover:text-accent">
            Senado
          </Link>{" "}
          · Matérias
        </div>
        <h1 className="font-display text-4xl mt-1">Matérias legislativas</h1>
        <p className="text-muted-foreground mt-2 max-w-3xl">
          PL (projeto de lei), PEC (emenda constitucional), MPV (medida provisória), PLP (lei
          complementar), PDL e demais matérias em tramitação no Senado.
        </p>
        {overview && (
          <p className="text-xs text-muted-foreground mt-3">
            {overview.total.toLocaleString("pt-BR")} matérias em cache
            {overview.porTipo.length > 0 && (
              <>
                {" "}
                · por tipo:{" "}
                {overview.porTipo.slice(0, 8).map((t, i) => (
                  <span key={t.tipo}>
                    {i > 0 && " · "}
                    <button
                      className="underline-offset-2 hover:underline hover:text-accent"
                      onClick={() => setTipo(t.tipo)}
                    >
                      {t.tipo} ({t.n})
                    </button>
                  </span>
                ))}
              </>
            )}
          </p>
        )}
      </header>

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <Input
            placeholder="Buscar na ementa…"
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
          />
        </div>
        <select
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
        >
          <option value="">Todos tipos</option>
          {TIPOS_COMUNS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={ano}
          onChange={(e) => setAno(e.target.value)}
        >
          <option value="">Todos anos</option>
          {anosDisponiveis.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      {rows && rows.length > 0 && (
        <div className="flex justify-end">
          <BotaoBaixarCsv
            filename="materias"
            obterLinhas={() =>
              rows.map((p) => ({
                materia: `${p.siglaSubtipo} ${p.numero}/${p.ano}`,
                apresentada: p.dataApresentacao ?? "",
                autor: p.autorPrincipal ?? "",
                ementa: p.ementa ?? "",
                situacao: p.ultimaSituacao ?? "",
              }))
            }
            rotulo={`Baixar CSV (${rows.length})`}
          />
        </div>
      )}

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : !rows || rows.length === 0 ? (
        <EmptyState
          title="Nenhuma matéria encontrada"
          hint="Tente outro filtro ou peça a um administrador para importar matérias."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2 w-32">Matéria</th>
                <th className="text-left px-4 py-2 w-28">Apresentada</th>
                <th className="text-left px-4 py-2">Ementa</th>
                <th className="text-left px-4 py-2 w-48 hidden md:table-cell">Situação</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="border-t border-border hover:bg-muted/20">
                  <td className="px-4 py-3 align-top whitespace-nowrap">
                    <Link
                      to="/senado/materias/$id"
                      params={{ id: String(p.id) }}
                      className="font-mono text-accent hover:underline"
                    >
                      {p.siglaSubtipo} {p.numero}/{p.ano}
                    </Link>
                  </td>
                  <td className="px-4 py-3 align-top text-muted-foreground text-xs whitespace-nowrap">
                    {p.dataApresentacao ?? "—"}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <p className="line-clamp-3 leading-snug">{p.ementa ?? "(sem ementa)"}</p>
                    {p.autorPrincipal && (
                      <p className="text-xs text-muted-foreground mt-1">por {p.autorPrincipal}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top text-xs text-muted-foreground hidden md:table-cell">
                    {p.ultimaSituacao ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
