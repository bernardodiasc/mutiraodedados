import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createContext, useContext, useMemo, useState } from "react";
import { BotaoSalvarBusca } from "@/components/BotaoSalvarBusca";
import { BotaoBaixarCsv } from "@/components/BotaoBaixarCsv";
import {
  listarLegislaturasCamara,
  consultarMembrosCamara,
  rankingGastosDeputados,
  movimentacoesLegislaturaCamara,
  type DeputadoConsulta,
} from "@/lib/data/camara/queries.functions";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { EmptyState } from "@/components/EmptyState";
import { SituacaoBadge, fmtData } from "@/components/Trajetoria";
import { Input } from "@/components/ui/input";
import { fmtBRL } from "@/lib/fmt";
import { ChevronDown } from "lucide-react";

// Gasto CEAP por deputado (ranking global) disponibilizado aos cards sem prop drilling.
const GastoContext = createContext<Map<number, number>>(new Map());

// Filtros na URL: permite compartilhar e "salvar esta busca" no caderno.
type DeputadosSearch = {
  q?: string;
  uf?: string;
  partido?: string;
  situacao?: string;
  legislatura?: number;
};

const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);
const num = (v: unknown) => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isInteger(n) && n > 0 ? n : undefined;
};

export const Route = createFileRoute("/camara_/deputados/")({
  validateSearch: (s: Record<string, unknown>): DeputadosSearch => ({
    q: str(s.q),
    uf: str(s.uf),
    partido: str(s.partido),
    situacao: str(s.situacao),
    legislatura: num(s.legislatura),
  }),
  component: ListaDeputados,
  head: () => ({
    meta: [
      { title: "Deputados federais — Mutirão de Dados" },
      {
        name: "description",
        content:
          "Lista navegável dos deputados federais por legislatura, com filtros por UF, partido, situação e legislatura, busca por nome e exportação em CSV.",
      },
    ],
  }),
});

function anosDaLegislatura(n: number): string {
  const ini = 2003 + (n - 52) * 4;
  return `${ini}–${ini + 4}`;
}

/** Vacâncias e substituições de uma legislatura (lazy ao abrir). */
function MovimentacoesLegislatura({ legislatura }: { legislatura: number }) {
  const [aberto, setAberto] = useState(false);
  const fn = useServerFn(movimentacoesLegislaturaCamara);
  const { data = [], isLoading } = useQuery({
    queryKey: ["camara", "movimentacoes", legislatura],
    queryFn: () => fn({ data: { legislatura } }),
    enabled: aberto,
  });
  return (
    <Collapsible
      open={aberto}
      onOpenChange={setAberto}
      className="rounded-xl border border-border bg-card"
    >
      <CollapsibleTrigger className="group w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-muted/40">
        <ChevronDown className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
        <span className="font-medium text-sm">
          Vacâncias e substituições
          <span className="text-muted-foreground font-normal"> · {legislatura}ª legislatura</span>
        </span>
        {data.length > 0 && (
          <span className="ml-auto text-xs text-muted-foreground">{data.length} movimentações</span>
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-4 pt-1">
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-2">Carregando…</p>
        ) : data.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            Nenhuma saída ou posse de suplente registrada nesta legislatura (importe a trajetória no
            painel admin).
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {data.map((m, i) => (
              <li key={i} className="py-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <span className="font-mono text-xs text-muted-foreground w-[72px] shrink-0">
                  {fmtData(m.dataHora)}
                </span>
                <Link
                  to="/camara/deputados/$id"
                  params={{ id: String(m.deputadoId) }}
                  className="font-medium hover:text-accent hover:underline"
                >
                  {m.nome}
                </Link>
                {m.siglaUf && <span className="text-xs text-muted-foreground">{m.siglaUf}</span>}
                {m.situacao && <SituacaoBadge situacao={m.situacao} />}
                <span className="text-xs text-muted-foreground">{m.descricao}</span>
                {m.condicaoEleitoral && (
                  <span className="text-xs text-muted-foreground/80 italic">
                    {m.condicaoEleitoral}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

function iniciais(nome: string): string {
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function Foto({ src, nome }: { src: string; nome: string }) {
  const [erro, setErro] = useState(false);
  if (erro) {
    return (
      <div className="size-14 rounded-md bg-muted border border-border flex items-center justify-center text-xs text-muted-foreground shrink-0">
        {iniciais(nome)}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      onError={() => setErro(true)}
      className="size-14 rounded-md object-cover border border-border shrink-0"
    />
  );
}

function CardDeputado({ d }: { d: DeputadoConsulta }) {
  const gasto = useContext(GastoContext).get(d.id);
  return (
    <Link
      to="/camara/deputados/$id"
      params={{ id: String(d.id) }}
      className="border border-border rounded-xl p-4 bg-card hover:border-accent transition-colors flex gap-3 items-start"
    >
      <Foto src={d.urlFoto} nome={d.nome} />
      <div className="flex-1 min-w-0">
        <div className="font-display text-base leading-tight truncate">{d.nome}</div>
        <div className="text-xs text-muted-foreground mt-1">
          {d.siglaPartido ?? "—"} · {d.siglaUf ?? "—"}
        </div>
        {d.situacao && (
          <div className="mt-1.5">
            <SituacaoBadge situacao={d.situacao} />
          </div>
        )}
        {gasto !== undefined && (
          <div className="text-xs font-mono mt-2 text-foreground">
            {fmtBRL(gasto)} <span className="text-muted-foreground">em CEAP</span>
          </div>
        )}
      </div>
    </Link>
  );
}

function Grade({ membros }: { membros: DeputadoConsulta[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {membros.map((d) => (
        <CardDeputado key={`${d.legislatura}-${d.id}`} d={d} />
      ))}
    </div>
  );
}

/** Cabeçalho de um painel de legislatura (colapsível). */
function TituloLegislatura({ legislatura, total }: { legislatura: number; total: number }) {
  return (
    <>
      <ChevronDown className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
      <span className="font-medium text-sm">
        {legislatura}ª legislatura
        <span className="text-muted-foreground font-normal">
          {" "}
          · {anosDaLegislatura(legislatura)}
        </span>
      </span>
      <span className="ml-auto text-xs text-muted-foreground">{total} deputados</span>
    </>
  );
}

/**
 * Painel de uma legislatura no modo navegação: só busca os membros quando é
 * aberto (lazy). O painel da legislatura atual abre por padrão.
 */
function PainelLegislatura({
  legislatura,
  total,
  defaultOpen,
}: {
  legislatura: number;
  total: number;
  defaultOpen: boolean;
}) {
  const [aberto, setAberto] = useState(defaultOpen);
  const consultarFn = useServerFn(consultarMembrosCamara);
  const { data = [], isLoading } = useQuery({
    queryKey: ["camara", "membros-leg", legislatura],
    queryFn: () => consultarFn({ data: { legislatura } }),
    enabled: aberto,
  });
  return (
    <Collapsible
      open={aberto}
      onOpenChange={setAberto}
      className="rounded-xl border border-border bg-card"
    >
      <CollapsibleTrigger className="group w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-muted/40">
        <TituloLegislatura legislatura={legislatura} total={total} />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-4 pt-1">
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-2">Carregando…</p>
        ) : (
          <Grade membros={data} />
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

/** Grupo de resultados (dados já em memória) — colapsível, sem novo fetch. */
function GrupoResultado({
  legislatura,
  membros,
  defaultOpen,
}: {
  legislatura: number;
  membros: DeputadoConsulta[];
  defaultOpen: boolean;
}) {
  return (
    <Collapsible defaultOpen={defaultOpen} className="rounded-xl border border-border bg-card">
      <CollapsibleTrigger className="group w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-muted/40">
        <TituloLegislatura legislatura={legislatura} total={membros.length} />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-4 pt-1">
        <Grade membros={membros} />
      </CollapsibleContent>
    </Collapsible>
  );
}

function ListaDeputados() {
  const legFn = useServerFn(listarLegislaturasCamara);
  const consultarFn = useServerFn(consultarMembrosCamara);
  const rankFn = useServerFn(rankingGastosDeputados);
  const { data: info, isLoading: infoLoading } = useQuery({
    queryKey: ["camara", "legislaturas"],
    queryFn: () => legFn(),
  });
  const { data: rank } = useQuery({ queryKey: ["camara", "ranking"], queryFn: () => rankFn() });
  const gastoPorId = useMemo(() => {
    const m = new Map<number, number>();
    for (const r of rank ?? []) m.set(r.id, r.total);
    return m;
  }, [rank]);

  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const q = search.q ?? "";
  const uf = search.uf ?? "";
  const partido = search.partido ?? "";
  const situacao = search.situacao ?? "";
  const legislatura = search.legislatura;
  const setFiltro = (patch: Partial<DeputadosSearch>) =>
    navigate({ search: (prev: DeputadosSearch) => ({ ...prev, ...patch }), replace: true });

  const modoResultado = !!(q.trim() || uf || partido || situacao);
  const legAtual = info?.legAtual;
  // Legislatura em foco (modo navegação) e alvo do CSV.
  const legFoco = legislatura ?? legAtual;

  const filtros = useMemo(
    () => ({
      q: q.trim() || undefined,
      uf: uf || undefined,
      partido: partido || undefined,
      situacao: situacao || undefined,
      legislatura: legislatura,
    }),
    [q, uf, partido, situacao, legislatura],
  );

  // Query de foco: em modo resultado traz os que casam (busca global mesmo lazy);
  // em navegação traz a legislatura em foco (compartilha cache com o painel).
  const { data: foco = [], isLoading: focoLoading } = useQuery({
    queryKey: modoResultado
      ? ["camara", "membros-busca", filtros]
      : ["camara", "membros-leg", legFoco],
    queryFn: () => consultarFn({ data: modoResultado ? filtros : { legislatura: legFoco } }),
    enabled: !!info && (modoResultado || legFoco != null),
  });

  const gruposResultado = useMemo(() => {
    const m = new Map<number, DeputadoConsulta[]>();
    for (const d of foco) {
      if (!m.has(d.legislatura)) m.set(d.legislatura, []);
      m.get(d.legislatura)!.push(d);
    }
    return [...m.entries()].sort((a, b) => b[0] - a[0]);
  }, [foco]);

  const linhasCsv = () =>
    foco.map((d) => ({
      nome: d.nome,
      partido: d.siglaPartido ?? "",
      uf: d.siglaUf ?? "",
      legislatura: d.legislatura,
      situacao: d.situacao ?? "",
    }));

  const legislaturasNav = info
    ? info.legislaturas.filter((l) => legislatura == null || l.legislatura === legislatura)
    : [];

  const selectCls = "rounded-md border border-input bg-background px-3 py-2 text-sm";

  return (
    <GastoContext.Provider value={gastoPorId}>
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div>
          <div className="text-xs text-muted-foreground uppercase tracking-wider">
            <Link to="/camara" className="hover:text-accent">
              Câmara
            </Link>{" "}
            · Deputados
          </div>
          <h1 className="font-display text-4xl mt-1">Deputados federais</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            O mandato de um deputado dura <strong className="text-foreground">4 anos</strong> —
            exatamente uma legislatura. Cada legislatura recebe seu próprio painel abaixo; abra para
            carregar os membros.
          </p>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            placeholder="Buscar por nome…"
            value={q}
            onChange={(e) => setFiltro({ q: e.target.value || undefined })}
          />
          <select
            className={selectCls}
            value={legislatura ?? ""}
            onChange={(e) =>
              setFiltro({ legislatura: e.target.value ? Number(e.target.value) : undefined })
            }
          >
            <option value="">Todas as legislaturas</option>
            {info?.legislaturas.map((l) => (
              <option key={l.legislatura} value={l.legislatura}>
                {l.legislatura}ª ({anosDaLegislatura(l.legislatura)})
              </option>
            ))}
          </select>
          <select
            className={selectCls}
            value={uf}
            onChange={(e) => setFiltro({ uf: e.target.value || undefined })}
          >
            <option value="">Todas UFs</option>
            {info?.ufs.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
          <select
            className={selectCls}
            value={partido}
            onChange={(e) => setFiltro({ partido: e.target.value || undefined })}
          >
            <option value="">Todos partidos</option>
            {info?.partidos.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        {info && info.situacoes.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <select
              className={selectCls}
              value={situacao}
              onChange={(e) => setFiltro({ situacao: e.target.value || undefined })}
            >
              <option value="">Todas as situações</option>
              {info.situacoes.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <span className="text-xs text-muted-foreground">
              A situação reflete o status atual (legislatura vigente).
            </span>
          </div>
        )}

        <div className="mt-3 flex flex-wrap justify-end gap-2">
          <BotaoBaixarCsv
            filename="deputados-federais"
            obterLinhas={linhasCsv}
            disabled={foco.length === 0}
            rotulo={
              modoResultado
                ? `Baixar CSV (${foco.length})`
                : `Baixar CSV${legFoco ? ` · ${legFoco}ª` : ""} (${foco.length})`
            }
          />
          <BotaoSalvarBusca
            path="/camara/deputados"
            search={search}
            titulo="Deputados federais"
            filtros={[
              ["busca", q],
              ["UF", uf],
              ["partido", partido],
              ["situação", situacao],
              ["legislatura", legislatura ? `${legislatura}ª` : ""],
            ]}
          />
        </div>

        {infoLoading ? (
          <div className="mt-10 text-sm text-muted-foreground">Carregando…</div>
        ) : !info || info.legislaturas.length === 0 ? (
          <div className="mt-10">
            <EmptyState
              title="Nenhum deputado em cache"
              hint="Um administrador precisa importar o cadastro de deputados a partir do painel admin."
            />
          </div>
        ) : modoResultado ? (
          <div className="mt-8 space-y-3">
            {focoLoading ? (
              <p className="text-sm text-muted-foreground">Buscando…</p>
            ) : foco.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum deputado com esses filtros.</p>
            ) : (
              gruposResultado.map(([leg, membros], i) => (
                <GrupoResultado
                  key={leg}
                  legislatura={leg}
                  membros={membros}
                  defaultOpen={i === 0}
                />
              ))
            )}
          </div>
        ) : (
          <div className="mt-8 space-y-3">
            {legFoco != null && <MovimentacoesLegislatura legislatura={legFoco} />}
            {legislaturasNav.map((l) => (
              <PainelLegislatura
                key={l.legislatura}
                legislatura={l.legislatura}
                total={l.total}
                defaultOpen={l.legislatura === legAtual || legislatura != null}
              />
            ))}
          </div>
        )}
      </div>
    </GastoContext.Provider>
  );
}
