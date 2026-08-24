import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listarEmendasCgu } from "@/lib/data/real/queries.functions";
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
import { HandCoins } from "lucide-react";

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
const ORDENS: OpcaoOrdem[] = [
  { valor: "ano-desc", label: "Mais recentes" },
  { valor: "ano-asc", label: "Mais antigas" },
  { valor: "pago-desc", label: "Maior valor pago" },
  { valor: "pago-asc", label: "Menor valor pago" },
  { valor: "empenhado-desc", label: "Maior empenhado" },
  { valor: "empenhado-asc", label: "Menor empenhado" },
];
const ORDEM_PADRAO = "ano-desc";

// Filtros e paginação na URL: compartilhável, "salvar esta busca" e página
// estável no tempo (corte `ate` — ver src/lib/listagem/logic.ts).
type EmendasSearch = SearchListagem & {
  uf?: string;
  ano?: number;
  funcao?: string;
  tipo?: string;
  autor?: string;
  valorMin?: number;
  q?: string;
};

export const Route = createFileRoute("/emendas/")({
  validateSearch: (s: Record<string, unknown>): EmendasSearch => ({
    ...parseSearchListagem(s, { ordens: ORDENS, ordemPadrao: ORDEM_PADRAO }),
    uf: typeof s.uf === "string" && s.uf ? s.uf : undefined,
    ano: Number(s.ano) || undefined,
    funcao: typeof s.funcao === "string" && s.funcao ? s.funcao : undefined,
    tipo: typeof s.tipo === "string" && s.tipo ? s.tipo : undefined,
    autor: typeof s.autor === "string" && s.autor ? s.autor : undefined,
    valorMin: Number(s.valorMin) || undefined,
    q: typeof s.q === "string" && s.q ? s.q : undefined,
  }),
  component: EmendasPage,
  head: () => ({
    meta: [
      { title: "Emendas parlamentares — Mutirão de Dados" },
      {
        name: "description",
        content:
          "Emendas parlamentares com as três fases da despesa — empenho, liquidação e pagamento — do Portal da Transparência (CGU).",
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
  const autor = search.autor ?? "";
  const valorMin = search.valorMin ?? 0;
  const q = search.q ?? "";
  const pagina = search.pagina ?? 1;
  const itens = search.itens ?? ITENS_PADRAO;
  const ordem = search.ordem ?? ORDEM_PADRAO;

  // Mudar filtro/ordenação/itens volta para a página 1.
  const setFiltro = (patch: Partial<EmendasSearch>) =>
    navigate({
      search: (prev: EmendasSearch) => ({ ...prev, ...patch, pagina: undefined }),
      replace: true,
    });

  const { data, isLoading } = useQuery({
    queryKey: [
      "emendas-cgu",
      uf,
      ano,
      funcao,
      tipoEmenda,
      autor,
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
          ano: ano || undefined,
          funcao: funcao || undefined,
          tipoEmenda: tipoEmenda || undefined,
          autor: autor || undefined,
          valorMin: valorMin || undefined,
          ordem: ordem as "ano-desc",
          ate: search.ate,
          q: q || undefined,
          limit: itens,
          offset: offsetDaPagina(pagina, itens),
        },
      }),
  });

  const lista = data?.emendas ?? [];
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
          Origem política · O porquê
        </div>
        <h1 className="font-display text-4xl mt-1">Emendas parlamentares</h1>
        <p className="text-muted-foreground mt-3 max-w-3xl leading-relaxed">
          A indicação política do destino do dinheiro: deputados e senadores direcionam parte do
          orçamento federal para obras e projetos em suas bases. Cada emenda traz as três fases da
          despesa — empenhado, liquidado e pago. Os dados vêm do Portal da Transparência (CGU).
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
                path="/emendas"
                search={search}
                titulo="Emendas parlamentares"
                filtros={[
                  ["UF", uf],
                  ["ano", ano],
                  ["função", funcao],
                  ["tipo", tipoEmenda],
                  ["autor", autor],
                  ["valor mín.", valorMin],
                  ["busca", q],
                ]}
              />
              {lista.length > 0 && (
                <BotaoBaixarCsv
                  filename={`emendas_${ano || "todos"}`}
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
        <input
          value={autor}
          onChange={(e) => setFiltro({ autor: e.target.value || undefined })}
          placeholder="Autor (parlamentar ou bancada)"
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
          placeholder="Autor, localidade, função, código…"
          className="rounded-md border bg-background px-3 py-2 text-sm sm:col-span-3 lg:col-span-6"
        />
      </BarraDeFiltros>

      <section className="space-y-3">
        <ControlePaginacao
          pagina={pagina}
          itens={itens}
          total={total}
          to="/emendas"
          montarSearch={montarSearch}
        />

        {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {!isLoading && lista.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhuma emenda no acervo para os filtros selecionados.
          </p>
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

        <ControlePaginacao
          pagina={pagina}
          itens={itens}
          total={total}
          to="/emendas"
          montarSearch={montarSearch}
        />
      </section>
    </div>
  );
}
