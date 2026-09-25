import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listarConveniosCgu } from "@/lib/data/real/queries.functions";
import { linksDoConvenio } from "@/lib/links-oficiais";
import { PainelExplicar } from "@/components/PainelExplicar";
import { listarTransferencias } from "@/lib/data/transferegov/queries.functions";
import { BarraDeFiltros } from "@/components/BarraDeFiltros";
import { BotaoBaixarCsv } from "@/components/BotaoBaixarCsv";
import { BotaoSalvarBusca } from "@/components/BotaoSalvarBusca";
import { ControlePaginacao } from "@/components/ControlePaginacao";
import { SeletorFonte } from "@/components/SeletorFonte";
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
import { ExternalLink, FileSignature } from "lucide-react";

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
const ORDENS: OpcaoOrdem[] = [
  { valor: "data-desc", label: "Mais recentes" },
  { valor: "data-asc", label: "Mais antigos" },
  { valor: "valor-desc", label: "Maior valor" },
  { valor: "valor-asc", label: "Menor valor" },
];
const ORDEM_PADRAO = "data-desc";

// Filtros e paginação na URL: compartilhável, "salvar esta busca" e página
// estável no tempo (corte `ate` — ver src/lib/listagem/logic.ts). Os params
// pagina/itens/ordem/ate são compartilhados pelas duas abas; trocar de aba
// zera página e corte.
type FonteConvenio = "cgu" | "transferegov";

type ConveniosSearch = SearchListagem & {
  fonte?: FonteConvenio;
  uf?: string;
  ano?: number;
  situacao?: string;
  convenente?: string;
  valorMin?: number;
  q?: string;
};

export const Route = createFileRoute("/convenios/")({
  validateSearch: (s: Record<string, unknown>): ConveniosSearch => ({
    ...parseSearchListagem(s, { ordens: ORDENS, ordemPadrao: ORDEM_PADRAO }),
    // CGU é o default: `fonte` só aparece na URL quando é a outra origem.
    fonte: s.fonte === "transferegov" ? "transferegov" : undefined,
    uf: typeof s.uf === "string" && s.uf ? s.uf : undefined,
    ano: Number(s.ano) || undefined,
    situacao: typeof s.situacao === "string" && s.situacao ? s.situacao : undefined,
    convenente: typeof s.convenente === "string" && s.convenente ? s.convenente : undefined,
    valorMin: Number(s.valorMin) || undefined,
    q: typeof s.q === "string" && s.q ? s.q : undefined,
  }),
  component: ConveniosPage,
  head: () => ({
    meta: [
      { title: "Convênios e contratos de repasse — Mutirão de Dados" },
      {
        name: "description",
        content:
          "Convênios e contratos de repasse da União com estados e municípios, com dados do Portal da Transparência (CGU).",
      },
    ],
  }),
});

function ConveniosPage() {
  const { fonte: fonteSearch } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const fonte: FonteConvenio = fonteSearch ?? "cgu";
  // Trocar de aba zera página e corte — cada ângulo tem a sua paginação.
  const setFonte = (f: FonteConvenio) =>
    navigate({
      search: (prev: ConveniosSearch) => ({
        ...prev,
        fonte: f === "transferegov" ? "transferegov" : undefined,
        pagina: undefined,
        ate: undefined,
      }),
      replace: true,
    });

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 space-y-6">
      <header>
        <div className="text-xs text-muted-foreground uppercase tracking-wider">
          União → Estados/Municípios
        </div>
        <h1 className="font-display text-4xl mt-1">Convênios e contratos de repasse</h1>
        <p className="text-muted-foreground mt-3 max-w-3xl leading-relaxed">
          Instrumentos de cooperação — exigem plano de trabalho, contrapartida e prestação de
          contas, com aplicação vinculada ao objeto pactuado. Todo convênio tem duas pontas: um
          órgão federal que concede e um ente que recebe. As duas abas abaixo mostram{" "}
          <strong>os mesmos registros</strong> — o que muda é o ângulo de leitura.
        </p>
      </header>

      <SeletorFonte
        opcoes={[
          { id: "cgu", recorte: "Execução federal", fonte: "Portal CGU" },
          { id: "transferegov", recorte: "Por ente beneficiário", fonte: "Portal CGU" },
        ]}
        valor={fonte}
        onChange={setFonte}
      />

      <PainelExplicar titulo="De onde vêm estes dados? Por que duas abas se a fonte é uma só?">
        <p>
          <strong className="text-foreground">Quem opera é o Transferegov.</strong> É o sistema
          (ex-SICONV) onde o ente propõe o projeto, assina, executa e presta contas — o balcão das
          transferências voluntárias entre a União e estados/municípios.
        </p>
        <p>
          <strong className="text-foreground">
            Quem publica é o Portal da Transparência (CGU).
          </strong>{" "}
          Ele espelha o que o Transferegov registra, e é dele que vêm os dados desta página: o
          módulo do Transferegov onde os convênios vivem ainda não oferece acesso aberto (previsto
          para 2027). Por isso as duas abas indicam "Portal CGU" como procedência.
        </p>
        <p>
          <strong className="text-foreground">As abas são ângulos, não acervos.</strong> Cada
          registro traz as duas pontas juntas — concedente federal e ente convenente. A aba
          "execução federal" organiza por quem paga; a "por ente", por quem recebe. E cada convênio
          linka a ficha nos <strong>dois</strong> portais oficiais, quando há código SICONV.
        </p>
        <p>
          Contraste com{" "}
          <a href="/contratos" className="text-accent underline">
            Contratos
          </a>
          , onde o seletor distingue fontes de verdade: Portal CGU e PNCP são sistemas distintos,
          com coberturas diferentes.
        </p>
      </PainelExplicar>

      {fonte === "cgu" ? <ConveniosCGU /> : <ConveniosTransferegov />}
    </div>
  );
}

/**
 * Os endereços oficiais do convênio, iguais nas duas abas.
 *
 * São o mesmo instrumento visto por ângulos diferentes, então esconder um
 * portal de um lado era arbitrário — e foi assim por acidente, porque cada
 * lista montava o seu link à mão.
 */
function LinksOficiais({
  id,
  numero,
  codigoSiconv,
}: {
  id?: string | null;
  numero?: string | null;
  codigoSiconv?: string | null;
}) {
  const links = linksDoConvenio({ id, numero, codigoSiconv });
  if (links.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1">
      {links.map((l) => (
        <a
          key={l.portal}
          href={l.url}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-accent underline inline-flex items-center gap-1"
        >
          Ver no {l.portal} <ExternalLink className="size-3" />
        </a>
      ))}
    </div>
  );
}

function ConveniosCGU() {
  const buscar = useServerFn(listarConveniosCgu);
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const uf = search.uf ?? "";
  const ano = search.ano ?? 0;
  const situacao = search.situacao ?? "";
  const convenente = search.convenente ?? "";
  const valorMin = search.valorMin ?? 0;
  const q = search.q ?? "";
  const pagina = search.pagina ?? 1;
  const itens = search.itens ?? ITENS_PADRAO;
  const ordem = search.ordem ?? ORDEM_PADRAO;

  // Mudar filtro/ordenação/itens volta para a página 1.
  const setFiltro = (patch: Partial<ConveniosSearch>) =>
    navigate({
      search: (prev: ConveniosSearch) => ({ ...prev, ...patch, pagina: undefined }),
      replace: true,
    });

  const { data, isLoading } = useQuery({
    queryKey: [
      "convenios-cgu",
      uf,
      ano,
      situacao,
      convenente,
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
          situacao: situacao || undefined,
          convenente: convenente || undefined,
          valorMin: valorMin || undefined,
          ordem: ordem as "data-desc",
          ate: search.ate,
          q: q || undefined,
          limit: itens,
          offset: offsetDaPagina(pagina, itens),
        },
      }),
  });
  const lista = data?.convenios ?? [];
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
                path="/convenios"
                search={search}
                titulo="Convênios"
                filtros={[
                  ["UF", uf],
                  ["ano", ano],
                  ["situação", situacao],
                  ["convenente", convenente],
                  ["valor mín.", valorMin],
                  ["busca", q],
                ]}
              />
              {lista.length > 0 && (
                <BotaoBaixarCsv
                  filename={`convenios_${uf || "todos"}`}
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
          value={situacao}
          onChange={(e) => setFiltro({ situacao: e.target.value || undefined })}
          placeholder="Situação"
          className="rounded-md border bg-background px-3 py-2 text-sm"
        />
        <input
          value={convenente}
          onChange={(e) => setFiltro({ convenente: e.target.value || undefined })}
          placeholder="Convenente (nome ou CNPJ)"
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
          placeholder="Objeto, convenente, órgão, nº…"
          className="rounded-md border bg-background px-3 py-2 text-sm"
        />
      </BarraDeFiltros>

      <section className="space-y-3">
        <ControlePaginacao
          pagina={pagina}
          itens={itens}
          total={total}
          to="/convenios"
          montarSearch={montarSearch}
        />

        {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {!isLoading && lista.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhum convênio no acervo para os filtros selecionados.
          </p>
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
              <LinksOficiais id={c.id} numero={c.numero} codigoSiconv={c.codigo_siconv} />
            </li>
          ))}
        </ul>

        <ControlePaginacao
          pagina={pagina}
          itens={itens}
          total={total}
          to="/convenios"
          montarSearch={montarSearch}
        />
      </section>
    </div>
  );
}

/**
 * Convênios pelo ângulo do **ente beneficiário**.
 *
 * Mesma origem do bloco da CGU — os dois ingests chamam o endpoint
 * `/convenios` do Portal da Transparência, porque o Transferegov ainda não
 * publica API aberta destes instrumentos (o módulo Discricionárias e Legais
 * está previsto para 2027). O que muda é a chave e as colunas: aqui a leitura
 * é quem recebe (UF, município, valor de repasse, concedente, assinatura);
 * lá é a execução federal (órgão, situação, tipo de instrumento, liberado).
 */
function ConveniosTransferegov() {
  const buscar = useServerFn(listarTransferencias);
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const uf = search.uf ?? "";
  const ano = search.ano ?? 0;
  const valorMin = search.valorMin ?? 0;
  const q = search.q ?? "";
  const pagina = search.pagina ?? 1;
  const itens = search.itens ?? ITENS_PADRAO;
  const ordem = search.ordem ?? ORDEM_PADRAO;

  // Mudar filtro/ordenação/itens volta para a página 1.
  const setFiltro = (patch: Partial<ConveniosSearch>) =>
    navigate({
      search: (prev: ConveniosSearch) => ({ ...prev, ...patch, pagina: undefined }),
      replace: true,
    });

  const { data, isLoading } = useQuery({
    queryKey: ["convenios-transferegov", uf, ano, valorMin, ordem, q, pagina, itens, search.ate],
    placeholderData: keepPreviousData,
    queryFn: () =>
      buscar({
        data: {
          uf: uf || undefined,
          ano: ano || undefined,
          valorMin: valorMin || undefined,
          ordem: ordem as "data-desc",
          ate: search.ate,
          q: q || undefined,
          limit: itens,
          offset: offsetDaPagina(pagina, itens),
        },
      }),
  });
  const lista = data?.transferencias ?? [];
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
                path="/convenios"
                search={search}
                titulo="Convênios (Transferegov)"
                filtros={[
                  ["UF", uf],
                  ["ano", ano],
                  ["valor mín.", valorMin],
                  ["busca", q],
                ]}
              />
              {lista.length > 0 && (
                <BotaoBaixarCsv
                  filename={`convenios_transferegov_${uf || "todos"}`}
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
              {a === 0 ? "Todos os anos" : a}
            </option>
          ))}
        </select>
        <select
          value={valorMin}
          onChange={(e) => setFiltro({ valorMin: Number(e.target.value) || undefined })}
          className="rounded-md border bg-background px-3 py-2 text-sm"
        >
          {VALORES_MIN.map((v) => (
            <option key={v.v} value={v.v}>
              {v.label}
            </option>
          ))}
        </select>
        <input
          value={q}
          onChange={(e) => setFiltro({ q: e.target.value || undefined })}
          placeholder="Buscar no objeto ou beneficiário…"
          className="rounded-md border bg-background px-3 py-2 text-sm sm:col-span-2 lg:col-span-3"
        />
      </BarraDeFiltros>

      <section className="space-y-3">
        <ControlePaginacao
          pagina={pagina}
          itens={itens}
          total={total}
          to="/convenios"
          montarSearch={montarSearch}
        />

        {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {!isLoading && lista.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhum convênio no acervo para os filtros selecionados.
          </p>
        )}
        <ul className="space-y-3">
          {lista.map((c) => (
            <li key={c.id} className="rounded-xl border border-border bg-card p-4 space-y-1.5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium inline-flex items-center gap-2">
                  <FileSignature className="size-4 text-muted-foreground" />
                  <Link to="/convenios/$id" params={{ id: c.id }} className="hover:underline">
                    {c.numero ?? c.id}
                  </Link>
                </span>
                <span className="text-sm tabular-nums">
                  {fmtBRL(c.valor)}
                  <span className="text-muted-foreground">
                    {" "}
                    · repasse {fmtBRL(c.valor_liberado)}
                  </span>
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                {c.convenente_nome ?? "Beneficiário não informado"}
                {c.municipio_nome ? ` · ${c.municipio_nome}` : ""}
                {c.uf ? `/${c.uf}` : ""}
                {c.data_assinatura ? ` · assinado em ${c.data_assinatura}` : ""}
              </div>
              {c.orgao_nome && (
                <div className="text-xs text-muted-foreground">Concedente: {c.orgao_nome}</div>
              )}
              {c.objeto && <p className="text-sm text-muted-foreground line-clamp-2">{c.objeto}</p>}
              <LinksOficiais id={c.id} numero={c.numero} codigoSiconv={c.codigo_siconv} />
            </li>
          ))}
        </ul>

        <ControlePaginacao
          pagina={pagina}
          itens={itens}
          total={total}
          to="/convenios"
          montarSearch={montarSearch}
        />
      </section>
    </div>
  );
}
