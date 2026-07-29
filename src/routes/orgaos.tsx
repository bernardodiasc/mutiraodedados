import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import * as React from "react";
import { ORGAOS_ENRIQUECIMENTO, ORGAOS_OUTRAS_ESFERAS, PODER_LABEL } from "@/lib/data/catalog";
import type { Orgao } from "@/lib/data/types";
import { useData } from "@/lib/data-store";
import { statusFontes, orgaosComDados, type StatusFonte } from "@/lib/data/status.functions";
import heroOrgaos from "@/assets/ac-orgaos.png";

export const Route = createFileRoute("/orgaos")({
  component: OrgaosList,
  head: () => ({
    meta: [
      { title: "Órgãos federais — Mutirão de Dados" },
      { name: "description", content: "Órgãos federais com contratos, licitações e convênios públicos, totais contratados e histórico de gastos. Inclui órgãos extintos, com histórico preservado." },
      { property: "og:title", content: "Órgãos federais — Mutirão de Dados" },
      { property: "og:description", content: "Órgãos federais com contratos, licitações e convênios públicos, totais contratados e histórico de gastos." },
      { property: "og:url", content: "https://mutiraodedados.com.br/orgaos" },
    ],
    links: [{ rel: "canonical", href: "https://mutiraodedados.com.br/orgaos" }],
  }),
});

/** Órgão do Executivo montado dinamicamente: dados (código) + catálogo (nome/ativo) + overlay (sigla/funcao). */
type OrgaoExecutivo = {
  cod: string;
  nome: string;
  sigla: string;
  funcao: string;
  ativo: boolean;
  naoCatalogado: boolean;
};

function OrgaosList() {
  const fetchStatus = useServerFn(statusFontes);
  const fetchComDados = useServerFn(orgaosComDados);
  const { dataset } = useData();
  const [busca, setBusca] = React.useState("");

  const { data: status } = useQuery({
    queryKey: ["orgaos", "status-fontes"],
    queryFn: () => fetchStatus(),
    staleTime: 5 * 60 * 1000,
  });
  const { data: codigos } = useQuery({
    queryKey: ["orgaos", "com-dados"],
    queryFn: () => fetchComDados(),
    staleTime: 5 * 60 * 1000,
  });

  const executivos: OrgaoExecutivo[] = React.useMemo(() => {
    const orgById = new Map(dataset.orgaos.map((o) => [o.cod, o]));
    return (codigos ?? [])
      .map((cod) => {
        const o = orgById.get(cod);
        const enr = ORGAOS_ENRIQUECIMENTO[cod];
        return {
          cod,
          nome: o?.nome ?? `Órgão ${cod}`,
          sigla: enr?.sigla ?? o?.sigla ?? "",
          funcao: enr?.funcao ?? o?.funcao ?? "",
          ativo: o?.ativo ?? true,
          naoCatalogado: !o,
        };
      })
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [codigos, dataset.orgaos]);

  const termo = busca.trim().toLowerCase();
  const casa = (nome: string, sigla: string) =>
    !termo || nome.toLowerCase().includes(termo) || sigla.toLowerCase().includes(termo);

  const executivosFiltrados = executivos.filter((o) => casa(o.nome, o.sigla));
  const outrasFiltradas = ORGAOS_OUTRAS_ESFERAS.filter((o) => casa(o.nome, o.sigla));

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div className="order-2 md:order-1 max-w-2xl">
          <h1 className="font-display text-4xl">Órgãos federais</h1>
          <p className="text-muted-foreground mt-2">
            Cada página reúne contratos, licitações e convênios públicos, fornecedores e série histórica de gastos. A lista do Executivo é montada a partir dos documentos já importados e cresce conforme novos órgãos entram na base. Órgãos extintos permanecem com o histórico preservado.
          </p>
        </div>
        <img
          src={heroOrgaos}
          alt="Ilustração de prédios do Congresso Nacional com elementos de auditoria"
          className="order-1 md:order-2 w-full md:w-[420px] lg:w-[480px] h-auto object-contain"
        />
      </div>

      <div className="mt-8">
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome ou sigla…"
          className="w-full sm:max-w-md border border-border rounded-lg bg-card px-3 py-2 text-sm focus:outline-none focus:border-accent"
        />
      </div>

      <section className="mt-8">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-display text-2xl">{PODER_LABEL.executivo}</h2>
          <span className="text-xs text-muted-foreground">
            {executivosFiltrados.length} {executivosFiltrados.length === 1 ? "órgão" : "órgãos"} com dados
          </span>
        </div>
        {executivosFiltrados.length === 0 ? (
          <p className="text-sm text-muted-foreground mt-4">
            {codigos === undefined
              ? "Carregando…"
              : termo
                ? "Nenhum órgão do Executivo corresponde à busca."
                : "Nenhum órgão com dados importados ainda."}
          </p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {executivosFiltrados.map((o) => {
              const st = status ? status.contratosPorOrgao[o.cod] ?? { updatedAt: null, count: 0 } : null;
              const badge = renderBadge(st);
              return (
                <Link
                  key={o.cod}
                  to="/orgaos/$cod"
                  params={{ cod: o.cod }}
                  className="border border-border rounded-xl p-5 bg-card hover:border-accent transition-colors block"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs text-muted-foreground truncate">{o.funcao || "—"}</div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {!o.ativo && (
                        <span className="text-[10px] font-semibold uppercase tracking-wider rounded px-1.5 py-0.5 border text-amber-600 border-amber-500/40" title="Sem execução orçamentária recente — órgão extinto ou inativo. Histórico preservado.">
                          Extinto
                        </span>
                      )}
                      <span className={`text-[10px] font-semibold uppercase tracking-wider rounded px-1.5 py-0.5 border ${badge.tone}`} title={badge.title}>
                        {badge.label}
                      </span>
                    </div>
                  </div>
                  <div className="font-display text-lg mt-1 leading-tight">{o.nome}</div>
                  <div className="mt-3 flex items-center gap-2">
                    {o.sigla && <span className="text-xs font-mono text-muted-foreground">{o.sigla}</span>}
                    {o.naoCatalogado && (
                      <span className="text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5" title="Órgão presente nos documentos mas ainda não sincronizado no catálogo SIAFI.">
                        Não catalogado
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {outrasFiltradas.length > 0 && (
        <section className="mt-12">
          <h2 className="font-display text-2xl">Outras esferas</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Legislativo, Judiciário e Ministério Público — cobertos por integrações próprias ou planejadas, fora do fluxo de contratos do Executivo.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {outrasFiltradas.map((o) => (
              <CardOutraEsfera key={o.cod} o={o} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function CardOutraEsfera({ o }: { o: Orgao }) {
  const conteudo = (
    <>
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">{PODER_LABEL[o.poder]}</div>
        <span className="text-[10px] font-semibold uppercase tracking-wider rounded px-1.5 py-0.5 border text-accent border-accent/40">
          {o.rotaPropria ? "Conectado" : "Planejado"}
        </span>
      </div>
      <div className="font-display text-lg mt-1 leading-tight">{o.nome}</div>
      <div className="mt-3">
        <span className="text-xs font-mono text-muted-foreground">{o.sigla}</span>
      </div>
    </>
  );
  const cls = "border border-border rounded-xl p-5 bg-card hover:border-accent transition-colors block";
  if (o.rotaPropria) {
    return (
      <Link key={o.cod} to={o.rotaPropria} className={cls}>
        {conteudo}
      </Link>
    );
  }
  return (
    <Link key={o.cod} to="/orgaos/$cod" params={{ cod: o.cod }} className={cls}>
      {conteudo}
    </Link>
  );
}

function renderBadge(st: StatusFonte | null): { label: string; tone: string; title: string } {
  if (st === null) {
    return { label: "—", tone: "text-muted-foreground border-border", title: "Carregando…" };
  }
  if (st.count === 0 || !st.updatedAt) {
    return {
      label: "Sem contratos",
      tone: "text-muted-foreground border-border",
      title: "Nenhum contrato em cache para este órgão (pode ter licitações ou convênios).",
    };
  }
  const rel = formatRelative(st.updatedAt);
  const recente = diasDesde(st.updatedAt) <= 30;
  return {
    label: rel,
    tone: recente ? "text-accent border-accent/40" : "text-muted-foreground border-border",
    title: `${st.count.toLocaleString("pt-BR")} registros · atualizado em ${new Date(st.updatedAt).toLocaleString("pt-BR")}`,
  };
}

function diasDesde(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

function formatRelative(iso: string): string {
  const d = diasDesde(iso);
  if (d <= 0) return "Atualizado hoje";
  if (d === 1) return "Atualizado ontem";
  if (d < 30) return `Atualizado há ${d}d`;
  const m = Math.floor(d / 30);
  if (m < 12) return `Atualizado há ${m} ${m === 1 ? "mês" : "meses"}`;
  const y = Math.floor(d / 365);
  return `Atualizado há ${y} ${y === 1 ? "ano" : "anos"}`;
}
