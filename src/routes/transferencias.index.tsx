import { createFileRoute, Link } from "@tanstack/react-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { listarEmendas, type EmendaModalidade } from "@/lib/data/transferegov/emendas-queries.functions";
import { AvisoMetodologico } from "@/components/AvisoMetodologico";
import { fmtBRL } from "@/lib/fmt";
import { HandCoins, Lock, Unlock, Download, ExternalLink, ChevronRight, Loader2 } from "lucide-react";
import { downloadCSV } from "@/lib/csv";

const UFS = ["", "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"];
const ANOS = [0, 2025, 2024, 2023, 2022, 2021, 2020];
const VALORES_MIN = [
  { v: 0, label: "Qualquer valor" },
  { v: 100_000, label: "≥ R$ 100 mil" },
  { v: 500_000, label: "≥ R$ 500 mil" },
  { v: 1_000_000, label: "≥ R$ 1 mi" },
  { v: 5_000_000, label: "≥ R$ 5 mi" },
];
const ORDENS = [
  { v: "data_desc", label: "Mais recentes" },
  { v: "valor_desc", label: "Maior valor" },
  { v: "pago_desc", label: "Maior pago" },
] as const;
const PAGE = 40;

type ModalidadeFiltro = "" | EmendaModalidade;
type Ordem = (typeof ORDENS)[number]["v"];

export const Route = createFileRoute("/transferencias/")({
  component: TransferenciasPage,
  head: () => ({
    meta: [
      { title: "Transferências diretas (EC 105 / emendas Pix) — Auditoria Cidadã" },
      {
        name: "description",
        content:
          "Emendas parlamentares repassadas direto a estados e municípios sem convênio — Transferências Especiais (livre aplicação) e com Finalidade Definida (carimbadas).",
      },
    ],
  }),
});

function TransferenciasPage() {
  const buscar = useServerFn(listarEmendas);
  const [modalidade, setModalidade] = useState<ModalidadeFiltro>("especial");
  const [uf, setUf] = useState("");
  const [ano, setAno] = useState(0);
  const [valorMin, setValorMin] = useState(0);
  const [sort, setSort] = useState<Ordem>("data_desc");
  const [q, setQ] = useState("");

  // A query exige `modalidade`. Quando o filtro é "" (Todas), buscamos as duas
  // em paralelo por página e mesclamos em memória mantendo a ordenação.
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ["emendas-unificado", modalidade, uf, ano, valorMin, sort, q],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const offset = pageParam as number;
      const base = {
        uf: uf || undefined,
        ano: ano || undefined,
        valorMin: valorMin || undefined,
        sort,
        q: q || undefined,
        limit: PAGE,
        offset,
      };
      if (modalidade === "") {
        const [a, b] = await Promise.all([
          buscar({ data: { ...base, modalidade: "especial" } }),
          buscar({ data: { ...base, modalidade: "finalidade_definida" } }),
        ]);
        return { emendas: [...a.emendas, ...b.emendas] };
      }
      return buscar({ data: { ...base, modalidade } });
    },
    getNextPageParam: (last, pages) => {
      const expected = modalidade === "" ? PAGE * 2 : PAGE;
      if ((last.emendas?.length ?? 0) < expected) return undefined;
      return pages.length * PAGE;
    },
  });

  const todos = (data?.pages ?? []).flatMap((p) => p.emendas);
  // Mantém a ordenação visual consistente entre páginas quando misturamos modalidades
  const ordenados = [...todos].sort((x, y) => {
    if (sort === "valor_desc") return Number(y.valor) - Number(x.valor);
    if (sort === "pago_desc") return Number(y.valor_pago) - Number(x.valor_pago);
    const dx = x.data_referencia ?? `${x.ano}-00-00`;
    const dy = y.data_referencia ?? `${y.ano}-00-00`;
    return dy.localeCompare(dx);
  });

  const sentinel = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const obs = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    }, { rootMargin: "400px" });
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 space-y-8">
      <header>
        <div className="text-xs text-muted-foreground uppercase tracking-wider">EC 105/2019 · "Emendas Pix"</div>
        <h1 className="font-display text-4xl mt-1">Transferências diretas a entes</h1>
        <p className="text-muted-foreground mt-3 max-w-3xl leading-relaxed">
          Emendas parlamentares repassadas <strong>diretamente</strong> a estados e municípios,
          sem convênio nem plano de trabalho prévio. Há duas modalidades, criadas pela EC 105/2019:
        </p>
        <ul className="text-sm text-muted-foreground mt-3 space-y-1.5 max-w-3xl">
          <li className="flex gap-2"><Unlock className="size-4 mt-0.5 shrink-0 text-amber-600" /><span><strong>Especial</strong> — livre aplicação pelo ente (vedações mínimas).</span></li>
          <li className="flex gap-2"><Lock className="size-4 mt-0.5 shrink-0 text-blue-600" /><span><strong>Finalidade Definida</strong> — carimbada a uma programação específica.</span></li>
        </ul>
        <p className="text-sm text-muted-foreground mt-3 max-w-3xl">
          Para convênios e contratos de repasse (com plano de trabalho), veja{" "}
          <Link to="/convenios" className="text-accent underline">Convênios</Link>.
          Contexto histórico na{" "}
          <Link to="/notas/$slug" params={{ slug: "transferegov" }} className="text-accent underline">
            nota sobre o Transferegov
          </Link>.
        </p>
      </header>

      <AvisoMetodologico />

      <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {([
            { v: "", label: "Todas" },
            { v: "especial", label: "Especial (livre)" },
            { v: "finalidade_definida", label: "Finalidade Definida (carimbada)" },
          ] as Array<{ v: ModalidadeFiltro; label: string }>).map((opt) => (
            <button
              key={opt.v}
              onClick={() => setModalidade(opt.v)}
              className={`text-xs px-3 py-1.5 rounded-full border transition ${
                modalidade === opt.v
                  ? "bg-foreground text-background border-foreground"
                  : "bg-background border-border hover:bg-muted"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-5">
          <select value={uf} onChange={(e) => setUf(e.target.value)} className="rounded-md border bg-background px-3 py-2 text-sm">
            {UFS.map((u) => <option key={u} value={u}>{u || "Todas UFs"}</option>)}
          </select>
          <select value={ano} onChange={(e) => setAno(Number(e.target.value))} className="rounded-md border bg-background px-3 py-2 text-sm">
            {ANOS.map((a) => <option key={a} value={a}>{a || "Todos os anos"}</option>)}
          </select>
          <select value={valorMin} onChange={(e) => setValorMin(Number(e.target.value))} className="rounded-md border bg-background px-3 py-2 text-sm">
            {VALORES_MIN.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value as Ordem)} className="rounded-md border bg-background px-3 py-2 text-sm">
            {ORDENS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
          </select>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Beneficiário, autor, município, nº…"
            className="rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>
      </section>

      <section>
        {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {!isLoading && ordenados.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum registro para os filtros.</p>
        )}
        {ordenados.length > 0 && (
          <div className="flex justify-end mb-2">
            <button
              onClick={() => downloadCSV(`transferencias_diretas_${modalidade || "todas"}_${uf || "todos"}_${ano || "todos"}`, ordenados)}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted"
            >
              <Download className="size-3.5" /> Exportar CSV ({ordenados.length})
            </button>
          </div>
        )}
        <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
          {ordenados.map((e) => {
            const isEspecial = e.modalidade === "especial";
            const portalUrl = e.codigo_emenda
              ? `https://portaldatransparencia.gov.br/emendas/consulta?de=${e.ano}&ate=${e.ano}&codigoEmenda=${encodeURIComponent(e.codigo_emenda)}`
              : isEspecial
              ? `https://portaldatransparencia.gov.br/emendas/consulta?de=${e.ano}&ate=${e.ano}&codigoEmenda=${encodeURIComponent(e.numero_emenda ?? "")}`
              : `https://portaldatransparencia.gov.br/emendas/consulta?de=${e.ano}&ate=${e.ano}&numeroEmenda=${encodeURIComponent(e.numero_emenda ?? "")}`;
            return (
              <li
                key={e.id}
                className={`p-4 border-l-2 ${
                  isEspecial ? "border-l-amber-500/70" : "border-l-blue-500/70"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <HandCoins className="size-4 text-muted-foreground" />
                      Emenda {e.numero_emenda ?? "—"} · {e.autor_emenda ?? "Autor não informado"}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded inline-flex items-center gap-1 ${
                          isEspecial
                            ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                            : "bg-blue-500/10 text-blue-700 dark:text-blue-300"
                        }`}
                      >
                        {isEspecial ? <Unlock className="size-2.5" /> : <Lock className="size-2.5" />}
                        {isEspecial ? "Especial" : "Finalidade Definida"}
                      </span>
                      {e.uf && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted text-foreground/80">
                          {e.uf}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {[e.beneficiario_nome, e.municipio_nome].filter(Boolean).join(" · ")}
                      </span>
                    </div>
                    {e.finalidade && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{e.finalidade}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-medium">{fmtBRL(e.valor)}</div>
                    <div className="text-xs text-muted-foreground">Pago: {fmtBRL(e.valor_pago)}</div>
                    <div className="text-xs text-muted-foreground">{e.data_referencia ?? `Ano ${e.ano}`}</div>
                    <div className="flex flex-col items-end gap-1.5 mt-1.5">
                      <a
                        href={portalUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-accent inline-flex items-center gap-1"
                        title="Abrir consulta de emendas no Portal da Transparência"
                      >
                        Fonte <ExternalLink className="size-3" />
                      </a>
                      <Link
                        to={isEspecial ? "/transferencias/especiais/$id" : "/transferencias/finalidade/$id"}
                        params={{ id: e.id }}
                        className="text-xs px-2 py-1 rounded border border-border hover:bg-muted inline-flex items-center gap-1"
                      >
                        Detalhes <ChevronRight className="size-3" />
                      </Link>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        <div ref={sentinel} className="h-12 flex items-center justify-center">
          {isFetchingNextPage && (
            <span className="text-xs text-muted-foreground inline-flex items-center gap-2">
              <Loader2 className="size-3.5 animate-spin" /> Carregando mais…
            </span>
          )}
          {!hasNextPage && ordenados.length > 0 && (
            <span className="text-xs text-muted-foreground">Fim dos resultados.</span>
          )}
        </div>
      </section>
    </div>
  );
}