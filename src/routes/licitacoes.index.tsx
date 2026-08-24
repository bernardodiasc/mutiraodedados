import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listarLicitacoes } from "@/lib/data/real/queries.functions";
import { BarraDeFiltros } from "@/components/BarraDeFiltros";
import { BotaoBaixarCsv } from "@/components/BotaoBaixarCsv";
import { BotaoSalvarBusca } from "@/components/BotaoSalvarBusca";
import { ControlePaginacao } from "@/components/ControlePaginacao";
import { FontesDoTema } from "@/components/FontesDoTema";
import { SeletorItensPorPagina } from "@/components/SeletorItensPorPagina";
import { SeletorOrdenacao } from "@/components/SeletorOrdenacao";
import {
  ITENS_PADRAO,
  offsetDaPagina,
  parseSearchListagem,
  type OpcaoOrdem,
  type SearchListagem,
} from "@/lib/listagem/logic";
import { fmtBRL } from "@/lib/fmt";
import { ExternalLink, Gavel } from "lucide-react";
import { linkBuscaPncp } from "@/lib/links-oficiais";

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
const ANOS = [0, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015, 2014, 2013];
const VALORES_MIN = [
  { v: 0, label: "Qualquer valor" },
  { v: 100_000, label: "≥ R$ 100 mil" },
  { v: 1_000_000, label: "≥ R$ 1 mi" },
  { v: 10_000_000, label: "≥ R$ 10 mi" },
];
const ORDENS: OpcaoOrdem[] = [
  { valor: "data-desc", label: "Mais recentes" },
  { valor: "data-asc", label: "Mais antigas" },
  { valor: "valor-desc", label: "Maior valor" },
  { valor: "valor-asc", label: "Menor valor" },
];
const ORDEM_PADRAO = "data-desc";

// Filtros e paginação na URL: compartilhável, "salvar esta busca" e página
// estável no tempo (corte `ate` — ver src/lib/listagem/logic.ts).
type LicitacoesSearch = SearchListagem & {
  uf?: string;
  orgao?: string;
  ano?: number;
  modalidade?: string;
  situacao?: string;
  valorMin?: number;
  q?: string;
};

export const Route = createFileRoute("/licitacoes/")({
  validateSearch: (s: Record<string, unknown>): LicitacoesSearch => ({
    ...parseSearchListagem(s, { ordens: ORDENS, ordemPadrao: ORDEM_PADRAO }),
    uf: typeof s.uf === "string" && s.uf ? s.uf : undefined,
    orgao: typeof s.orgao === "string" && s.orgao ? s.orgao : undefined,
    ano: Number(s.ano) || undefined,
    modalidade: typeof s.modalidade === "string" && s.modalidade ? s.modalidade : undefined,
    situacao: typeof s.situacao === "string" && s.situacao ? s.situacao : undefined,
    valorMin: Number(s.valorMin) || undefined,
    q: typeof s.q === "string" && s.q ? s.q : undefined,
  }),
  component: LicitacoesPage,
  head: () => ({
    meta: [
      { title: "Licitações — Mutirão de Dados" },
      {
        name: "description",
        content:
          "Licitações de órgãos do Executivo federal publicadas no Portal da Transparência (CGU).",
      },
    ],
  }),
});

function LicitacoesPage() {
  const buscar = useServerFn(listarLicitacoes);
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const uf = search.uf ?? "";
  const orgao = search.orgao ?? "";
  const ano = search.ano ?? 0;
  const modalidade = search.modalidade ?? "";
  const situacao = search.situacao ?? "";
  const valorMin = search.valorMin ?? 0;
  const q = search.q ?? "";
  const pagina = search.pagina ?? 1;
  const itens = search.itens ?? ITENS_PADRAO;
  const ordem = search.ordem ?? ORDEM_PADRAO;

  // Mudar filtro/ordenação/itens volta para a página 1.
  const setFiltro = (patch: Partial<LicitacoesSearch>) =>
    navigate({
      search: (prev: LicitacoesSearch) => ({ ...prev, ...patch, pagina: undefined }),
      replace: true,
    });

  const { data, isLoading } = useQuery({
    queryKey: [
      "licitacoes",
      uf,
      orgao,
      ano,
      modalidade,
      situacao,
      valorMin,
      ordem,
      q,
      pagina,
      itens,
      search.ate,
    ],
    placeholderData: keepPreviousData,
    queryFn: () =>
      buscar({
        data: {
          uf: uf || undefined,
          orgaoCod: orgao || undefined,
          ano: ano || undefined,
          modalidade: modalidade || undefined,
          situacao: situacao || undefined,
          valorMin: valorMin || undefined,
          ordem: ordem as "data-desc",
          ate: search.ate,
          q: q || undefined,
          limit: itens,
          offset: offsetDaPagina(pagina, itens),
        },
      }),
  });

  const lista = data?.licitacoes ?? [];
  const total = data?.total ?? 0;
  // Fixa o corte nos links de página: a mesma URL mostra sempre os mesmos registros.
  const corte = search.ate ?? data?.corteSugerido;
  const montarSearch = (p: number): Record<string, unknown> => ({
    ...search,
    pagina: p > 1 ? p : undefined,
    ate: corte,
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 space-y-8">
      <header>
        <div className="text-xs text-muted-foreground uppercase tracking-wider">
          Executivo federal · A disputa
        </div>
        <h1 className="font-display text-4xl mt-1">Licitações</h1>
        <p className="text-muted-foreground mt-3 max-w-3xl leading-relaxed">
          O processo de disputa pública pelo qual o governo escolhe quem contratar. Os dados vêm do
          Portal da Transparência (CGU) e cobrem órgãos do Executivo federal. Os documentos
          completos (edital, termo de referência, atas de lances) ficam no PNCP — use o link de
          busca em cada licitação.
        </p>
      </header>

      <FontesDoTema
        fontes={[
          {
            label: "PNCP",
            to: "/pncp",
            nota: "Edital, termo de referência e atas de lances ficam no PNCP (fonte autoritativa)",
          },
        ]}
      />

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
            <div className="flex flex-wrap items-center gap-2">
              <BotaoSalvarBusca
                path="/licitacoes"
                search={search}
                titulo="Licitações"
                filtros={[
                  ["UF", uf],
                  ["ano", ano],
                  ["modalidade", modalidade],
                  ["situação", situacao],
                  ["valor mín.", valorMin],
                  ["busca", q],
                ]}
              />
              {lista.length > 0 && (
                <BotaoBaixarCsv
                  filename={`licitacoes_${uf || "todos"}`}
                  obterLinhas={() => lista}
                  rotulo={`Exportar CSV (${lista.length})`}
                />
              )}
            </div>
          </>
        }
      >
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
          value={modalidade}
          onChange={(e) => setFiltro({ modalidade: e.target.value || undefined })}
          placeholder="Modalidade"
          className="rounded-md border bg-background px-3 py-2 text-sm"
        />
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
        <input
          value={q}
          onChange={(e) => setFiltro({ q: e.target.value || undefined })}
          placeholder="Objeto, número, processo, unidade gestora…"
          className="rounded-md border bg-background px-3 py-2 text-sm"
        />
      </BarraDeFiltros>

      {orgao && (
        <p className="text-xs text-muted-foreground -mt-4">
          Filtrando pelo órgão <span className="font-mono">{orgao}</span> ·{" "}
          <button
            type="button"
            onClick={() => setFiltro({ orgao: undefined })}
            className="text-accent underline cursor-pointer"
          >
            remover filtro
          </button>
        </p>
      )}

      <section className="space-y-3">
        <ControlePaginacao
          pagina={pagina}
          itens={itens}
          total={total}
          to="/licitacoes"
          montarSearch={montarSearch}
        />

        {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {!isLoading && lista.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhuma licitação no acervo para os filtros selecionados.
          </p>
        )}
        <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
          {lista.map((l) => (
            <li key={l.id} className="p-4 space-y-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Gavel className="size-4 text-muted-foreground" />
                    <Link to="/licitacoes/$id" params={{ id: l.id }} className="hover:underline">
                      Licitação {l.numero ?? "—"}
                    </Link>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {l.unidade_gestora ?? "—"}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    {l.uf && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted text-foreground/80">
                        {l.uf}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {[l.municipio_nome, l.modalidade, l.situacao].filter(Boolean).join(" · ")}
                    </span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-medium">{fmtBRL(l.valor)}</div>
                  <div className="text-xs text-muted-foreground">{l.data_abertura ?? "—"}</div>
                </div>
              </div>
              {l.objeto && <p className="text-sm text-muted-foreground line-clamp-2">{l.objeto}</p>}
              <div className="flex flex-wrap items-center gap-3">
                {l.url_oficial && (
                  <a
                    href={l.url_oficial}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-accent underline inline-flex items-center gap-1"
                  >
                    Portal da Transparência <ExternalLink className="size-3" />
                  </a>
                )}
                <a
                  href={linkBuscaPncp({
                    cnpjOrgao: l.orgao_cnpj,
                    numero: l.numero_processo ?? l.numero,
                  })}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-accent underline inline-flex items-center gap-1"
                >
                  Buscar no PNCP <ExternalLink className="size-3" />
                </a>
              </div>
            </li>
          ))}
        </ul>

        <ControlePaginacao
          pagina={pagina}
          itens={itens}
          total={total}
          to="/licitacoes"
          montarSearch={montarSearch}
        />
      </section>
    </div>
  );
}
