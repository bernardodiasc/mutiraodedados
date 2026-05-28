import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listarContratosPNCP, statsContratosPNCP } from "@/lib/data/pncp/queries.functions";
import { AvisoMetodologico } from "@/components/AvisoMetodologico";
import { fmtBRL } from "@/lib/fmt";
import { Building2, FileText, ExternalLink, Download } from "lucide-react";
import { downloadCSV } from "@/lib/csv";

const UFS = ["", "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"];

export const Route = createFileRoute("/pncp")({
  component: PNCPPage,
  head: () => ({
    meta: [
      { title: "Contratações Públicas (PNCP) — Auditoria Cidadã" },
      { name: "description", content: "Contratos públicos da União, Estados e Municípios via Portal Nacional de Contratações Públicas." },
    ],
  }),
});

function PNCPPage() {
  const buscar = useServerFn(listarContratosPNCP);
  const stats = useServerFn(statsContratosPNCP);
  const [uf, setUf] = useState("");
  const [esfera, setEsfera] = useState<"" | "federal" | "estadual" | "municipal">("");
  const [q, setQ] = useState("");

  const { data: st } = useQuery({ queryKey: ["pncp-stats"], queryFn: () => stats() });
  const { data, isLoading } = useQuery({
    queryKey: ["pncp", uf, esfera, q],
    queryFn: () =>
      buscar({
        data: {
          uf: uf || undefined,
          esfera: esfera || undefined,
          q: q || undefined,
          limit: 50,
        },
      }),
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 space-y-8">
      <header>
        <div className="text-xs text-muted-foreground uppercase tracking-wider">Cobertura nacional</div>
        <h1 className="font-display text-4xl mt-1">Contratações Públicas (PNCP)</h1>
        <p className="text-muted-foreground mt-3 max-w-3xl leading-relaxed">
          Portal Nacional de Contratações Públicas — Lei 14.133/2021. Cobre contratos da
          União, dos 26 estados, do DF e dos 5.570 municípios brasileiros desde 2021.{" "}
          <a href="https://pncp.gov.br" target="_blank" rel="noreferrer" className="text-accent underline">
            pncp.gov.br
          </a>
        </p>
      </header>

      <AvisoMetodologico />

      <section className="grid gap-4 sm:grid-cols-3">
        <Stat icon={<FileText className="size-4" />} label="Contratos em cache" value={String(st?.total ?? 0)} />
        <Stat icon={<Building2 className="size-4" />} label="Cobertura" value="5.598 entes" />
        <Stat icon={<ExternalLink className="size-4" />} label="Fonte" value="PNCP / CGU" />
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <h2 className="font-medium">Filtrar contratos</h2>
        <div className="grid gap-3 sm:grid-cols-4">
          <select value={uf} onChange={(e) => setUf(e.target.value)} className="rounded-md border bg-background px-3 py-2 text-sm">
            {UFS.map((u) => <option key={u} value={u}>{u || "Todas UFs"}</option>)}
          </select>
          <select value={esfera} onChange={(e) => setEsfera(e.target.value as typeof esfera)} className="rounded-md border bg-background px-3 py-2 text-sm">
            <option value="">Todas esferas</option>
            <option value="federal">Federal</option>
            <option value="estadual">Estadual</option>
            <option value="municipal">Municipal</option>
          </select>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar no objeto..."
            className="rounded-md border bg-background px-3 py-2 text-sm sm:col-span-2"
          />
        </div>
      </section>

      <section>
        {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {!isLoading && (data?.contratos.length ?? 0) === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhum contrato disponível com esses filtros.
          </p>
        )}
        {(data?.contratos.length ?? 0) > 0 && (
          <div className="flex justify-end mb-2">
            <button
              onClick={() => downloadCSV(`pncp_${uf || "todos"}_${esfera || "todas"}`, data!.contratos)}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted"
            >
              <Download className="size-3.5" /> Exportar CSV
            </button>
          </div>
        )}
        <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
          {(data?.contratos ?? []).map((c) => (
            <li key={c.id} className="p-4 space-y-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium text-sm">{c.orgao_nome}</div>
                  <div className="text-xs text-muted-foreground">
                    {[c.uf, c.municipio_nome, c.esfera].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-medium">{fmtBRL(c.valor_global)}</div>
                  <div className="text-xs text-muted-foreground">{c.data_assinatura ?? "—"}</div>
                </div>
              </div>
              {c.objeto && <p className="text-sm text-muted-foreground line-clamp-2">{c.objeto}</p>}
              {c.fornecedor_nome && (
                <p className="text-xs text-muted-foreground">
                  Fornecedor: {c.fornecedor_nome} {c.fornecedor_cnpj_cpf ? `(${c.fornecedor_cnpj_cpf})` : ""}
                </p>
              )}
              {c.url_pncp && (
                <a href={c.url_pncp} target="_blank" rel="noreferrer" className="text-xs text-accent underline inline-flex items-center gap-1">
                  Ver no PNCP <ExternalLink className="size-3" />
                </a>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground flex items-center gap-2">{icon}{label}</div>
      <div className="mt-1 text-xl font-medium">{value}</div>
    </div>
  );
}