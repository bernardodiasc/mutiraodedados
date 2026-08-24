import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, ExternalLink } from "lucide-react";
import { listarContratosPNCP } from "@/lib/data/pncp/queries.functions";
import { listarRelatoriosSICONFI } from "@/lib/data/siconfi/queries.functions";
import { listarTransferencias } from "@/lib/data/transferegov/queries.functions";
import { obterEnte } from "@/lib/data/entes.functions";
import { BlocoRastreabilidade } from "@/components/BlocoRastreabilidade";
import { Estatistica } from "@/components/Cartao";
import { PainelExplicar } from "@/components/PainelExplicar";
import { TrilhaDeNavegacao } from "@/components/TrilhaDeNavegacao";
import { fmtBRL } from "@/lib/fmt";
import { downloadCSV } from "@/lib/csv";

type Aba = "contratos" | "fiscal" | "transferencias";

// A página consolida as três fontes que o banco indexa pelo mesmo ente
// (código IBGE): contratações (PNCP), fiscal (SICONFI) e convênios recebidos.
export const Route = createFileRoute("/entes/$codigo")({
  validateSearch: (s: Record<string, unknown>): { aba?: Aba } => ({
    aba: s.aba === "fiscal" || s.aba === "transferencias" ? s.aba : undefined,
  }),
  // Loader mínimo: resolve o nome do ente (1 consulta barata) para o título
  // e o notFound antecipado.
  loader: async ({ params }) => {
    const ente = await obterEnte({ data: { codigo: params.codigo } });
    if (!ente) throw notFound();
    return { ente };
  },
  head: ({ loaderData }) => {
    const nome = loaderData
      ? `${loaderData.ente.nome}${loaderData.ente.tipo === "municipio" ? ` (${loaderData.ente.uf})` : ""}`
      : "Ente";
    return {
      meta: [
        { title: `Dados de ${nome} — Mutirão de Dados` },
        {
          name: "description",
          content: `O que a União contrata, repassa e registra sobre ${nome}: contratações do PNCP, relatórios fiscais do SICONFI e convênios recebidos, no mesmo lugar.`,
        },
      ],
    };
  },
  component: EntePage,
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-4 py-20 text-center">
      <h1 className="font-display text-3xl">Ente não encontrado</h1>
      <p className="text-sm text-muted-foreground mt-2">
        Use a sigla de um estado (ex.: /entes/sp) ou o código IBGE de um município com 7 dígitos
        (ex.: /entes/3550308). Você também pode buscar pelo nome em{" "}
        <Link to="/explorar" className="text-accent underline">
          Por estado ou município
        </Link>
        .
      </p>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-3xl px-4 py-20">
      <h1 className="font-display text-2xl">Erro</h1>
      <p>{error.message}</p>
    </div>
  ),
});

function EntePage() {
  const { ente } = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const aba: Aba = search.aba ?? "contratos";
  const setAba = (a: Aba) =>
    navigate({ search: { aba: a === "contratos" ? undefined : a }, replace: true });

  const uf = ente.tipo === "estado" ? ente.uf! : undefined;
  const ibge = ente.tipo === "municipio" ? ente.codIbge : undefined;
  const rotulo = ente.tipo === "municipio" ? `${ente.nome} (${ente.uf})` : ente.nome;

  const pncpFn = useServerFn(listarContratosPNCP);
  const siconfiFn = useServerFn(listarRelatoriosSICONFI);
  const transfFn = useServerFn(listarTransferencias);

  const pncp = useQuery({
    queryKey: ["ente-pncp", uf, ibge],
    queryFn: () => pncpFn({ data: { uf, municipioIbge: ibge, limit: 100 } }),
  });
  const siconfi = useQuery({
    queryKey: ["ente-siconfi", ente.codIbge],
    // SICONFI usa o próprio código IBGE (2 dígitos p/ estado, 7 p/ município).
    queryFn: () => siconfiFn({ data: { codIbge: ente.codIbge, limit: 100 } }),
  });
  const transf = useQuery({
    queryKey: ["ente-transf", uf, ibge],
    queryFn: () => transfFn({ data: { uf, municipioIbge: ibge, limit: 100 } }),
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 space-y-8">
      <TrilhaDeNavegacao
        itens={[{ label: "Por estado ou município", to: "/explorar" }, { label: rotulo }]}
      />
      <header>
        <div className="text-xs text-muted-foreground uppercase tracking-wider">
          {ente.tipo === "municipio" ? "Município" : "Estado"} · código IBGE {ente.codIbge}
        </div>
        <h1 className="font-display text-4xl mt-1">{rotulo}</h1>
        <p className="text-muted-foreground mt-3 max-w-3xl leading-relaxed">
          O que a União contrata, repassa e registra sobre este ente, reunido de três fontes que se
          conectam pelo código IBGE: contratações (PNCP), relatórios fiscais (SICONFI) e convênios
          recebidos (Portal da Transparência/Transferegov).
        </p>
      </header>

      <PainelExplicar titulo="O que dá para ver de um estado ou município aqui?">
        <p>
          <strong className="text-foreground">Contratações (PNCP)</strong> — o que órgãos{" "}
          <em>deste ente</em> contratam sob a Lei 14.133. É a única fonte nacional que cobre estados
          e municípios contrato a contrato.
        </p>
        <p>
          <strong className="text-foreground">Fiscal (SICONFI)</strong> — o que o ente declara ao
          Tesouro Nacional: receitas, despesas e transferências, na mesma metodologia contábil de
          todos os entes. Bom para comparar.
        </p>
        <p>
          <strong className="text-foreground">Convênios recebidos</strong> — o dinheiro que a União
          repassa a este ente por convênio ou contrato de repasse.
        </p>
        <p>
          As três fontes têm recortes diferentes do mesmo lugar — um valor pode aparecer em uma e
          não nas outras, e isso é informação, não erro.
        </p>
      </PainelExplicar>

      <section className="grid gap-4 sm:grid-cols-3">
        <Estatistica
          rotulo="Contratações no PNCP"
          valor={(pncp.data?.total ?? 0).toLocaleString("pt-BR")}
          detalhe="contratos deste ente no acervo"
        />
        <Estatistica
          rotulo="Linhas fiscais (SICONFI)"
          valor={(siconfi.data?.total ?? 0).toLocaleString("pt-BR")}
          detalhe="declarações no acervo"
        />
        <Estatistica
          rotulo="Convênios recebidos"
          valor={(transf.data?.total ?? 0).toLocaleString("pt-BR")}
          detalhe="instrumentos no acervo"
        />
      </section>

      <div className="flex gap-1 border-b border-border">
        <TabBtn active={aba === "contratos"} onClick={() => setAba("contratos")}>
          Contratações
        </TabBtn>
        <TabBtn active={aba === "fiscal"} onClick={() => setAba("fiscal")}>
          Fiscal (SICONFI)
        </TabBtn>
        <TabBtn active={aba === "transferencias"} onClick={() => setAba("transferencias")}>
          Convênios recebidos
        </TabBtn>
      </div>

      {aba === "contratos" && (
        <section className="space-y-3">
          <BarraAcoes
            verTodos={{
              label: "Ver todas em Contratos (PNCP)",
              to: "/contratos",
              search: { fonte: "pncp", uf: uf ?? undefined },
            }}
            csvDisabled={!pncp.data?.contratos.length}
            onCsv={() => downloadCSV(`pncp_${ente.codIbge}`, pncp.data?.contratos ?? [])}
          />
          {pncp.isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
          {!pncp.isLoading && (pncp.data?.contratos.length ?? 0) === 0 && (
            <p className="text-sm text-muted-foreground">
              Nenhuma contratação do PNCP no acervo para este ente — os dados entram aos poucos.
            </p>
          )}
          <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
            {(pncp.data?.contratos ?? []).map((c) => (
              <li key={c.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      to="/contratos/$id"
                      params={{ id: c.id }}
                      className="text-sm font-medium hover:underline"
                    >
                      {c.orgao_nome}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {[c.uf, c.municipio_nome].filter(Boolean).join(" · ")}
                    </div>
                    {c.objeto && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{c.objeto}</p>
                    )}
                    {c.fornecedor_nome && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Fornecedor: {c.fornecedor_nome}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-medium">{fmtBRL(c.valor_global)}</div>
                    <div className="text-xs text-muted-foreground">{c.data_assinatura ?? "—"}</div>
                    {c.url_pncp && (
                      <a
                        href={c.url_pncp}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-accent underline inline-flex items-center gap-1 mt-1"
                      >
                        PNCP <ExternalLink className="size-3" />
                      </a>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {aba === "fiscal" && (
        <section className="space-y-3">
          <BarraAcoes
            verTodos={{ label: "Ver todos em Relatórios fiscais", to: "/relatorios-fiscais" }}
            csvDisabled={!siconfi.data?.relatorios.length}
            onCsv={() => downloadCSV(`siconfi_${ente.codIbge}`, siconfi.data?.relatorios ?? [])}
          />
          {siconfi.isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
          {!siconfi.isLoading && (siconfi.data?.relatorios.length ?? 0) === 0 && (
            <p className="text-sm text-muted-foreground">
              Nenhuma declaração do SICONFI no acervo para este ente — os dados entram aos poucos.
            </p>
          )}
          <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
            {(siconfi.data?.relatorios ?? []).map((r) => (
              <li key={r.id} className="p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium">{r.ente_nome}</div>
                    <div className="text-xs text-muted-foreground">
                      {[r.tipo_relatorio, r.anexo, r.coluna].filter(Boolean).join(" · ")}
                    </div>
                    {r.conta && <div className="text-xs mt-0.5">{r.conta}</div>}
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
        </section>
      )}

      {aba === "transferencias" && (
        <section className="space-y-3">
          <BarraAcoes
            verTodos={{
              label: "Ver todos em Convênios",
              to: "/convenios",
              search: { fonte: "transferegov" },
            }}
            csvDisabled={!transf.data?.transferencias.length}
            onCsv={() =>
              downloadCSV(`convenios_${ente.codIbge}`, transf.data?.transferencias ?? [])
            }
          />
          {transf.isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
          {!transf.isLoading && (transf.data?.transferencias.length ?? 0) === 0 && (
            <p className="text-sm text-muted-foreground">
              Nenhum convênio no acervo para este ente — os dados entram aos poucos.
            </p>
          )}
          <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
            {(transf.data?.transferencias ?? []).map((t) => (
              <li key={t.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      to="/convenios/$id"
                      params={{ id: t.id }}
                      className="text-sm font-medium hover:underline"
                    >
                      Convênio {t.numero ?? t.id}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {t.orgao_nome ?? "—"} → {t.convenente_nome ?? "—"}
                    </div>
                    {t.objeto && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{t.objeto}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-medium">{fmtBRL(t.valor ?? 0)}</div>
                    <div className="text-xs text-muted-foreground">
                      {t.data_assinatura ?? t.data_inicio_vigencia ?? "—"}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <BlocoRastreabilidade
        fontes={[
          { label: "PNCP", origem: "contratações do ente (Lei 14.133)" },
          { label: "SICONFI (Tesouro Nacional)", origem: "declarações fiscais do ente" },
          {
            label: "Portal da Transparência (CGU)",
            origem: "convênios e contratos de repasse recebidos",
          },
        ]}
        observacao="As três fontes se conectam pelo código IBGE do ente. Cada uma cobre um recorte diferente — a ausência em uma não significa ausência nas demais."
      />
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
        active
          ? "border-accent text-accent"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function BarraAcoes({
  verTodos,
  csvDisabled,
  onCsv,
}: {
  verTodos: { label: string; to: string; search?: Record<string, unknown> };
  csvDisabled: boolean;
  onCsv: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Link
        to={verTodos.to as never}
        search={(verTodos.search ?? {}) as never}
        className="text-xs font-semibold text-accent hover:underline underline-offset-4"
      >
        {verTodos.label} →
      </Link>
      <button
        disabled={csvDisabled}
        onClick={onCsv}
        className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted disabled:opacity-50"
      >
        <Download className="size-3.5" /> Exportar CSV
      </button>
    </div>
  );
}
