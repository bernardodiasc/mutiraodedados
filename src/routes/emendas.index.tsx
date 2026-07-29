import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef } from "react";
import { listarEmendasCgu } from "@/lib/data/real/queries.functions";
import { AvisoMetodologico } from "@/components/AvisoMetodologico";
import { BotaoBaixarCsv } from "@/components/BotaoBaixarCsv";
import { BotaoSalvarBusca } from "@/components/BotaoSalvarBusca";
import { FontesDoTema } from "@/components/FontesDoTema";
import { fmtBRL } from "@/lib/fmt";
import { HandCoins, Loader2 } from "lucide-react";

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
const ANOS = [0, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015, 2014];
const VALORES_MIN = [
  { v: 0, label: "Qualquer valor" },
  { v: 100_000, label: "≥ R$ 100 mil" },
  { v: 1_000_000, label: "≥ R$ 1 mi" },
  { v: 10_000_000, label: "≥ R$ 10 mi" },
];
const ORDENS = [
  { v: "pago_desc", label: "Maior valor pago" },
  { v: "empenhado_desc", label: "Maior empenho" },
] as const;
const PAGE = 40;
type Ordem = (typeof ORDENS)[number]["v"];

// Filtros na URL: permite compartilhar e "salvar esta busca" no caderno.
type EmendasSearch = {
  uf?: string;
  ano?: number;
  funcao?: string;
  tipo?: string;
  valorMin?: number;
  sort?: Ordem;
  q?: string;
};

export const Route = createFileRoute("/emendas/")({
  validateSearch: (s: Record<string, unknown>): EmendasSearch => ({
    uf: typeof s.uf === "string" && s.uf ? s.uf : undefined,
    ano: Number(s.ano) || undefined,
    funcao: typeof s.funcao === "string" && s.funcao ? s.funcao : undefined,
    tipo: typeof s.tipo === "string" && s.tipo ? s.tipo : undefined,
    valorMin: Number(s.valorMin) || undefined,
    sort: ORDENS.some((o) => o.v === s.sort) ? (s.sort as Ordem) : undefined,
    q: typeof s.q === "string" && s.q ? s.q : undefined,
  }),
  component: EmendasPage,
  head: () => ({
    meta: [
      { title: "Emendas parlamentares — Mutirão de Dados" },
      {
        name: "description",
        content:
          "Emendas parlamentares (empenho, liquidação e pagamento) do Portal da Transparência (CGU), endpoint /emendas.",
      },
    ],
  }),
});

function EmendasPage() {
  const buscar = useServerFn(listarEmendasCgu);
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const uf = search.uf ?? "";
  const ano = search.ano ?? 0;
  const funcao = search.funcao ?? "";
  const tipoEmenda = search.tipo ?? "";
  const valorMin = search.valorMin ?? 0;
  const sort: Ordem = search.sort ?? "pago_desc";
  const q = search.q ?? "";
  const setFiltro = (patch: Partial<EmendasSearch>) =>
    navigate({ search: (prev: EmendasSearch) => ({ ...prev, ...patch }), replace: true });

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ["emendas-cgu", uf, ano, funcao, tipoEmenda, valorMin, sort, q],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      buscar({
        data: {
          uf: uf || undefined,
          ano: ano || undefined,
          funcao: funcao || undefined,
          tipoEmenda: tipoEmenda || undefined,
          valorMin: valorMin || undefined,
          sort,
          q: q || undefined,
          limit: PAGE,
          offset: pageParam as number,
        },
      }),
    getNextPageParam: (last, pages) =>
      (last.emendas?.length ?? 0) < PAGE ? undefined : pages.length * PAGE,
  });

  const lista = (data?.pages ?? []).flatMap((p) => p.emendas);

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
          Origem política · O porquê
        </div>
        <h1 className="font-display text-4xl mt-1">Emendas Parlamentares</h1>
        <p className="text-muted-foreground mt-3 max-w-3xl leading-relaxed">
          A indicação política do destino do dinheiro: deputados e senadores direcionam parte do
          orçamento federal para obras e projetos em suas bases. Cada emenda traz as três fases da
          despesa — empenhado, liquidado e pago. Fonte: Portal da Transparência (CGU), endpoint{" "}
          <code>/emendas</code>.
        </p>
      </header>

      <FontesDoTema
        fontes={[
          {
            label: "Transferegov (EC 105)",
            to: "/transferegov",
            nota: "As emendas Pix (EC 105) — Especiais e Finalidade Definida — são operadas pelo Transferegov",
          },
        ]}
      />

      <AvisoMetodologico />

      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
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
            value={funcao}
            onChange={(e) => setFiltro({ funcao: e.target.value || undefined })}
            placeholder="Função (ex: Saúde)"
            className="rounded-md border bg-background px-3 py-2 text-sm"
          />
          {/* As "emendas Pix" da EC 105 são um tipo de emenda — filtre aqui por
              "Finalidade Definida" ou "Especial". */}
          <select
            value={tipoEmenda}
            onChange={(e) => setFiltro({ tipo: e.target.value || undefined })}
            className="rounded-md border bg-background px-3 py-2 text-sm"
            title="Tipo de emenda (EC 105 / emendas Pix: Finalidade Definida ou Especial)"
          >
            <option value="">Todos os tipos</option>
            <option value="Emenda de Relator">Relator — RP9 (orçamento secreto)</option>
            <option value="Emenda de Comissão">Comissão — RP8</option>
            <option value="Emenda de Bancada">Bancada estadual</option>
            <option value="Finalidade Definida">Individual — Finalidade Definida</option>
            <option value="Transferências Especiais">Individual — Especial (EC 105)</option>
          </select>
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
              setFiltro({ sort: v === "pago_desc" ? undefined : v });
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
            placeholder="Autor, localidade, função, código…"
            className="rounded-md border bg-background px-3 py-2 text-sm sm:col-span-3 lg:col-span-6"
          />
        </div>
      </section>

      <section>
        {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {!isLoading && lista.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhuma emenda disponível para os filtros selecionados.
          </p>
        )}
        {lista.length > 0 && (
          <div className="flex justify-end items-center gap-2 mb-2">
            <BotaoSalvarBusca
              path="/emendas"
              search={search}
              titulo="Emendas parlamentares"
              filtros={[
                ["UF", uf],
                ["ano", ano],
                ["função", funcao],
                ["tipo", tipoEmenda],
                ["valor mín.", valorMin],
                ["busca", q],
              ]}
            />
            <BotaoBaixarCsv
              filename={`emendas_${ano || "todos"}`}
              obterLinhas={() => lista}
              rotulo={`Exportar CSV (${lista.length})`}
            />
          </div>
        )}
        <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
          {lista.map((e) => (
            <li key={e.id} className="p-4 space-y-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <HandCoins className="size-4 text-muted-foreground" />
                    <Link to="/emendas/$id" params={{ id: e.id }} className="hover:underline">
                      {e.autor ?? "Emenda"} · {e.numero_emenda ?? e.id}
                    </Link>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{e.tipo_emenda ?? "—"}</div>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    {e.uf && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted text-foreground/80">
                        {e.uf}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {[e.localidade, e.funcao].filter(Boolean).join(" · ")}
                    </span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-medium">{fmtBRL(e.valor_pago)}</div>
                  <div className="text-xs text-muted-foreground">
                    empenhado {fmtBRL(e.valor_empenhado)}
                  </div>
                </div>
              </div>
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
