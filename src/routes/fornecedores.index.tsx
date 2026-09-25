import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Building2 } from "lucide-react";
import { listarFornecedores } from "@/lib/data/fornecedores.functions";
import { BarraDeFiltros } from "@/components/BarraDeFiltros";
import { ControlePaginacao } from "@/components/ControlePaginacao";
import { PainelExplicar } from "@/components/PainelExplicar";
import { SeletorItensPorPagina } from "@/components/SeletorItensPorPagina";
import { SeletorOrdenacao } from "@/components/SeletorOrdenacao";
import {
  ITENS_PADRAO,
  offsetDaPagina,
  parseSearchListagem,
  type OpcaoOrdem,
  type SearchListagem,
} from "@/lib/listagem/logic";

const ORDENS: OpcaoOrdem[] = [
  { valor: "nome-asc", label: "Nome (A→Z)" },
  { valor: "nome-desc", label: "Nome (Z→A)" },
];
const ORDEM_PADRAO = "nome-asc";

type FornecedoresSearch = SearchListagem & { q?: string };

export const Route = createFileRoute("/fornecedores/")({
  validateSearch: (s: Record<string, unknown>): FornecedoresSearch => ({
    ...parseSearchListagem(s, { ordens: ORDENS, ordemPadrao: ORDEM_PADRAO }),
    q: typeof s.q === "string" && s.q ? s.q : undefined,
  }),
  component: FornecedoresPage,
  head: () => ({
    meta: [
      { title: "Fornecedores — Mutirão de Dados" },
      {
        name: "description",
        content:
          "Empresas que fornecem ao governo federal: busque por nome ou CNPJ e veja contratos, radar de risco e doações de campanha de cada fornecedor.",
      },
    ],
  }),
});

function FornecedoresPage() {
  const buscar = useServerFn(listarFornecedores);
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const q = search.q ?? "";
  const pagina = search.pagina ?? 1;
  const itens = search.itens ?? ITENS_PADRAO;
  const ordem = search.ordem ?? ORDEM_PADRAO;

  // Mudar filtro/ordenação/itens volta para a página 1.
  const setFiltro = (patch: Partial<FornecedoresSearch>) =>
    navigate({
      search: (prev: FornecedoresSearch) => ({ ...prev, ...patch, pagina: undefined }),
      replace: true,
    });

  const { data, isLoading } = useQuery({
    queryKey: ["fornecedores", q, ordem, pagina, itens, search.ate],
    placeholderData: keepPreviousData,
    queryFn: () =>
      buscar({
        data: {
          q: q || undefined,
          ordem: ordem as "nome-asc",
          ate: search.ate,
          limit: itens,
          offset: offsetDaPagina(pagina, itens),
        },
      }),
  });

  const lista = data?.fornecedores ?? [];
  const total = data?.total ?? 0;
  // Fixa o corte nos links de página: a mesma URL mostra sempre os mesmos registros.
  const corte = search.ate ?? data?.corteSugerido;
  const montarSearch = (p: number): Record<string, unknown> => ({
    ...search,
    pagina: p > 1 ? p : undefined,
    ate: corte,
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 space-y-6">
      <header>
        <div className="text-xs text-muted-foreground uppercase tracking-wider">Quem recebe</div>
        <h1 className="font-display text-4xl mt-1">Fornecedores</h1>
        <p className="text-muted-foreground mt-3 max-w-3xl leading-relaxed">
          As empresas do outro lado dos contratos públicos. Cada ficha reúne o que o acervo sabe
          sobre um CNPJ: contratos federais, presença no PNCP, notas de cota parlamentar e doações
          de campanha.
        </p>
      </header>

      <PainelExplicar titulo="De onde vem este cadastro?">
        <p>
          O cadastro nasce dos contratos do Portal da Transparência (CGU): todo CNPJ que aparece
          como contratado do Executivo federal entra aqui. A ficha de cada fornecedor cruza esse
          CNPJ com as demais fontes do acervo — PNCP, cotas parlamentares (CEAP/CEAPS) e doações de
          campanha (TSE).
        </p>
      </PainelExplicar>

      <BarraDeFiltros
        acoes={
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
        }
      >
        <input
          value={q}
          onChange={(e) => setFiltro({ q: e.target.value || undefined })}
          placeholder="Nome da empresa ou CNPJ"
          className="rounded-md border bg-background px-3 py-2 text-sm sm:col-span-3 lg:col-span-6"
        />
      </BarraDeFiltros>

      <ControlePaginacao
        pagina={pagina}
        itens={itens}
        total={total}
        to="/fornecedores"
        montarSearch={montarSearch}
      />

      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {!isLoading && lista.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nenhum fornecedor no acervo para essa busca. Confira a grafia ou tente só uma parte do
          nome — o cadastro cresce conforme novos contratos entram.
        </p>
      )}
      <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
        {lista.map((f) => (
          <li key={f.cnpj}>
            <Link
              to="/fornecedores/$cnpj"
              params={{ cnpj: f.cnpj }}
              className="flex items-center justify-between gap-3 p-4 hover:bg-muted"
            >
              <span className="min-w-0 flex items-center gap-2">
                <Building2 className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="font-medium truncate">{f.nome}</span>
              </span>
              <span className="font-mono text-xs text-muted-foreground shrink-0">{f.cnpj}</span>
            </Link>
          </li>
        ))}
      </ul>

      <ControlePaginacao
        pagina={pagina}
        itens={itens}
        total={total}
        to="/fornecedores"
        montarSearch={montarSearch}
      />
    </div>
  );
}
