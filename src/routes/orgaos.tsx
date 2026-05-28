import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useDataSource } from "@/lib/data-store";
import { ORGAOS_BASE, PODER_LABEL } from "@/lib/data/catalog";
import { EmptyState } from "@/components/EmptyState";
import { fmtBRL } from "@/lib/fmt";
import type { Orgao } from "@/lib/data/types";
import { statusFontes, type StatusFonte } from "@/lib/data/status.functions";
import heroOrgaos from "@/assets/ac-orgaos.png";

export const Route = createFileRoute("/orgaos")({
  component: OrgaosList,
  head: () => ({
    meta: [
      { title: "Órgãos federais — Auditoria Cidadã" },
      { name: "description", content: "Lista dos órgãos federais cobertos pela plataforma, com totais contratados e status de carregamento por fonte." },
      { property: "og:title", content: "Órgãos federais cobertos pela Auditoria Cidadã" },
      { property: "og:description", content: "Navegue ministérios e autarquias por volume contratado e situação de cobertura de dados." },
      { property: "og:url", content: "https://auditoriacidada.ia.br/orgaos" },
    ],
    links: [{ rel: "canonical", href: "https://auditoriacidada.ia.br/orgaos" }],
  }),
});

function OrgaosList() {
  const ds = useDataSource();
  const loaded = new Set(ds.listOrgaos().map(o => o.cod));

  const fetchStatus = useServerFn(statusFontes);
  const { data: status } = useQuery({
    queryKey: ["orgaos", "status-fontes"],
    queryFn: () => fetchStatus(),
    staleTime: 5 * 60 * 1000,
  });

  function statusDe(o: Orgao): StatusFonte | null {
    if (!status) return null;
    if (o.rotaPropria === "/pncp") return status.pncp;
    if (o.rotaPropria === "/siconfi") return status.siconfi;
    if (o.rotaPropria === "/convenios") return status.transferegov;
    if (o.rotaPropria === "/transferencias") return status.transferegov;
    if (o.rotaPropria === "/camara") return status.camara;
    if (o.rotaPropria === "/senado") return status.senado;
    if (o.disponivelPortal) return status.contratosPorOrgao[o.cod] ?? { updatedAt: null, count: 0 };
    return null;
  }

  // Agrupa por poder para deixar claro que o universo federal vai muito
  // além dos ministérios do Executivo.
  const grupos: Array<{ poder: Orgao["poder"]; orgaos: Orgao[] }> = (
    ["executivo", "legislativo", "judiciario", "mpu", "outros"] as const
  )
    .map((p) => ({ poder: p, orgaos: ORGAOS_BASE.filter((o) => o.poder === p) }))
    .filter((g) => g.orgaos.length > 0);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div className="order-2 md:order-1 max-w-2xl">
          <h1 className="font-display text-4xl">Órgãos federais</h1>
          <p className="text-muted-foreground mt-2">
            {ORGAOS_BASE.length} órgãos catalogados — Executivo, Legislativo, Judiciário e MPU. Por ora apenas o Executivo é coberto pela API de contratos do Portal da Transparência; os demais terão integrações próprias.
          </p>
        </div>
        <img
          src={heroOrgaos}
          alt="Ilustração de prédios do Congresso Nacional com elementos de auditoria"
          className="order-1 md:order-2 w-full md:w-[420px] lg:w-[480px] h-auto object-contain"
        />
      </div>

      <div className="mt-10 space-y-10">
        {grupos.map((g) => (
          <section key={g.poder}>
            <h2 className="font-display text-2xl">{PODER_LABEL[g.poder]}</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {g.orgaos.map((o) => {
                const total = loaded.has(o.cod)
                  ? ds.serieAnualOrgao(o.cod).reduce((s, x) => s + x.valor, 0)
                  : null;
                const linkProps = o.rotaPropria
                  ? { to: o.rotaPropria }
                  : { to: "/orgaos/$cod", params: { cod: o.cod } };
                const st = statusDe(o);
                const badge = renderBadge(st, o);
                return (
                  <Link
                    key={o.cod}
                    {...(linkProps as any)}
                    className="border border-border rounded-xl p-5 bg-card hover:border-accent transition-colors block"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs text-muted-foreground">{o.funcao}</div>
                      <span
                        className={`text-[10px] font-semibold uppercase tracking-wider rounded px-1.5 py-0.5 border ${badge.tone}`}
                        title={badge.title}
                      >
                        {badge.label}
                      </span>
                    </div>
                    <div className="font-display text-lg mt-1 leading-tight">{o.nome}</div>
                    <div className="mt-3 flex items-end justify-between">
                      <span className="text-xs font-mono text-muted-foreground">{o.sigla}</span>
                      {o.rotaPropria ? (
                        <span className="text-xs text-accent">Ver portal próprio →</span>
                      ) : total !== null ? (
                        <span className="font-mono text-sm">{fmtBRL(total)}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">
                          {o.disponivelPortal ? "não consultado" : "integração planejada"}
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {loaded.size === 0 && (
        <div className="mt-10">
          <EmptyState
            title="Nenhum órgão carregado ainda"
            hint="Use os botões acima para buscar dados reais no Portal da Transparência."
          />
        </div>
      )}
    </div>
  );
}

function renderBadge(
  st: StatusFonte | null,
  o: Orgao,
): { label: string; tone: string; title: string } {
  if (st === null) {
    return {
      label: "Planejado",
      tone: "text-muted-foreground border-border",
      title: "Integração ainda não disponível",
    };
  }
  if (st.count === 0 || !st.updatedAt) {
    return {
      label: "Sem dados",
      tone: "text-muted-foreground border-border",
      title: o.rotaPropria ? "Fonte conectada, ainda sem registros em cache." : "Nenhum contrato em cache para este órgão.",
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
