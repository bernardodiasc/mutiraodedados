import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { listarContratosPNCP } from "@/lib/data/pncp/queries.functions";
import { listarRelatoriosSICONFI } from "@/lib/data/siconfi/queries.functions";
import { listarTransferencias } from "@/lib/data/transferegov/queries.functions";
import { AvisoMetodologico } from "@/components/AvisoMetodologico";
import { EmptyState } from "@/components/EmptyState";
import { fmtBRL } from "@/lib/fmt";
import { downloadCSV } from "@/lib/csv";
import { Building2, FileText, ArrowRightLeft, Landmark, Download, ExternalLink } from "lucide-react";

const UFS = ["", "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"];

export const Route = createFileRoute("/explorar")({
  component: ExplorarPage,
  head: () => ({
    meta: [
      { title: "Explorar por ente — Mutirão de Dados" },
      { name: "description", content: "Visão consolidada de um estado ou município: contratos, relatórios fiscais e transferências da União em um só lugar." },
      { property: "og:title", content: "Explorar por ente — Mutirão de Dados" },
      { property: "og:description", content: "Visão consolidada de um estado ou município: contratos, relatórios fiscais e transferências da União em um só lugar." },
    ],
  }),
});

type Aba = "contratos" | "fiscal" | "transferencias";

function ExplorarPage() {
  const [uf, setUf] = useState("");
  const [ibge, setIbge] = useState("");
  const [aba, setAba] = useState<Aba>("contratos");

  const enteSelecionado = uf || ibge;

  const pncpFn = useServerFn(listarContratosPNCP);
  const siconfiFn = useServerFn(listarRelatoriosSICONFI);
  const transfFn = useServerFn(listarTransferencias);

  const pncp = useQuery({
    queryKey: ["explorar-pncp", uf, ibge],
    enabled: !!enteSelecionado,
    queryFn: () =>
      pncpFn({ data: { uf: uf || undefined, municipioIbge: ibge || undefined, limit: 100 } }),
  });

  const siconfi = useQuery({
    queryKey: ["explorar-siconfi", uf, ibge],
    enabled: !!enteSelecionado,
    queryFn: () => siconfiFn({ data: { uf: uf || undefined, codIbge: ibge || undefined, limit: 100 } }),
  });

  const transf = useQuery({
    queryKey: ["explorar-transf", uf, ibge],
    enabled: !!enteSelecionado,
    queryFn: () =>
      transfFn({ data: { uf: uf || undefined, municipioIbge: ibge || undefined, limit: 100 } }),
  });

  const totais = useMemo(() => {
    const contratos = pncp.data?.contratos ?? [];
    const transfers = transf.data?.transferencias ?? [];
    return {
      contratos: contratos.length,
      contratado: contratos.reduce((s, c) => s + (c.valor_global ?? 0), 0),
      transferidoTotal: transfers.reduce((s, t) => s + (t.valor_global ?? 0), 0),
      relatorios: siconfi.data?.relatorios.length ?? 0,
    };
  }, [pncp.data, siconfi.data, transf.data]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 space-y-8">
      <header>
        <div className="text-xs text-muted-foreground uppercase tracking-wider">Descoberta por ente</div>
        <h1 className="font-display text-4xl mt-1">Explorar por estado ou município</h1>
        <p className="text-muted-foreground mt-3 max-w-3xl leading-relaxed">
          Escolha um ente federativo para ver, no mesmo lugar, dados das três fontes
          nacionais: contratações (PNCP), relatórios fiscais (SICONFI) e transferências
          da União (Transferegov/CGU).
        </p>
      </header>

      <AvisoMetodologico />

      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-xs text-muted-foreground space-y-1">
            UF
            <select value={uf} onChange={(e) => setUf(e.target.value)} className="w-full rounded-md border bg-background px-3 py-2 text-sm">
              {UFS.map((u) => <option key={u} value={u}>{u || "Selecionar"}</option>)}
            </select>
          </label>
          <label className="text-xs text-muted-foreground space-y-1 sm:col-span-2">
            Código IBGE do município (7 dígitos) — opcional
            <input
              value={ibge}
              onChange={(e) => setIbge(e.target.value.replace(/\D/g, "").slice(0, 7))}
              placeholder="Ex.: 3550308 (São Paulo/SP)"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono"
            />
          </label>
        </div>
      </section>

      {!enteSelecionado && (
        <EmptyState
          title="Selecione uma UF ou um município"
          hint="A consulta consolida dados das fontes nacionais para o ente escolhido."
        />
      )}

      {enteSelecionado && (
        <>
          <section className="grid gap-4 sm:grid-cols-4">
            <Stat icon={<FileText className="size-4" />} label="Contratos PNCP" value={String(totais.contratos)} />
            <Stat icon={<Building2 className="size-4" />} label="Total contratado" value={fmtBRL(totais.contratado)} />
            <Stat icon={<ArrowRightLeft className="size-4" />} label="Transferências recebidas" value={fmtBRL(totais.transferidoTotal)} />
            <Stat icon={<Landmark className="size-4" />} label="Linhas SICONFI" value={String(totais.relatorios)} />
          </section>

          <div className="flex gap-1 border-b border-border">
            <TabBtn active={aba === "contratos"} onClick={() => setAba("contratos")}>Contratos</TabBtn>
            <TabBtn active={aba === "fiscal"} onClick={() => setAba("fiscal")}>Fiscal (SICONFI)</TabBtn>
            <TabBtn active={aba === "transferencias"} onClick={() => setAba("transferencias")}>Transferências</TabBtn>
          </div>

          {aba === "contratos" && (
            <section className="space-y-3">
              <ExportRow
                disabled={!pncp.data?.contratos.length}
                onClick={() =>
                  downloadCSV(`pncp_${uf || ibge}`, pncp.data?.contratos ?? [])
                }
              />
              {pncp.isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
              {!pncp.isLoading && (pncp.data?.contratos.length ?? 0) === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum contrato PNCP em cache para este ente.</p>
              )}
              <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
                {(pncp.data?.contratos ?? []).map((c) => (
                  <li key={c.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium">{c.orgao_nome}</div>
                        <div className="text-xs text-muted-foreground">{[c.uf, c.municipio_nome].filter(Boolean).join(" · ")}</div>
                        {c.objeto && <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{c.objeto}</p>}
                        {c.fornecedor_nome && (
                          <p className="text-xs text-muted-foreground mt-0.5">Fornecedor: {c.fornecedor_nome}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-medium">{fmtBRL(c.valor_global)}</div>
                        <div className="text-xs text-muted-foreground">{c.data_assinatura ?? "—"}</div>
                        {c.url_pncp && (
                          <a href={c.url_pncp} target="_blank" rel="noreferrer" className="text-xs text-accent underline inline-flex items-center gap-1 mt-1">
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
              <ExportRow
                disabled={!siconfi.data?.relatorios.length}
                onClick={() =>
                  downloadCSV(`siconfi_${uf || ibge}`, siconfi.data?.relatorios ?? [])
                }
              />
              {siconfi.isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
              {!siconfi.isLoading && (siconfi.data?.relatorios.length ?? 0) === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum relatório SICONFI em cache.</p>
              )}
              <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
                {(siconfi.data?.relatorios ?? []).slice(0, 200).map((r) => (
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
                          {r.exercicio}{r.periodo ? ` · P${r.periodo}` : ""}
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
              <ExportRow
                disabled={!transf.data?.transferencias.length}
                onClick={() =>
                  downloadCSV(`transferencias_${uf || ibge}`, transf.data?.transferencias ?? [])
                }
              />
              {transf.isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
              {!transf.isLoading && (transf.data?.transferencias.length ?? 0) === 0 && (
                <p className="text-sm text-muted-foreground">Nenhuma transferência em cache.</p>
              )}
              <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
                {(transf.data?.transferencias ?? []).map((t) => (
                  <li key={t.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium">Convênio {t.numero}</div>
                        <div className="text-xs text-muted-foreground">
                          {t.orgao_concedente_nome ?? "—"} → {t.beneficiario_nome ?? "—"}
                        </div>
                        {t.objeto && <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{t.objeto}</p>}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-medium">{fmtBRL(t.valor_global)}</div>
                        <div className="text-xs text-muted-foreground">{t.data_assinatura ?? "—"}</div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground flex items-center gap-2">{icon}{label}</div>
      <div className="mt-1 text-xl font-medium truncate">{value}</div>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
        active ? "border-accent text-accent" : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function ExportRow({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  return (
    <div className="flex justify-end">
      <button
        disabled={disabled}
        onClick={onClick}
        className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted disabled:opacity-50"
      >
        <Download className="size-3.5" /> Exportar CSV
      </button>
    </div>
  );
}