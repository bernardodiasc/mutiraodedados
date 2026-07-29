import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createContext, useContext, useMemo, useState } from "react";
import { BotaoSalvarBusca } from "@/components/BotaoSalvarBusca";
import { BotaoBaixarCsv } from "@/components/BotaoBaixarCsv";
import {
  listarLegislaturasSenado,
  consultarMembrosSenado,
  rankingGastosSenadores,
  movimentacoesLegislaturaSenado,
  type SenadorConsulta,
} from "@/lib/data/senado/queries.functions";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { EmptyState } from "@/components/EmptyState";
import { SituacaoBadge, fmtData } from "@/components/Trajetoria";
import { Input } from "@/components/ui/input";
import { fmtBRL } from "@/lib/fmt";
import { ChevronDown } from "lucide-react";

// Gasto CEAPS por senador (ranking global) disponibilizado aos cards sem prop drilling.
const GastoContext = createContext<Map<number, number>>(new Map());

// Filtros na URL: permite compartilhar e "salvar esta busca" no caderno.
type SenadoresSearch = {
  q?: string;
  uf?: string;
  partido?: string;
  situacao?: string;
  participacao?: string;
  legislatura?: number;
};

const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);
const num = (v: unknown) => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isInteger(n) && n > 0 ? n : undefined;
};

export const Route = createFileRoute("/senado_/senadores/")({
  validateSearch: (s: Record<string, unknown>): SenadoresSearch => ({
    q: str(s.q),
    uf: str(s.uf),
    partido: str(s.partido),
    situacao: str(s.situacao),
    participacao: str(s.participacao),
    legislatura: num(s.legislatura),
  }),
  component: ListaSenadores,
  head: () => ({
    meta: [
      { title: "Senadores — Mutirão de Dados" },
      {
        name: "description",
        content:
          "Lista navegável dos senadores por legislatura, com filtros por UF, partido, situação, participação (titular/suplente) e legislatura, busca por nome e exportação em CSV.",
      },
    ],
  }),
});

function anosDaLegislatura(n: number): string {
  const ini = 2003 + (n - 52) * 4;
  return `${ini}–${ini + 4}`;
}

/** Afastamentos (saídas do exercício) de uma legislatura, lazy ao abrir. */
function AfastamentosLegislatura({ legislatura }: { legislatura: number }) {
  const [aberto, setAberto] = useState(false);
  const fn = useServerFn(movimentacoesLegislaturaSenado);
  const { data = [], isLoading } = useQuery({
    queryKey: ["senado", "afastamentos", legislatura],
    queryFn: () => fn({ data: { legislatura } }),
    enabled: aberto,
  });
  return (
    <Collapsible open={aberto} onOpenChange={setAberto} className="rounded-xl border border-border bg-card">
      <CollapsibleTrigger className="group w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-muted/40">
        <ChevronDown className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
        <span className="font-medium text-sm">
          Vacâncias e afastamentos
          <span className="text-muted-foreground font-normal"> · {legislatura}ª legislatura</span>
        </span>
        {data.length > 0 && (
          <span className="ml-auto text-xs text-muted-foreground">
            {data.length} {data.length === 1 ? "saída do exercício" : "saídas do exercício"}
          </span>
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-4 pt-1">
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-2">Carregando…</p>
        ) : data.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            Nenhum afastamento registrado nesta legislatura (importe os mandatos no painel admin).
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {data.map((m, i) => (
              <li key={i} className="py-2.5 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
                <span className="font-mono text-xs text-muted-foreground w-[118px] shrink-0">
                  {fmtData(m.dataInicio)} → {fmtData(m.dataFim)}
                </span>
                <Link
                  to="/senado/senadores/$id"
                  params={{ id: String(m.codigo) }}
                  className="font-medium hover:text-accent hover:underline"
                >
                  {m.nome}
                </Link>
                {(m.uf || m.participacao) && (
                  <span className="text-xs text-muted-foreground">
                    {[m.uf, m.participacao].filter(Boolean).join(" · ")}
                  </span>
                )}
                {m.descricaoCausa && <SituacaoBadge situacao={m.descricaoCausa} className="self-center" />}
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

function CardSenador({ d }: { d: SenadorConsulta }) {
  const gasto = useContext(GastoContext).get(d.id);
  return (
    <Link
      to="/senado/senadores/$id"
      params={{ id: String(d.id) }}
      className="border border-border rounded-xl p-4 bg-card hover:border-accent transition-colors flex gap-3 items-start"
    >
      <Foto src={d.urlFoto} nome={d.nome} />
      <div className="flex-1 min-w-0">
        <div className="font-display text-base leading-tight truncate">{d.nome}</div>
        <div className="text-xs text-muted-foreground mt-1">
          {d.siglaPartido ?? "—"} · {d.siglaUf ?? "—"}
        </div>
        {(d.participacao || d.situacao) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {d.participacao && <span className="text-xs text-muted-foreground">{d.participacao}</span>}
            {d.situacao && <SituacaoBadge situacao={d.situacao} />}
          </div>
        )}
        {gasto !== undefined && (
          <div className="text-xs font-mono mt-2 text-foreground">
            {fmtBRL(gasto)} <span className="text-muted-foreground">em CEAPS</span>
          </div>
        )}
      </div>
    </Link>
  );
}

function Grade({ membros }: { membros: SenadorConsulta[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {membros.map((d) => (
        <CardSenador key={`${d.legislatura}-${d.id}`} d={d} />
      ))}
    </div>
  );
}

function TituloLegislatura({ legislatura, total }: { legislatura: number; total: number }) {
  return (
    <>
      <ChevronDown className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
      <span className="font-medium text-sm">
        {legislatura}ª legislatura
        <span className="text-muted-foreground font-normal"> · {anosDaLegislatura(legislatura)}</span>
      </span>
      <span className="ml-auto text-xs text-muted-foreground">{total} senadores</span>
    </>
  );
}

/** Painel de uma legislatura no modo navegação: busca os membros só ao abrir. */
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
  const consultarFn = useServerFn(consultarMembrosSenado);
  const { data = [], isLoading } = useQuery({
    queryKey: ["senado", "membros-leg", legislatura],
    queryFn: () => consultarFn({ data: { legislatura } }),
    enabled: aberto,
  });
  return (
    <Collapsible open={aberto} onOpenChange={setAberto} className="rounded-xl border border-border bg-card">
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
  membros: SenadorConsulta[];
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

function ListaSenadores() {
  const legFn = useServerFn(listarLegislaturasSenado);
  const consultarFn = useServerFn(consultarMembrosSenado);
  const rankFn = useServerFn(rankingGastosSenadores);
  const { data: info, isLoading: infoLoading } = useQuery({
    queryKey: ["senado", "legislaturas"],
    queryFn: () => legFn(),
  });
  const { data: rank } = useQuery({ queryKey: ["senado", "ranking"], queryFn: () => rankFn() });
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
  const participacao = search.participacao ?? "";
  const legislatura = search.legislatura;
  const setFiltro = (patch: Partial<SenadoresSearch>) =>
    navigate({ search: (prev: SenadoresSearch) => ({ ...prev, ...patch }), replace: true });

  const modoResultado = !!(q.trim() || uf || partido || situacao || participacao);
  const legAtual = info?.legAtual;
  const legFoco = legislatura ?? legAtual;

  const filtros = useMemo(
    () => ({
      q: q.trim() || undefined,
      uf: uf || undefined,
      partido: partido || undefined,
      situacao: situacao || undefined,
      participacao: participacao || undefined,
      legislatura,
    }),
    [q, uf, partido, situacao, participacao, legislatura],
  );

  const { data: foco = [], isLoading: focoLoading } = useQuery({
    queryKey: modoResultado
      ? ["senado", "membros-busca", filtros]
      : ["senado", "membros-leg", legFoco],
    queryFn: () => consultarFn({ data: modoResultado ? filtros : { legislatura: legFoco } }),
    enabled: !!info && (modoResultado || legFoco != null),
  });

  const gruposResultado = useMemo(() => {
    const m = new Map<number, SenadorConsulta[]>();
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
      participacao: d.participacao ?? "",
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
            <Link to="/senado" className="hover:text-accent">Senado</Link> · Senadores
          </div>
          <h1 className="font-display text-4xl mt-1">Senadores</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            O mandato de um senador dura <strong className="text-foreground">8 anos</strong> — duas legislaturas.
            Por isso um mesmo senador pode aparecer em duas legislaturas, e cada uma traz seus titulares e suplentes.
            Abra um painel para carregar os membros.
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
            onChange={(e) => setFiltro({ legislatura: e.target.value ? Number(e.target.value) : undefined })}
          >
            <option value="">Todas as legislaturas</option>
            {info?.legislaturas.map((l) => (
              <option key={l.legislatura} value={l.legislatura}>
                {l.legislatura}ª ({anosDaLegislatura(l.legislatura)})
              </option>
            ))}
          </select>
          <select className={selectCls} value={uf} onChange={(e) => setFiltro({ uf: e.target.value || undefined })}>
            <option value="">Todas UFs</option>
            {info?.ufs.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
          <select
            className={selectCls}
            value={partido}
            onChange={(e) => setFiltro({ partido: e.target.value || undefined })}
          >
            <option value="">Todos partidos</option>
            {info?.partidos.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {info && info.participacoes.length > 0 && (
            <select
              className={selectCls}
              value={participacao}
              onChange={(e) => setFiltro({ participacao: e.target.value || undefined })}
            >
              <option value="">Titulares e suplentes</option>
              {info.participacoes.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          )}
          {info && info.situacoes.length > 0 && (
            <select
              className={selectCls}
              value={situacao}
              onChange={(e) => setFiltro({ situacao: e.target.value || undefined })}
            >
              <option value="">Todas as situações</option>
              {info.situacoes.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
          {info && info.situacoes.length > 0 && (
            <span className="text-xs text-muted-foreground">A situação reflete o status atual (legislatura vigente).</span>
          )}
        </div>

        <div className="mt-3 flex flex-wrap justify-end gap-2">
          <BotaoBaixarCsv
            filename="senadores"
            obterLinhas={linhasCsv}
            disabled={foco.length === 0}
            rotulo={
              modoResultado
                ? `Baixar CSV (${foco.length})`
                : `Baixar CSV${legFoco ? ` · ${legFoco}ª` : ""} (${foco.length})`
            }
          />
          <BotaoSalvarBusca
            path="/senado/senadores"
            search={search}
            titulo="Senadores"
            filtros={[
              ["busca", q],
              ["UF", uf],
              ["partido", partido],
              ["participação", participacao],
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
              title="Nenhum senador em cache"
              hint="Um administrador precisa importar o cadastro de senadores pelo painel admin."
            />
          </div>
        ) : modoResultado ? (
          <div className="mt-8 space-y-3">
            {focoLoading ? (
              <p className="text-sm text-muted-foreground">Buscando…</p>
            ) : foco.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum senador com esses filtros.</p>
            ) : (
              gruposResultado.map(([leg, membros], i) => (
                <GrupoResultado key={leg} legislatura={leg} membros={membros} defaultOpen={i === 0} />
              ))
            )}
          </div>
        ) : (
          <div className="mt-8 space-y-3">
            {legFoco != null && <AfastamentosLegislatura legislatura={legFoco} />}
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
