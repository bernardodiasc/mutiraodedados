import { createFileRoute } from "@tanstack/react-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { listarTransferencias } from "@/lib/data/transferegov/queries.functions";
import { AvisoMetodologico } from "@/components/AvisoMetodologico";
import { fmtBRL } from "@/lib/fmt";
import { ExternalLink, FileSignature, Download, Loader2 } from "lucide-react";
import { downloadCSV } from "@/lib/csv";

const UFS = ["", "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"];
const ANOS = [0, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018];
const VALORES_MIN = [
  { v: 0, label: "Qualquer valor" },
  { v: 100_000, label: "≥ R$ 100 mil" },
  { v: 1_000_000, label: "≥ R$ 1 mi" },
  { v: 10_000_000, label: "≥ R$ 10 mi" },
];
const ORDENS = [
  { v: "data_desc", label: "Mais recentes" },
  { v: "valor_desc", label: "Maior valor global" },
  { v: "repasse_desc", label: "Maior repasse" },
] as const;
const PAGE = 40;
type Ordem = (typeof ORDENS)[number]["v"];

export const Route = createFileRoute("/convenios")({
  component: ConveniosPage,
  head: () => ({
    meta: [
      { title: "Convênios e contratos de repasse — Auditoria Cidadã" },
      { name: "description", content: "Convênios e contratos de repasse da União para estados e municípios (Transferegov/SICONV)." },
    ],
  }),
});

function ConveniosPage() {
  const buscar = useServerFn(listarTransferencias);
  const [uf, setUf] = useState("");
  const [ano, setAno] = useState(0);
  const [modalidade, setModalidade] = useState("");
  const [situacao, setSituacao] = useState("");
  const [valorMin, setValorMin] = useState(0);
  const [sort, setSort] = useState<Ordem>("data_desc");
  const [q, setQ] = useState("");

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ["convenios", uf, ano, modalidade, situacao, valorMin, sort, q],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      buscar({
        data: {
          uf: uf || undefined,
          ano: ano || undefined,
          modalidade: modalidade || undefined,
          situacao: situacao || undefined,
          valorMin: valorMin || undefined,
          sort,
          q: q || undefined,
          limit: PAGE,
          offset: pageParam as number,
        },
      }),
    getNextPageParam: (last, pages) =>
      (last.transferencias?.length ?? 0) < PAGE ? undefined : pages.length * PAGE,
  });

  const lista = (data?.pages ?? []).flatMap((p) => p.transferencias);

  const sentinel = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const obs = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage();
    }, { rootMargin: "400px" });
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 space-y-8">
      <header>
        <div className="text-xs text-muted-foreground uppercase tracking-wider">União → Estados/Municípios</div>
        <h1 className="font-display text-4xl mt-1">Convênios e Contratos de Repasse</h1>
        <p className="text-muted-foreground mt-3 max-w-3xl leading-relaxed">
          Instrumentos clássicos do Transferegov/SICONV — exigem plano de trabalho, contrapartida
          e prestação de contas, com aplicação vinculada ao objeto pactuado. Fonte: Portal da
          Transparência (CGU), endpoint <code>/convenios</code>.
        </p>
      </header>

      <AvisoMetodologico />

      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <select value={uf} onChange={(e) => setUf(e.target.value)} className="rounded-md border bg-background px-3 py-2 text-sm">
            {UFS.map((u) => <option key={u} value={u}>{u || "Todas UFs"}</option>)}
          </select>
          <select value={ano} onChange={(e) => setAno(Number(e.target.value))} className="rounded-md border bg-background px-3 py-2 text-sm">
            {ANOS.map((a) => <option key={a} value={a}>{a || "Todos os anos"}</option>)}
          </select>
          <input
            value={modalidade}
            onChange={(e) => setModalidade(e.target.value)}
            placeholder="Modalidade"
            className="rounded-md border bg-background px-3 py-2 text-sm"
          />
          <input
            value={situacao}
            onChange={(e) => setSituacao(e.target.value)}
            placeholder="Situação"
            className="rounded-md border bg-background px-3 py-2 text-sm"
          />
          <select value={valorMin} onChange={(e) => setValorMin(Number(e.target.value))} className="rounded-md border bg-background px-3 py-2 text-sm">
            {VALORES_MIN.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value as Ordem)} className="rounded-md border bg-background px-3 py-2 text-sm">
            {ORDENS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
          </select>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Objeto, beneficiário, órgão, nº…"
            className="rounded-md border bg-background px-3 py-2 text-sm sm:col-span-3 lg:col-span-6"
          />
        </div>
      </section>

      <section>
        {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {!isLoading && lista.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhum convênio disponível para os filtros selecionados.
          </p>
        )}
        {lista.length > 0 && (
          <div className="flex justify-end mb-2">
            <button
              onClick={() => downloadCSV(`convenios_${uf || "todos"}`, lista)}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted"
            >
              <Download className="size-3.5" /> Exportar CSV ({lista.length})
            </button>
          </div>
        )}
        <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
          {lista.map((t) => (
            <li key={t.id} className="p-4 space-y-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <FileSignature className="size-4 text-muted-foreground" />
                    Convênio {t.numero}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {t.orgao_concedente_nome ?? "—"} → {t.beneficiario_nome ?? "—"}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    {t.uf_beneficiario && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted text-foreground/80">
                        {t.uf_beneficiario}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {[t.municipio_nome, t.situacao].filter(Boolean).join(" · ")}
                    </span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-medium">{fmtBRL(t.valor_global)}</div>
                  <div className="text-xs text-muted-foreground">
                    Repasse: {fmtBRL(t.valor_repasse)}
                  </div>
                  <div className="text-xs text-muted-foreground">{t.data_assinatura ?? "—"}</div>
                </div>
              </div>
              {t.objeto && <p className="text-sm text-muted-foreground line-clamp-2">{t.objeto}</p>}
              {t.numero && (
                <a
                  href={`https://portaldatransparencia.gov.br/busca?termo=${encodeURIComponent(t.numero)}&tipoBusca=3`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-accent underline inline-flex items-center gap-1"
                >
                  Buscar no Portal da Transparência <ExternalLink className="size-3" />
                </a>
              )}
            </li>
          ))}
        </ul>
        <div ref={sentinel} className="h-12 flex items-center justify-center">
          {isFetchingNextPage && (
            <span className="text-xs text-muted-foreground inline-flex items-center gap-2">
              <Loader2 className="size-3.5 animate-spin" /> Carregando mais…
            </span>
          )}
          {!hasNextPage && lista.length > 0 && (
            <span className="text-xs text-muted-foreground">Fim dos resultados.</span>
          )}
        </div>
      </section>
    </div>
  );
}