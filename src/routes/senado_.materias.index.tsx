import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listarMaterias, senadoMateriasOverview } from "@/lib/data/senado/materias.functions";
import { BarraDeFiltros } from "@/components/BarraDeFiltros";
import { BotaoBaixarCsv } from "@/components/BotaoBaixarCsv";
import { ControlePaginacao } from "@/components/ControlePaginacao";
import { EmptyState } from "@/components/EmptyState";
import { SeletorItensPorPagina } from "@/components/SeletorItensPorPagina";
import { SeletorOrdenacao } from "@/components/SeletorOrdenacao";
import { TrilhaDeNavegacao } from "@/components/TrilhaDeNavegacao";
import {
  ITENS_PADRAO,
  offsetDaPagina,
  parseSearchListagem,
  type OpcaoOrdem,
  type SearchListagem,
} from "@/lib/listagem/logic";

const TIPOS_COMUNS = ["PL", "PEC", "PLP", "MPV", "PDL", "PRS", "PLS"];
const ORDENS: OpcaoOrdem[] = [
  { valor: "data-desc", label: "Mais recentes" },
  { valor: "data-asc", label: "Mais antigas" },
];
const ORDEM_PADRAO = "data-desc";

// Filtros e paginação na URL: compartilhável e página estável no tempo
// (corte `ate` pela data de apresentação — ver src/lib/listagem/logic.ts).
type MateriasSearch = SearchListagem & {
  tipo?: string;
  ano?: number;
  q?: string;
};

export const Route = createFileRoute("/senado_/materias/")({
  validateSearch: (s: Record<string, unknown>): MateriasSearch => ({
    ...parseSearchListagem(s, { ordens: ORDENS, ordemPadrao: ORDEM_PADRAO }),
    tipo: typeof s.tipo === "string" && s.tipo ? s.tipo : undefined,
    ano: Number(s.ano) || undefined,
    q: typeof s.q === "string" && s.q ? s.q : undefined,
  }),
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

function ListaMaterias() {
  const listFn = useServerFn(listarMaterias);
  const ovFn = useServerFn(senadoMateriasOverview);

  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const tipo = search.tipo ?? "";
  const ano = search.ano ?? 0;
  const q = search.q ?? "";
  const pagina = search.pagina ?? 1;
  const itens = search.itens ?? ITENS_PADRAO;
  const ordem = search.ordem ?? ORDEM_PADRAO;

  // Mudar filtro/ordenação/itens volta para a página 1.
  const setFiltro = (patch: Partial<MateriasSearch>) =>
    navigate({
      search: (prev: MateriasSearch) => ({ ...prev, ...patch, pagina: undefined }),
      replace: true,
    });

  const { data, isLoading } = useQuery({
    queryKey: ["senado", "mats", tipo, ano, q, ordem, pagina, itens, search.ate],
    placeholderData: keepPreviousData,
    queryFn: () =>
      listFn({
        data: {
          sigla: tipo || undefined,
          ano: ano || undefined,
          termo: q.trim() || undefined,
          ordem: ordem as "data-desc",
          ate: search.ate,
          limit: itens,
          offset: offsetDaPagina(pagina, itens),
        },
      }),
  });
  const { data: overview } = useQuery({
    queryKey: ["senado", "mats-ov"],
    queryFn: () => ovFn(),
  });

  const linhas = data?.linhas ?? [];
  const total = data?.total ?? 0;
  // Fixa o corte nos links de página: a mesma URL mostra sempre os mesmos registros.
  const corte = search.ate ?? data?.corteSugerido;
  const montarSearch = (p: number): Record<string, unknown> => ({
    ...search,
    pagina: p > 1 ? p : undefined,
    ate: corte,
  });

  const anoAtual = new Date().getFullYear();
  const anosDisponiveis = Array.from({ length: 8 }, (_, i) => anoAtual - i);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 space-y-6">
      <TrilhaDeNavegacao
        itens={[{ label: "Senado Federal", to: "/senado" }, { label: "Matérias legislativas" }]}
      />
      <header>
        <h1 className="font-display text-4xl">Matérias legislativas</h1>
        <p className="text-muted-foreground mt-2 max-w-3xl">
          PL (projeto de lei), PEC (emenda constitucional), MPV (medida provisória), PLP (lei
          complementar), PDL e demais matérias em tramitação no Senado.
        </p>
        {data && (
          <p className="text-xs text-muted-foreground mt-3">
            {total.toLocaleString("pt-BR")} matérias no acervo
            {overview && overview.porTipo.length > 0 && (
              <>
                {" "}
                · por tipo:{" "}
                {overview.porTipo.slice(0, 8).map((t, i) => (
                  <span key={t.tipo}>
                    {i > 0 && " · "}
                    <button
                      className="underline-offset-2 hover:underline hover:text-accent"
                      onClick={() => setFiltro({ tipo: t.tipo })}
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

      <BarraDeFiltros
        acoes={
          <>
            <div className="flex flex-wrap items-center gap-3">
              <SeletorOrdenacao
                opcoes={ORDENS}
                valor={ordem}
                aoMudar={(v) => setFiltro({ ordem: v !== ORDEM_PADRAO ? v : undefined })}
              />
              <SeletorItensPorPagina
                valor={itens}
                aoMudar={(n) => setFiltro({ itens: n !== ITENS_PADRAO ? n : undefined })}
              />
            </div>
            {linhas.length > 0 && (
              <BotaoBaixarCsv
                filename="materias"
                obterLinhas={() =>
                  linhas.map((p) => ({
                    materia: `${p.siglaSubtipo} ${p.numero}/${p.ano}`,
                    apresentada: p.dataApresentacao ?? "",
                    autor: p.autorPrincipal ?? "",
                    ementa: p.ementa ?? "",
                    situacao: p.ultimaSituacao ?? "",
                  }))
                }
                rotulo={`Baixar CSV (${linhas.length})`}
              />
            )}
          </>
        }
      >
        <input
          value={q}
          onChange={(e) => setFiltro({ q: e.target.value || undefined })}
          placeholder="Buscar na ementa…"
          className="rounded-md border bg-background px-3 py-2 text-sm sm:col-span-2 lg:col-span-4"
        />
        <select
          value={tipo}
          onChange={(e) => setFiltro({ tipo: e.target.value || undefined })}
          className="rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="">Todos tipos</option>
          {TIPOS_COMUNS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          value={ano}
          onChange={(e) => setFiltro({ ano: Number(e.target.value) || undefined })}
          className="rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value={0}>Todos anos</option>
          {anosDisponiveis.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </BarraDeFiltros>

      <section className="space-y-3">
        <ControlePaginacao
          pagina={pagina}
          itens={itens}
          total={total}
          to="/senado/materias"
          montarSearch={montarSearch}
        />

        {isLoading ? (
          <div className="text-sm text-muted-foreground">Carregando…</div>
        ) : linhas.length === 0 ? (
          <EmptyState
            title="Nenhuma matéria encontrada"
            hint="Tente outro filtro. Os dados vêm do Senado Federal e entram no acervo aos poucos — a matéria pode ainda não ter chegado."
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
                {linhas.map((p) => (
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

        <ControlePaginacao
          pagina={pagina}
          itens={itens}
          total={total}
          to="/senado/materias"
          montarSearch={montarSearch}
        />
      </section>
    </div>
  );
}
