import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { listarContratos } from "@/lib/data/real/queries.functions";
import { listarContratosPNCP } from "@/lib/data/pncp/queries.functions";
import { ORGAOS_ENRIQUECIMENTO } from "@/lib/data/catalog";
import { useData } from "@/lib/data-store";
import { PainelExplicar } from "@/components/PainelExplicar";
import { SeletorFonte } from "@/components/SeletorFonte";
import { BarraDeFiltros } from "@/components/BarraDeFiltros";
import { BotaoBaixarCsv } from "@/components/BotaoBaixarCsv";
import { BotaoSalvarBusca } from "@/components/BotaoSalvarBusca";
import { ControlePaginacao } from "@/components/ControlePaginacao";
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
import { FileText, ExternalLink } from "lucide-react";

type Fonte = "cgu" | "pncp";
type Esfera = "federal" | "estadual" | "municipal" | "distrital";
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
  { valor: "data-asc", label: "Mais antigos" },
  { valor: "valor-desc", label: "Maior valor" },
  { valor: "valor-asc", label: "Menor valor" },
];
const ORDEM_PADRAO = "data-desc";

// Filtros e paginação na URL: compartilhável, "salvar esta busca" e página
// estável no tempo (corte `ate` — ver src/lib/listagem/logic.ts). Os params
// pagina/itens/ordem/ate são compartilhados pelas duas fontes; trocar de
// fonte zera página e corte.
type ContratosSearch = SearchListagem & {
  fonte?: Fonte;
  // CGU (Executivo Federal)
  orgao?: string;
  fornecedor?: string;
  ano?: number;
  modalidade?: string;
  valorMin?: number;
  q?: string;
  // PNCP (todos os entes)
  uf?: string;
  esfera?: Esfera;
};

export const Route = createFileRoute("/contratos/")({
  validateSearch: (s: Record<string, unknown>): ContratosSearch => ({
    ...parseSearchListagem(s, { ordens: ORDENS, ordemPadrao: ORDEM_PADRAO }),
    fonte: s.fonte === "pncp" ? "pncp" : undefined,
    orgao: typeof s.orgao === "string" && s.orgao ? s.orgao : undefined,
    fornecedor: typeof s.fornecedor === "string" && s.fornecedor ? s.fornecedor : undefined,
    ano: Number(s.ano) || undefined,
    modalidade: typeof s.modalidade === "string" && s.modalidade ? s.modalidade : undefined,
    valorMin: Number(s.valorMin) || undefined,
    q: typeof s.q === "string" && s.q ? s.q : undefined,
    uf: typeof s.uf === "string" && s.uf ? s.uf : undefined,
    esfera:
      s.esfera === "federal" ||
      s.esfera === "estadual" ||
      s.esfera === "municipal" ||
      s.esfera === "distrital"
        ? s.esfera
        : undefined,
  }),
  component: ContratosPage,
  head: () => ({
    meta: [
      { title: "Contratos — Mutirão de Dados" },
      {
        name: "description",
        content:
          "Contratos públicos do Executivo Federal (Portal CGU) e de todos os entes (PNCP, Lei 14.133).",
      },
    ],
  }),
});

function ContratosPage() {
  const { fonte: fonteSearch } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const fonte: Fonte = fonteSearch ?? "cgu";
  // Trocar de fonte zera página e corte — cada acervo tem a sua paginação.
  const setFonte = (f: Fonte) =>
    navigate({
      search: (prev: ContratosSearch) => ({
        ...prev,
        fonte: f === "pncp" ? "pncp" : undefined,
        pagina: undefined,
        ate: undefined,
      }),
      replace: true,
    });

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 space-y-6">
      <header>
        <div className="text-xs text-muted-foreground uppercase tracking-wider">A compra</div>
        <h1 className="font-display text-4xl mt-1">Contratos</h1>
        <p className="text-muted-foreground mt-3 max-w-3xl leading-relaxed">
          O acordo formal entre o governo e a empresa contratada. Este mesmo tipo de dado vem de
          <strong> duas fontes</strong>: o Portal da Transparência (CGU, só Executivo Federal, com
          fornecedor e vigência) e o PNCP (Lei 14.133, todos os entes — União, estados e
          municípios).
        </p>
        {/* Contrato de repasse leva "contrato" no nome e NÃO está aqui —
            é transferência voluntária. Ver o aviso recíproco em /convenios. */}
        <p className="text-sm text-muted-foreground mt-2 max-w-3xl leading-relaxed">
          Procurando <strong>contrato de repasse</strong>? Ele não está aqui: apesar do nome, é uma
          transferência voluntária da União a um ente, operada por instituição mandatária. Fica em{" "}
          <Link to="/convenios" className="text-accent underline">
            Convênios
          </Link>
          .
        </p>
      </header>

      {/* O "tipo" Contratos coincide em duas fontes — ver SeletorFonte. */}
      <SeletorFonte
        opcoes={[
          { id: "cgu", recorte: "Executivo Federal", fonte: "Portal CGU" },
          { id: "pncp", recorte: "Todos os entes", fonte: "PNCP" },
        ]}
        valor={fonte}
        onChange={setFonte}
      />

      <PainelExplicar titulo="De onde vêm estes dados? Qual a diferença entre as duas fontes?">
        <p>
          <strong className="text-foreground">
            Aqui as duas fontes são sistemas distintos de verdade
          </strong>{" "}
          — diferente de{" "}
          <Link to="/convenios" className="text-accent underline">
            Convênios
          </Link>
          , onde as abas são dois ângulos do mesmo acervo.
        </p>
        <p>
          <strong className="text-foreground">Portal da Transparência (CGU)</strong> — espelho dos
          sistemas administrativos internos do governo federal. Cobre apenas contratos de órgãos do{" "}
          <strong>Executivo Federal</strong>, mas com histórico longo e campos de fornecedor e
          vigência.
        </p>
        <p>
          <strong className="text-foreground">PNCP</strong> — o local onde a Lei 14.133/2021 obriga
          cada órgão a publicar suas contratações. Não é espelho: é publicação primária, e cobre{" "}
          <strong>todos os entes</strong> — União, estados e municípios. Um contrato da sua
          prefeitura só existe aqui.
        </p>
        <p>
          Os conjuntos se sobrepõem em parte: contratos federais recentes, regidos pela lei nova,
          podem aparecer nos dois — com campos diferentes, porque cada sistema registra o que lhe
          cabe. Um contrato federal antigo existe só na CGU.
        </p>
      </PainelExplicar>

      {fonte === "cgu" ? <ContratosCGU /> : <ContratosPNCP />}
    </div>
  );
}

// ---------- Fonte CGU (Executivo Federal) ----------
function ContratosCGU() {
  const buscar = useServerFn(listarContratos);
  const { dataset } = useData();
  // Órgãos do filtro = os que têm contratos em cache ("com dados"), com sigla do
  // overlay quando conhecida. Dinâmico: cresce conforme se importa, sem lista fixa.
  const orgaosFiltro = useMemo(() => {
    const byId = new Map(dataset.orgaos.map((o) => [o.cod, o]));
    const cods = new Set(dataset.contratos.map((c) => c.orgaoCod));
    return [...cods]
      .map((cod) => ({
        cod,
        sigla: ORGAOS_ENRIQUECIMENTO[cod]?.sigla || byId.get(cod)?.sigla || cod,
        nome: byId.get(cod)?.nome || `Órgão ${cod}`,
      }))
      .sort((a, b) => a.sigla.localeCompare(b.sigla, "pt-BR"));
  }, [dataset.contratos, dataset.orgaos]);
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const orgaoCod = search.orgao ?? "";
  const fornecedor = search.fornecedor ?? "";
  const ano = search.ano ?? 0;
  const modalidade = search.modalidade ?? "";
  const valorMin = search.valorMin ?? 0;
  const q = search.q ?? "";
  const pagina = search.pagina ?? 1;
  const itens = search.itens ?? ITENS_PADRAO;
  const ordem = search.ordem ?? ORDEM_PADRAO;

  // Mudar filtro/ordenação/itens volta para a página 1.
  const setFiltro = (patch: Partial<ContratosSearch>) =>
    navigate({
      search: (prev: ContratosSearch) => ({ ...prev, ...patch, pagina: undefined }),
      replace: true,
    });

  const { data, isLoading } = useQuery({
    queryKey: [
      "contratos-cgu",
      orgaoCod,
      fornecedor,
      ano,
      modalidade,
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
          orgaoCod: orgaoCod || undefined,
          fornecedor: fornecedor || undefined,
          ano: ano || undefined,
          modalidade: modalidade || undefined,
          valorMin: valorMin || undefined,
          ordem: ordem as "data-desc",
          ate: search.ate,
          q: q || undefined,
          limit: itens,
          offset: offsetDaPagina(pagina, itens),
        },
      }),
  });
  const lista = data?.contratos ?? [];
  const total = data?.total ?? 0;
  // Fixa o corte nos links de página: a mesma URL mostra sempre os mesmos registros.
  const corte = search.ate ?? data?.corteSugerido;
  const montarSearch = (p: number): Record<string, unknown> => ({
    ...search,
    pagina: p > 1 ? p : undefined,
    ate: corte,
  });

  return (
    <div className="space-y-6">
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
                path="/contratos"
                search={search}
                titulo="Contratos · Portal CGU"
                filtros={[
                  ["órgão", orgaoCod],
                  ["fornecedor", fornecedor],
                  ["ano", ano || ""],
                  ["modalidade", modalidade],
                  ["valor mín.", valorMin ? fmtBRL(valorMin) : ""],
                  ["busca", q],
                ]}
              />
              {lista.length > 0 && (
                <BotaoBaixarCsv
                  filename={`contratos_cgu_${orgaoCod || "todos"}`}
                  obterLinhas={() => lista}
                  rotulo={`Exportar CSV (${lista.length})`}
                />
              )}
            </div>
          </>
        }
      >
        <select
          value={orgaoCod}
          onChange={(e) => setFiltro({ orgao: e.target.value || undefined })}
          className="rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="">Todos os órgãos</option>
          {orgaosFiltro.map((o) => (
            <option key={o.cod} value={o.cod} title={o.nome}>
              {o.sigla}
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
          placeholder="Objeto, número…"
          className="rounded-md border bg-background px-3 py-2 text-sm sm:col-span-2"
        />
      </BarraDeFiltros>

      {fornecedor && (
        <p className="text-xs text-muted-foreground -mt-2">
          Filtrando pelo fornecedor <span className="font-mono">{fornecedor}</span> ·{" "}
          <button
            type="button"
            onClick={() => setFiltro({ fornecedor: undefined })}
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
          to="/contratos"
          montarSearch={montarSearch}
        />

        {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {!isLoading && lista.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhum contrato no acervo para os filtros selecionados.
          </p>
        )}
        <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
          {lista.map((c) => (
            <li key={c.id} className="p-4 space-y-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <FileText className="size-4 text-muted-foreground" />
                    <Link to="/contratos/$id" params={{ id: c.id }} className="hover:underline">
                      Contrato {c.numero ?? c.id}
                    </Link>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {c.fornecedor_nome ?? c.fornecedor_cnpj}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {[c.orgao_cod, c.modalidade].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-medium">{fmtBRL(c.valor)}</div>
                  <div className="text-xs text-muted-foreground">{c.data_assinatura ?? "—"}</div>
                </div>
              </div>
              {c.objeto && <p className="text-sm text-muted-foreground line-clamp-2">{c.objeto}</p>}
            </li>
          ))}
        </ul>

        <ControlePaginacao
          pagina={pagina}
          itens={itens}
          total={total}
          to="/contratos"
          montarSearch={montarSearch}
        />
      </section>
    </div>
  );
}

// ---------- Fonte PNCP (todos os entes) ----------
function ContratosPNCP() {
  const buscar = useServerFn(listarContratosPNCP);
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const uf = search.uf ?? "";
  const esfera = search.esfera ?? "";
  const q = search.q ?? "";
  const pagina = search.pagina ?? 1;
  const itens = search.itens ?? ITENS_PADRAO;
  const ordem = search.ordem ?? ORDEM_PADRAO;

  // Mudar filtro/ordenação/itens volta para a página 1.
  const setFiltro = (patch: Partial<ContratosSearch>) =>
    navigate({
      search: (prev: ContratosSearch) => ({ ...prev, ...patch, pagina: undefined }),
      replace: true,
    });

  const fornecedor = search.fornecedor ?? "";
  const { data, isLoading } = useQuery({
    queryKey: ["contratos-pncp", uf, esfera, q, fornecedor, ordem, pagina, itens, search.ate],
    placeholderData: keepPreviousData,
    queryFn: () =>
      buscar({
        data: {
          uf: uf || undefined,
          esfera: esfera || undefined,
          q: q || undefined,
          fornecedor: fornecedor || undefined,
          ordem: ordem as "data-desc",
          ate: search.ate,
          limit: itens,
          offset: offsetDaPagina(pagina, itens),
        },
      }),
  });
  const lista = data?.contratos ?? [];
  const total = data?.total ?? 0;
  // Fixa o corte nos links de página: a mesma URL mostra sempre os mesmos registros.
  const corte = search.ate ?? data?.corteSugerido;
  const montarSearch = (p: number): Record<string, unknown> => ({
    ...search,
    pagina: p > 1 ? p : undefined,
    ate: corte,
  });

  return (
    <div className="space-y-6">
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
                path="/contratos"
                search={search}
                titulo="Contratos · PNCP"
                filtros={[
                  ["UF", uf],
                  ["esfera", esfera],
                  ["busca", q],
                ]}
              />
              {lista.length > 0 && (
                <BotaoBaixarCsv
                  filename={`contratos_pncp_${uf || "todos"}`}
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
          value={esfera}
          onChange={(e) =>
            setFiltro({ esfera: (e.target.value || undefined) as Esfera | undefined })
          }
          className="rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="">Todas as esferas</option>
          <option value="federal">Federal</option>
          <option value="estadual">Estadual</option>
          <option value="municipal">Municipal</option>
          <option value="distrital">Distrital</option>
        </select>
        <input
          value={q}
          onChange={(e) => setFiltro({ q: e.target.value || undefined })}
          placeholder="Buscar no objeto…"
          className="rounded-md border bg-background px-3 py-2 text-sm sm:col-span-1 lg:col-span-4"
        />
      </BarraDeFiltros>

      <section className="space-y-3">
        <ControlePaginacao
          pagina={pagina}
          itens={itens}
          total={total}
          to="/contratos"
          montarSearch={montarSearch}
        />

        {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {!isLoading && lista.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhum contrato do PNCP no acervo para os filtros selecionados.
          </p>
        )}
        <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
          {lista.map((c) => (
            <li key={c.id} className="p-4 space-y-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <FileText className="size-4 text-muted-foreground" />
                    <Link to="/contratos/$id" params={{ id: c.id }} className="hover:underline">
                      {c.orgao_nome}
                    </Link>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {[c.uf, c.municipio_nome, c.esfera].filter(Boolean).join(" · ")}
                  </div>
                  {c.fornecedor_nome && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Fornecedor: {c.fornecedor_nome}
                    </div>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <div className="font-medium">{fmtBRL(c.valor_global)}</div>
                  <div className="text-xs text-muted-foreground">{c.data_assinatura ?? "—"}</div>
                </div>
              </div>
              {c.objeto && <p className="text-sm text-muted-foreground line-clamp-2">{c.objeto}</p>}
              {c.url_pncp && (
                <a
                  href={c.url_pncp}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-accent underline inline-flex items-center gap-1"
                >
                  Ver no PNCP <ExternalLink className="size-3" />
                </a>
              )}
            </li>
          ))}
        </ul>

        <ControlePaginacao
          pagina={pagina}
          itens={itens}
          total={total}
          to="/contratos"
          montarSearch={montarSearch}
        />
      </section>
    </div>
  );
}
