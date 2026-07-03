import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { BotaoSalvarBusca } from "@/components/BotaoSalvarBusca";
import { BotaoBaixarCsv } from "@/components/BotaoBaixarCsv";
import {
  listarSenadoresPorLegislatura,
  rankingGastosSenadores,
  type SenadorMembro,
} from "@/lib/data/senado/queries.functions";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { EmptyState } from "@/components/EmptyState";
import { Input } from "@/components/ui/input";
import { fmtBRL } from "@/lib/fmt";
import { ChevronDown } from "lucide-react";

// Filtros na URL: permite compartilhar e "salvar esta busca" no caderno.
type SenadoresSearch = { q?: string; uf?: string; partido?: string };

export const Route = createFileRoute("/senado_/senadores/")({
  validateSearch: (s: Record<string, unknown>): SenadoresSearch => ({
    q: typeof s.q === "string" && s.q ? s.q : undefined,
    uf: typeof s.uf === "string" && s.uf ? s.uf : undefined,
    partido: typeof s.partido === "string" && s.partido ? s.partido : undefined,
  }),
  component: ListaSenadores,
  head: () => ({
    meta: [
      { title: "Senadores — Auditoria Cidadã" },
      {
        name: "description",
        content:
          "Lista navegável dos senadores na legislatura atual e nas legislaturas passadas, com filtros por UF e partido e ranking de gastos da Cota (CEAPS).",
      },
    ],
  }),
});

function anosDaLegislatura(n: number): string {
  const ini = 2003 + (n - 52) * 4;
  return `${ini}–${ini + 4}`;
}

function iniciais(nome: string): string {
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function Foto({ src, nome }: { src: string; nome: string }) {
  const [erro, setErro] = useState(false);
  if (erro) {
    return (
      <div className="size-14 rounded-md bg-muted border border-border flex items-center justify-center text-xs text-muted-foreground shrink-0">
        {iniciais(nome)}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      onError={() => setErro(true)}
      className="size-14 rounded-md object-cover border border-border shrink-0"
    />
  );
}

function CardSenador({ d, gasto }: { d: SenadorMembro; gasto?: number }) {
  return (
    <Link
      to="/senado/senadores/$id"
      params={{ id: String(d.id) }}
      className="border border-border rounded-xl p-4 bg-card hover:border-accent transition-colors flex gap-3 items-start"
    >
      <Foto src={d.urlFoto} nome={d.nome} />
      <div className="flex-1 min-w-0">
        <div className="font-display text-base leading-tight truncate">{d.nome}</div>
        <div className="text-xs text-muted-foreground mt-1">
          {d.siglaPartido ?? "—"} · {d.siglaUf ?? "—"}
        </div>
        {gasto !== undefined && (
          <div className="text-xs font-mono mt-2 text-foreground">
            {fmtBRL(gasto)} <span className="text-muted-foreground">em CEAPS</span>
          </div>
        )}
      </div>
    </Link>
  );
}

function ListaSenadores() {
  const listFn = useServerFn(listarSenadoresPorLegislatura);
  const rankFn = useServerFn(rankingGastosSenadores);
  const { data, isLoading } = useQuery({ queryKey: ["senado", "senadores-leg"], queryFn: () => listFn() });
  const { data: rank } = useQuery({ queryKey: ["senado", "ranking"], queryFn: () => rankFn() });

  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const q = search.q ?? "";
  const uf = search.uf ?? "";
  const partido = search.partido ?? "";
  const setFiltro = (patch: Partial<SenadoresSearch>) =>
    navigate({ search: (prev: SenadoresSearch) => ({ ...prev, ...patch }), replace: true });

  const todos = useMemo(
    () => [...(data?.atuais ?? []), ...(data?.passadas ?? []).flatMap((g) => g.membros)],
    [data],
  );
  const ufs = useMemo(
    () => [...new Set(todos.map((d) => d.siglaUf).filter(Boolean))].sort() as string[],
    [todos],
  );
  const partidos = useMemo(
    () => [...new Set(todos.map((d) => d.siglaPartido).filter(Boolean))].sort() as string[],
    [todos],
  );

  const gastoPorId = useMemo(() => {
    const m = new Map<number, number>();
    for (const r of rank ?? []) m.set(r.id, r.total);
    return m;
  }, [rank]);

  const filtrar = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (membros: SenadorMembro[]) =>
      membros.filter((d) => {
        if (term && !d.nome.toLowerCase().includes(term)) return false;
        if (uf && d.siglaUf !== uf) return false;
        if (partido && d.siglaPartido !== partido) return false;
        return true;
      });
  }, [q, uf, partido]);

  const atuaisFiltrados = filtrar(data?.atuais ?? []);
  const passadasFiltradas = (data?.passadas ?? [])
    .map((g) => ({ ...g, membros: filtrar(g.membros) }))
    .filter((g) => g.membros.length > 0);

  const semDados = !isLoading && (data?.atuais.length ?? 0) === 0 && (data?.passadas.length ?? 0) === 0;

  const totalFiltrado =
    atuaisFiltrados.length + passadasFiltradas.reduce((n, g) => n + g.membros.length, 0);
  const linhasCsv = () => {
    const linha = (d: SenadorMembro, legislatura: number) => ({
      nome: d.nome,
      partido: d.siglaPartido ?? "",
      uf: d.siglaUf ?? "",
      legislatura,
      gasto_ceaps: gastoPorId.get(d.id) ?? "",
    });
    return [
      ...atuaisFiltrados.map((d) => linha(d, data?.legAtual ?? 0)),
      ...passadasFiltradas.flatMap((g) => g.membros.map((d) => linha(d, g.legislatura))),
    ];
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div>
        <div className="text-xs text-muted-foreground uppercase tracking-wider">
          <Link to="/senado" className="hover:text-accent">Senado</Link> · Senadores
        </div>
        <h1 className="font-display text-4xl mt-1">Senadores</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl">
          O mandato de um senador dura <strong className="text-foreground">8 anos</strong> — o equivalente a{" "}
          <strong className="text-foreground">duas legislaturas</strong> (cada legislatura tem 4 anos). Por isso a
          eleição é <strong className="text-foreground">escalonada</strong> a cada 4 anos: num pleito cada estado
          elege 1 senador (renovação de 1/3); no seguinte, 2 (renovação de 2/3). É por isso que um mesmo senador
          pode aparecer em duas legislaturas aqui.{" "}
        </p>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <Input
            placeholder="Buscar por nome…"
            value={q}
            onChange={(e) => setFiltro({ q: e.target.value || undefined })}
          />
        </div>
        <select
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={uf}
          onChange={(e) => setFiltro({ uf: e.target.value || undefined })}
        >
          <option value="">Todas UFs</option>
          {ufs.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
        <select
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={partido}
          onChange={(e) => setFiltro({ partido: e.target.value || undefined })}
        >
          <option value="">Todos partidos</option>
          {partidos.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <BotaoBaixarCsv
          filename="senadores"
          obterLinhas={linhasCsv}
          disabled={totalFiltrado === 0}
          rotulo={`Baixar CSV (${totalFiltrado})`}
        />
        <BotaoSalvarBusca
          path="/senado/senadores"
          search={search}
          titulo="Senadores"
          filtros={[
            ["busca", q],
            ["UF", uf],
            ["partido", partido],
          ]}
        />
      </div>

      {isLoading ? (
        <div className="mt-10 text-sm text-muted-foreground">Carregando…</div>
      ) : semDados ? (
        <div className="mt-10">
          <EmptyState
            title="Nenhum senador em cache"
            hint="Um administrador precisa importar o cadastro de senadores pelo painel admin."
          />
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          <section>
            <h2 className="font-display text-xl">
              Legislatura atual{" "}
              <span className="text-muted-foreground text-base font-normal">
                · {data?.legAtual}ª ({data ? anosDaLegislatura(data.legAtual) : ""}) · {atuaisFiltrados.length}
              </span>
            </h2>
            {atuaisFiltrados.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Nenhum senador atual com esses filtros.</p>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {atuaisFiltrados.map((d) => (
                  <CardSenador key={d.id} d={d} gasto={gastoPorId.get(d.id)} />
                ))}
              </div>
            )}
          </section>

          {passadasFiltradas.length > 0 && (
            <section>
              <h2 className="font-display text-xl">Legislaturas passadas</h2>
              <div className="mt-4 space-y-3">
                {passadasFiltradas.map((g) => (
                  <Collapsible key={g.legislatura} className="rounded-xl border border-border bg-card">
                    <CollapsibleTrigger className="group w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-muted/40">
                      <ChevronDown className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                      <span className="font-medium text-sm">
                        {g.legislatura}ª legislatura
                        <span className="text-muted-foreground font-normal"> · {anosDaLegislatura(g.legislatura)}</span>
                      </span>
                      <span className="ml-auto text-xs text-muted-foreground">{g.membros.length} senadores</span>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="px-4 pb-4 pt-1">
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {g.membros.map((d) => (
                          <CardSenador key={`${g.legislatura}-${d.id}`} d={d} gasto={gastoPorId.get(d.id)} />
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
