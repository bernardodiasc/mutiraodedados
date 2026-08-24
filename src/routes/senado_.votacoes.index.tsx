import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listarVotacoesSenado, senadoVotacoesOverview } from "@/lib/data/senado/votacoes.functions";
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
import { CheckCircle2, XCircle, MinusCircle } from "lucide-react";

const ORDENS: OpcaoOrdem[] = [
  { valor: "data-desc", label: "Mais recentes" },
  { valor: "data-asc", label: "Mais antigas" },
];
const ORDEM_PADRAO = "data-desc";

// Filtros e paginação na URL: compartilhável e página estável no tempo
// (corte `ate` pela data da votação — ver src/lib/listagem/logic.ts).
type VotacoesSearch = SearchListagem & {
  q?: string;
};

export const Route = createFileRoute("/senado_/votacoes/")({
  validateSearch: (s: Record<string, unknown>): VotacoesSearch => ({
    ...parseSearchListagem(s, { ordens: ORDENS, ordemPadrao: ORDEM_PADRAO }),
    q: typeof s.q === "string" && s.q ? s.q : undefined,
  }),
  component: ListaVotacoesSenado,
  head: () => ({
    meta: [
      { title: "Votações nominais — Senado — Mutirão de Dados" },
      {
        name: "description",
        content:
          "Votações nominais em plenário do Senado, com resultado, matéria associada e contagem de votos.",
      },
    ],
  }),
});

function ListaVotacoesSenado() {
  const listFn = useServerFn(listarVotacoesSenado);
  const ovFn = useServerFn(senadoVotacoesOverview);

  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const q = search.q ?? "";
  const pagina = search.pagina ?? 1;
  const itens = search.itens ?? ITENS_PADRAO;
  const ordem = search.ordem ?? ORDEM_PADRAO;

  // Mudar filtro/ordenação/itens volta para a página 1.
  const setFiltro = (patch: Partial<VotacoesSearch>) =>
    navigate({
      search: (prev: VotacoesSearch) => ({ ...prev, ...patch, pagina: undefined }),
      replace: true,
    });

  const { data, isLoading } = useQuery({
    queryKey: ["senado", "vots", q, ordem, pagina, itens, search.ate],
    placeholderData: keepPreviousData,
    queryFn: () =>
      listFn({
        data: {
          termo: q.trim() || undefined,
          ordem: ordem as "data-desc",
          ate: search.ate,
          limit: itens,
          offset: offsetDaPagina(pagina, itens),
        },
      }),
  });
  const { data: ov } = useQuery({
    queryKey: ["senado", "vots-ov"],
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

  const statsCabecalho = [
    data ? `${total.toLocaleString("pt-BR")} votações no acervo` : null,
    ov ? `${ov.totalVotos.toLocaleString("pt-BR")} votos nominais` : null,
    ov?.ultimaData ? `última em ${ov.ultimaData}` : null,
  ].filter(Boolean);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 space-y-6">
      <TrilhaDeNavegacao
        itens={[{ label: "Senado Federal", to: "/senado" }, { label: "Votações nominais" }]}
      />
      <header>
        <h1 className="font-display text-4xl">Votações nominais</h1>
        <p className="text-muted-foreground mt-2 max-w-3xl">
          Cada votação registra nominalmente como cada senador votou. Clique em uma votação para ver
          disciplina partidária e voto individual.
        </p>
        {statsCabecalho.length > 0 && (
          <p className="text-xs text-muted-foreground mt-3">{statsCabecalho.join(" · ")}</p>
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
                filename="votacoes-senado"
                obterLinhas={() =>
                  linhas.map((v) => ({
                    data: v.data ?? "",
                    descricao: v.descricao ?? "",
                    materia: v.materiaTitulo ?? "",
                    resultado: v.resultado ?? "",
                    sim: v.votosSim,
                    nao: v.votosNao,
                    outros: v.votosOutros,
                  }))
                }
                rotulo={`Baixar CSV (${linhas.length})`}
              />
            )}
          </>
        }
      >
        <input
          placeholder="Buscar na descrição…"
          value={q}
          onChange={(e) => setFiltro({ q: e.target.value || undefined })}
          className="rounded-md border bg-background px-3 py-2 text-sm sm:col-span-3 lg:col-span-6"
        />
      </BarraDeFiltros>

      <ControlePaginacao
        pagina={pagina}
        itens={itens}
        total={total}
        to="/senado/votacoes"
        montarSearch={montarSearch}
      />

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : linhas.length === 0 ? (
        <EmptyState
          title="Nenhuma votação no acervo ainda"
          hint="Ainda não carregamos votações. Os dados vêm do Senado Federal e entram no acervo aos poucos — volte em breve."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2 w-24">Data</th>
                <th className="text-left px-4 py-2">Descrição</th>
                <th className="text-center px-4 py-2 w-32">Resultado</th>
                <th className="text-right px-4 py-2 w-40">Sim · Não · Outros</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((v) => (
                <tr key={v.id} className="border-t border-border hover:bg-muted/20">
                  <td className="px-4 py-3 align-top text-xs text-muted-foreground whitespace-nowrap">
                    {v.data ?? "—"}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <Link
                      to="/senado/votacoes/$id"
                      params={{ id: v.id }}
                      className="text-accent hover:underline"
                    >
                      <p className="line-clamp-2 leading-snug">
                        {v.descricao ?? "(sem descrição)"}
                      </p>
                    </Link>
                    {v.materiaTitulo && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                        {v.materiaTitulo}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top text-center">
                    <ResultadoBadge res={v.resultado} />
                  </td>
                  <td className="px-4 py-3 align-top text-right font-mono text-xs whitespace-nowrap">
                    <span className="text-emerald-500">{v.votosSim}</span>
                    {" · "}
                    <span className="text-rose-500">{v.votosNao}</span>
                    {" · "}
                    <span className="text-muted-foreground">{v.votosOutros}</span>
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
        to="/senado/votacoes"
        montarSearch={montarSearch}
      />
    </div>
  );
}

function ResultadoBadge({ res }: { res: string | null }) {
  const t = (res ?? "").toLowerCase();
  if (t.includes("aprov")) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-500">
        <CheckCircle2 className="size-3" /> Aprovado
      </span>
    );
  }
  if (t.includes("rejeit")) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-rose-500">
        <XCircle className="size-3" /> Rejeitado
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <MinusCircle className="size-3" /> {res ?? "—"}
    </span>
  );
}
