import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listarRelatoriosSICONFI } from "@/lib/data/siconfi/queries.functions";
import { BarraDeFiltros } from "@/components/BarraDeFiltros";
import { BotaoBaixarCsv } from "@/components/BotaoBaixarCsv";
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
import { Landmark } from "lucide-react";

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
const TIPOS = ["", "RREO", "RREO Simplificado", "RGF", "RGF Simplificado", "DCA"];
const ORDENS: OpcaoOrdem[] = [
  { valor: "exercicio-desc", label: "Mais recentes" },
  { valor: "exercicio-asc", label: "Mais antigos" },
  { valor: "valor-desc", label: "Maior valor" },
  { valor: "valor-asc", label: "Menor valor" },
];
const ORDEM_PADRAO = "exercicio-desc";

// Filtros e paginação na URL: compartilhável e página estável no tempo
// (corte `ate` — ver src/lib/listagem/logic.ts).
type RelatoriosSearch = SearchListagem & {
  uf?: string;
  exercicio?: number;
  tipo?: string;
  q?: string;
};

export const Route = createFileRoute("/relatorios-fiscais")({
  validateSearch: (s: Record<string, unknown>): RelatoriosSearch => ({
    ...parseSearchListagem(s, { ordens: ORDENS, ordemPadrao: ORDEM_PADRAO }),
    uf: typeof s.uf === "string" && s.uf ? s.uf : undefined,
    exercicio: Number(s.exercicio) || undefined,
    tipo: typeof s.tipo === "string" && s.tipo ? s.tipo : undefined,
    q: typeof s.q === "string" && s.q ? s.q : undefined,
  }),
  component: RelatoriosFiscaisPage,
  head: () => ({
    meta: [
      { title: "Relatórios fiscais — Mutirão de Dados" },
      {
        name: "description",
        content:
          "Listagem de relatórios fiscais (RREO, RGF e DCA) de todos os entes federados, via SICONFI / Tesouro Nacional.",
      },
    ],
  }),
});

function RelatoriosFiscaisPage() {
  const buscar = useServerFn(listarRelatoriosSICONFI);
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const uf = search.uf ?? "";
  const exercicio = search.exercicio ?? 0;
  const tipo = search.tipo ?? "";
  const q = search.q ?? "";
  const pagina = search.pagina ?? 1;
  const itens = search.itens ?? ITENS_PADRAO;
  const ordem = search.ordem ?? ORDEM_PADRAO;

  // Mudar filtro/ordenação/itens volta para a página 1.
  const setFiltro = (patch: Partial<RelatoriosSearch>) =>
    navigate({
      search: (prev: RelatoriosSearch) => ({ ...prev, ...patch, pagina: undefined }),
      replace: true,
    });

  const { data, isLoading } = useQuery({
    queryKey: ["siconfi", uf, exercicio, tipo, ordem, q, pagina, itens, search.ate],
    placeholderData: keepPreviousData,
    queryFn: () =>
      buscar({
        data: {
          uf: uf || undefined,
          exercicio: exercicio || undefined,
          tipoRelatorio: tipo || undefined,
          ordem: ordem as "exercicio-desc",
          ate: search.ate,
          q: q || undefined,
          limit: itens,
          offset: offsetDaPagina(pagina, itens),
        },
      }),
  });

  const lista = data?.relatorios ?? [];
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
          Por tipo de dados
        </div>
        <h1 className="font-display text-4xl mt-1">Relatórios fiscais</h1>
        <p className="text-muted-foreground mt-3 max-w-3xl leading-relaxed">
          Os relatórios contábeis e fiscais que todo ente federado é obrigado a publicar pela Lei de
          Responsabilidade Fiscal. São três tipos: <strong className="text-foreground">RREO</strong>{" "}
          (Relatório Resumido da Execução Orçamentária, bimestral),{" "}
          <strong className="text-foreground">RGF</strong> (Relatório de Gestão Fiscal,
          quadrimestral ou semestral) e <strong className="text-foreground">DCA</strong> (Declaração
          de Contas Anuais).
        </p>
        <p className="text-muted-foreground mt-2 max-w-3xl leading-relaxed">
          Cada linha abaixo é um valor declarado por um ente: combinação de <em>anexo</em> e{" "}
          <em>coluna</em> do relatório (ex.: Anexo 1 do RREO = Balanço Orçamentário), a{" "}
          <em>conta</em> contábil, o <em>valor</em> e o <em>exercício/período</em> a que se refere.
        </p>
      </header>

      <FontesDoTema fontes={[{ label: "SICONFI (Tesouro Nacional)", to: "/siconfi" }]} />

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
            {lista.length > 0 && (
              <BotaoBaixarCsv
                filename={`siconfi_${uf || "todos"}_${exercicio || "todos"}`}
                obterLinhas={() => lista}
                rotulo={`Exportar CSV (${lista.length})`}
              />
            )}
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
        <input
          type="number"
          value={exercicio || ""}
          onChange={(e) => setFiltro({ exercicio: Number(e.target.value) || undefined })}
          placeholder="Exercício"
          className="rounded-md border bg-background px-3 py-2 text-sm"
        />
        <select
          value={tipo}
          onChange={(e) => setFiltro({ tipo: e.target.value || undefined })}
          className="rounded-md border bg-background px-3 py-2 text-sm"
        >
          {TIPOS.map((t) => (
            <option key={t} value={t}>
              {t || "Todos relatórios"}
            </option>
          ))}
        </select>
        <input
          value={q}
          onChange={(e) => setFiltro({ q: e.target.value || undefined })}
          placeholder="Buscar conta..."
          className="rounded-md border bg-background px-3 py-2 text-sm"
        />
      </BarraDeFiltros>

      <section className="space-y-3">
        <ControlePaginacao
          pagina={pagina}
          itens={itens}
          total={total}
          to="/relatorios-fiscais"
          montarSearch={montarSearch}
        />

        {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {!isLoading && lista.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhum relatório no acervo para os filtros selecionados.
          </p>
        )}
        <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
          {lista.map((r) => (
            <li key={r.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Landmark className="size-4 text-muted-foreground" />
                    {r.ente_nome}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {[r.uf, r.esfera, r.tipo_relatorio, r.anexo, r.coluna]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                  {r.conta && <div className="text-sm mt-1">{r.conta}</div>}
                </div>
                <div className="text-right shrink-0">
                  <div className="font-medium">{fmtBRL(r.valor)}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.exercicio}
                    {r.periodo ? ` · P${r.periodo}` : ""}
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
          to="/relatorios-fiscais"
          montarSearch={montarSearch}
        />
      </section>
    </div>
  );
}
