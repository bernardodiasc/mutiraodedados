import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef } from "react";
import { listarConveniosCgu } from "@/lib/data/real/queries.functions";
import { AvisoMetodologico } from "@/components/AvisoMetodologico";
import { BotaoBaixarCsv } from "@/components/BotaoBaixarCsv";
import { BotaoSalvarBusca } from "@/components/BotaoSalvarBusca";
import { FontesDoTema } from "@/components/FontesDoTema";
import { fmtBRL } from "@/lib/fmt";
import { ExternalLink, FileSignature, Loader2 } from "lucide-react";

const UFS = [
  "",
  "AC",
  "AL",
  "AM",
  "AP",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MG",
  "MS",
  "MT",
  "PA",
  "PB",
  "PE",
  "PI",
  "PR",
  "RJ",
  "RN",
  "RO",
  "RR",
  "RS",
  "SC",
  "SE",
  "SP",
  "TO",
];
const ANOS = [0, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017];
const VALORES_MIN = [
  { v: 0, label: "Qualquer valor" },
  { v: 100_000, label: "≥ R$ 100 mil" },
  { v: 1_000_000, label: "≥ R$ 1 mi" },
  { v: 10_000_000, label: "≥ R$ 10 mi" },
];
const ORDENS = [
  { v: "data_desc", label: "Mais recentes" },
  { v: "valor_desc", label: "Maior valor global" },
] as const;
const PAGE = 40;
type Ordem = (typeof ORDENS)[number]["v"];

// Filtros na URL: permite compartilhar e "salvar esta busca" no caderno.
type ConveniosSearch = {
  uf?: string;
  ano?: number;
  situacao?: string;
  valorMin?: number;
  sort?: Ordem;
  q?: string;
};

export const Route = createFileRoute("/convenios")({
  validateSearch: (s: Record<string, unknown>): ConveniosSearch => ({
    uf: typeof s.uf === "string" && s.uf ? s.uf : undefined,
    ano: Number(s.ano) || undefined,
    situacao: typeof s.situacao === "string" && s.situacao ? s.situacao : undefined,
    valorMin: Number(s.valorMin) || undefined,
    sort: ORDENS.some((o) => o.v === s.sort) ? (s.sort as Ordem) : undefined,
    q: typeof s.q === "string" && s.q ? s.q : undefined,
  }),
  component: ConveniosPage,
  head: () => ({
    meta: [
      { title: "Convênios e contratos de repasse — Mutirão de Dados" },
      {
        name: "description",
        content:
          "Convênios e contratos de repasse da União, pelo endpoint /convenios do Portal da Transparência (CGU).",
      },
    ],
  }),
});

function ConveniosPage() {
  const buscar = useServerFn(listarConveniosCgu);
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const uf = search.uf ?? "";
  const ano = search.ano ?? 0;
  const situacao = search.situacao ?? "";
  const valorMin = search.valorMin ?? 0;
  const sort: Ordem = search.sort ?? "data_desc";
  const q = search.q ?? "";
  const setFiltro = (patch: Partial<ConveniosSearch>) =>
    navigate({ search: (prev: ConveniosSearch) => ({ ...prev, ...patch }), replace: true });

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ["convenios-cgu", uf, ano, situacao, valorMin, sort, q],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      buscar({
        data: {
          uf: uf || undefined,
          ano: ano || undefined,
          situacao: situacao || undefined,
          valorMin: valorMin || undefined,
          sort,
          q: q || undefined,
          limit: PAGE,
          offset: pageParam as number,
        },
      }),
    getNextPageParam: (last, pages) =>
      (last.convenios?.length ?? 0) < PAGE ? undefined : pages.length * PAGE,
  });

  const lista = (data?.pages ?? []).flatMap((p) => p.convenios);

  const sentinel = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage();
      },
      { rootMargin: "400px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 space-y-8">
      <header>
        <div className="text-xs text-muted-foreground uppercase tracking-wider">
          União → Estados/Municípios
        </div>
        <h1 className="font-display text-4xl mt-1">Convênios e Contratos de Repasse</h1>
        <p className="text-muted-foreground mt-3 max-w-3xl leading-relaxed">
          Instrumentos de cooperação — exigem plano de trabalho, contrapartida e prestação de
          contas, com aplicação vinculada ao objeto pactuado. Fonte: Portal da Transparência (CGU),
          endpoint <code>/convenios</code>. A fonte nativa (Transferegov) fica em{" "}
          <Link to="/transferegov" className="text-accent underline">
            Transferegov
          </Link>
          .
        </p>
      </header>

      <FontesDoTema
        fontes={[
          {
            label: "Transferegov",
            to: "/transferegov",
            nota: "Sistema-fonte dos convênios (SICONV), que o Portal CGU espelha",
          },
        ]}
      />

      <AvisoMetodologico />

      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <select
            value={uf}
            onChange={(e) => setFiltro({ uf: e.target.value || undefined })}
            className="rounded-md border bg-background px-3 py-2 text-sm"
          >
            {UFS.map((u) => (
              <option key={u} value={u}>
                {u || "Todas UFs"}
              </option>
            ))}
          </select>
          <select
            value={ano}
            onChange={(e) => setFiltro({ ano: Number(e.target.value) || undefined })}
            className="rounded-md border bg-background px-3 py-2 text-sm"
          >
            {ANOS.map((a) => (
              <option key={a} value={a}>
                {a || "Todos os anos"}
              </option>
            ))}
          </select>
          <input
            value={situacao}
            onChange={(e) => setFiltro({ situacao: e.target.value || undefined })}
            placeholder="Situação"
            className="rounded-md border bg-background px-3 py-2 text-sm"
          />
          <select
            value={valorMin}
            onChange={(e) => setFiltro({ valorMin: Number(e.target.value) || undefined })}
            className="rounded-md border bg-background px-3 py-2 text-sm"
          >
            {VALORES_MIN.map((o) => (
              <option key={o.v} value={o.v}>
                {o.label}
              </option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(e) => {
              const v = e.target.value as Ordem;
              setFiltro({ sort: v === "data_desc" ? undefined : v });
            }}
            className="rounded-md border bg-background px-3 py-2 text-sm"
          >
            {ORDENS.map((o) => (
              <option key={o.v} value={o.v}>
                {o.label}
              </option>
            ))}
          </select>
          <input
            value={q}
            onChange={(e) => setFiltro({ q: e.target.value || undefined })}
            placeholder="Objeto, convenente, órgão, nº…"
            className="rounded-md border bg-background px-3 py-2 text-sm sm:col-span-3 lg:col-span-5"
          />
        </div>
      </section>

      <section>
        {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {!isLoading && lista.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhum convênio disponível. Os dados do eixo "por tema" (cache CGU) são populados pela
            importação de convênios em <code>/admin/dados</code>.
          </p>
        )}
        {lista.length > 0 && (
          <div className="flex justify-end items-center gap-2 mb-2">
            <BotaoSalvarBusca
              path="/convenios"
              search={search}
              titulo="Convênios"
              filtros={[
                ["UF", uf],
                ["ano", ano],
                ["situação", situacao],
                ["valor mín.", valorMin],
                ["busca", q],
              ]}
            />
            <BotaoBaixarCsv
              filename={`convenios_${uf || "todos"}`}
              obterLinhas={() => lista}
              rotulo={`Exportar CSV (${lista.length})`}
            />
          </div>
        )}
        <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
          {lista.map((c) => (
            <li key={c.id} className="p-4 space-y-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <FileSignature className="size-4 text-muted-foreground" />
                    <Link to="/convenios/$id" params={{ id: c.id }} className="hover:underline">
                      Convênio {c.numero ?? c.id}
                    </Link>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {c.orgao_nome ?? "—"} → {c.convenente_nome ?? "—"}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    {c.uf && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted text-foreground/80">
                        {c.uf}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {[c.municipio_nome, c.tipo_instrumento, c.situacao]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-medium">{fmtBRL(c.valor)}</div>
                  <div className="text-xs text-muted-foreground">
                    Liberado: {fmtBRL(c.valor_liberado)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {c.data_inicio_vigencia ?? "—"}
                  </div>
                </div>
              </div>
              {c.objeto && <p className="text-sm text-muted-foreground line-clamp-2">{c.objeto}</p>}
              {c.url_oficial && (
                <a
                  href={c.url_oficial}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-accent underline inline-flex items-center gap-1"
                >
                  Ver no Portal da Transparência <ExternalLink className="size-3" />
                </a>
              )}
            </li>
          ))}
        </ul>
        <div ref={sentinel} className="h-12 flex items-center justify-center">
          {isFetchingNextPage && (
            <span className="text-xs text-muted-foreground inline-flex items-center gap-2">
              <Loader2 className="size-3.5 animate-spin" /> Carregando mais…
            </span>
          )}
          {!hasNextPage && lista.length > 0 && (
            <span className="text-xs text-muted-foreground">Fim dos resultados.</span>
          )}
        </div>
      </section>
    </div>
  );
}
