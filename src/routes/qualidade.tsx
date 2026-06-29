import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import * as React from "react";
import { ExternalLink } from "lucide-react";
import {
  listarQualidadePublico,
  agregadoQualidade,
  STATUS_QA,
} from "@/lib/data/qa.functions";
import { REGRAS_QA } from "@/lib/admin-qualidade/logic";

export const Route = createFileRoute("/qualidade")({
  component: QualidadePage,
  head: () => ({
    meta: [
      { title: "Qualidade dos dados — Auditoria Cidadã" },
      {
        name: "description",
        content:
          "Inconsistências detectadas nas bases públicas, revalidadas contra a fonte oficial e, quando confirmadas, reportadas ao órgão responsável.",
      },
      {
        property: "og:title",
        content: "Qualidade dos dados — Auditoria Cidadã",
      },
      {
        property: "og:description",
        content:
          "Acompanhe os defeitos detectados nas APIs do governo: o que está aberto, o que já foi reportado e o que foi corrigido na origem.",
      },
    ],
  }),
});

const FONTES = [
  "cgu",
  "pncp",
  "camara_ceap",
  "senado_ceaps",
  "transferegov",
  "siconfi",
] as const;

const SEV_COLOR: Record<string, string> = {
  critico: "bg-destructive/15 text-destructive",
  aviso: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  info: "bg-muted text-muted-foreground",
};

const STATUS_LABEL: Record<string, string> = {
  aberto: "Aberto",
  confirmado: "Confirmado",
  reportado: "Reportado ao órgão",
  corrigido_origem: "Corrigido na origem",
  corrigido_automaticamente: "Corrigido automaticamente",
  falso_positivo: "Falso positivo",
  wontfix: "Não será corrigido",
};

function fmtBRL(n?: number | null) {
  if (n == null) return "—";
  return Number(n).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

const EMPTY_AGG = {
  fontes: [] as { fonte: string }[],
  regras: [] as string[],
  porFonte: {} as Record<string, number>,
  porStatus: {} as Record<string, number>,
  porRegra: {} as Record<string, number>,
};

function toggleSet(prev: Set<string>, v: string): Set<string> {
  const n = new Set(prev);
  if (n.has(v)) n.delete(v);
  else n.add(v);
  return n;
}

function QualidadePage() {
  const fetchAgg = useServerFn(agregadoQualidade);
  const fetchList = useServerFn(listarQualidadePublico);
  // Multi-seleção por grupo: cada filtro é um conjunto; os 3 combinam em E.
  const [fontesSel, setFontesSel] = React.useState<Set<string>>(new Set());
  const [statusSel, setStatusSel] = React.useState<Set<string>>(new Set());
  const [regrasSel, setRegrasSel] = React.useState<Set<string>>(new Set());

  const { data: aggData = EMPTY_AGG } = useQuery({
    queryKey: ["qa-agg-pub"],
    queryFn: () => fetchAgg(),
    staleTime: 60_000,
  });
  const fontesArr = [...fontesSel];
  const statusArr = [...statusSel];
  const regrasArr = [...regrasSel];
  const { data: findings = [], isLoading } = useQuery({
    queryKey: ["qa-list-pub", fontesArr.join(","), statusArr.join(","), regrasArr.join(",")],
    queryFn: () =>
      fetchList({
        data: { fontes: fontesArr, statuses: statusArr, regras: regrasArr, limit: 200 },
      }),
    staleTime: 60_000,
  });

  // Regras a exibir: a lista canônica + quaisquer regras vistas no agregado
  // (cobre regras legadas ainda presentes no banco).
  const regrasAll = Array.from(
    new Set<string>([...REGRAS_QA, ...Object.keys(aggData.porRegra)]),
  );
  const algumFiltro = fontesSel.size + statusSel.size + regrasSel.size > 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 space-y-10">
      <header>
        <span className="inline-block text-xs font-semibold tracking-widest text-accent uppercase">
          Transparência da plataforma
        </span>
        <h1 className="font-display text-5xl leading-[0.95] mt-2">
          Qualidade dos dados
        </h1>
        <p className="mt-6 text-lg text-muted-foreground max-w-3xl">
          Inconsistências nas bases públicas são detectadas automaticamente
          durante a importação dos dados. Em seguida, nossa equipe revalida
          manualmente cada suspeita contra a API oficial e, quando o defeito
          está na fonte, reporta ao órgão responsável. Esta página é o
          registro público desse processo — o objetivo é que ela fique vazia.
        </p>
        <div className="mt-6 rounded-lg border border-border bg-card/50 p-4 text-sm text-muted-foreground max-w-3xl space-y-2">
          <p>
            Esta verificação faz parte do processo automatizado de{" "}
            <Link to="/cobertura" className="text-accent underline">
              cobertura
            </Link>{" "}
            — acompanhe ali quais bases já foram ingeridas e em que período.
          </p>
          <p>
            Aqui tratamos apenas de <strong>falhas técnicas</strong> nos dados
            (valores corrompidos, campos ausentes, divergências com a fonte).
            Suspeitas sobre o <em>uso</em> de verba pública — sinais
            investigativos — ficam em{" "}
            <Link to="/anomalias" className="text-accent underline">
              /anomalias
            </Link>
            .
          </p>
          <p>
            Encontrou algo que parece errado e não está listado? Cidadãos podem{" "}
            <Link to="/contestar" className="text-accent underline">
              contestar um registro
            </Link>{" "}
            ou registrar uma{" "}
            <Link to="/minhas-marcacoes" className="text-accent underline">
              marcação cidadã
            </Link>
            .
          </p>
        </div>
      </header>

      <details className="rounded-lg border border-border bg-card/50 text-sm">
        <summary className="cursor-pointer list-none px-4 py-3 font-medium flex items-center gap-2 hover:text-foreground text-muted-foreground">
          <span className="text-accent">＋</span> Como ler esta página: regras, status e o processo
        </summary>
        <div className="px-4 pb-5 pt-1 space-y-5 text-muted-foreground">
          <div>
            <p>
              Cada <strong>suspeita</strong> nasce de uma <strong>regra</strong> aplicada na importação
              (só com o dado em cache), passa por uma <strong>re-checagem</strong> contra a API oficial
              e, se o defeito for real e estiver na fonte, é <strong>reportada</strong> ao órgão.
            </p>
          </div>

          <div>
            <h3 className="font-medium text-foreground mb-1.5">Regras de contratos (Portal CGU)</h3>
            <p className="mb-1.5">
              A importação cruza a <strong>listagem</strong> com o <strong>detalhe</strong>
              (<code>/contratos/id</code>) de cada contrato. O bug de escala (÷10.000) aparece
              em qualquer um dos dois endpoints, então gravamos sempre o valor
              <strong> não-truncado</strong>, que bate com o documento oficial.
            </p>
            <ul className="space-y-1.5">
              <li><code>valor_corrigido_listagem</code> — a fonte trouxe o valor truncado por escala; foi <strong>corrigido automaticamente</strong> no site com o valor não-truncado. O alerta fica como registro do defeito da fonte.</li>
              <li><code>fornecedor_ausente</code> — a API não informou o CNPJ/CPF do fornecedor (sigiloso ou ausente). O contrato é salvo mesmo assim, para investigação.</li>
              <li><code>discrepancia_extrema_inicial_final</code> — valor inicial ≥ 1000× o final (ou vice-versa): provável erro de digitação/escala em um dos campos.</li>
              <li><code>valor_muito_baixo</code> — valor oficial &lt; R$100: pode ser um contrato pequeno real <em>ou</em> um defeito persistente na própria fonte. A re-checagem desambigua.</li>
            </ul>
          </div>

          <div>
            <h3 className="font-medium text-foreground mb-1.5">Regras de outras fontes (PNCP, Transferegov, SICONFI, Câmara)</h3>
            <ul className="space-y-1.5">
              <li><code>valor_global_zerado</code> / <code>valor_global_menor_inicial</code> — valor global do contrato zerado ou menor que o inicial (PNCP).</li>
              <li><code>repasse_maior_global</code> — repasse maior que o valor global do convênio (Transferegov).</li>
              <li><code>pago_maior_empenhado</code> — valor pago maior que o empenhado.</li>
              <li><code>liquido_maior_documento</code> — valor líquido maior que o do documento (cota parlamentar).</li>
              <li><code>valor_negativo</code> / <code>valor_negativo_em_conta_positiva</code> — valor negativo onde não deveria haver (SICONFI).</li>
              <li><code>valor_truncado_suspeito</code> — valor possivelmente truncado em outras fontes.</li>
            </ul>
          </div>

          <div>
            <h3 className="font-medium text-foreground mb-1.5">Status</h3>
            <ul className="space-y-1.5">
              <li><strong>Aberto</strong> — detectado, ainda não analisado.</li>
              <li><strong>Confirmado</strong> — re-checado contra a fonte oficial; a divergência é real.</li>
              <li><strong>Reportado</strong> — encaminhado ao órgão responsável.</li>
              <li><strong>Corrigido na origem</strong> — a fonte oficial corrigiu o dado numa reimportação posterior (a API passou a devolver o valor certo).</li>
              <li><strong>Corrigido automaticamente</strong> — a nossa conferência por detalhe corrigiu o valor no site (a fonte ainda não corrigiu); o alerta fica como registro do defeito.</li>
              <li><strong>Falso positivo</strong> — analisado e descartado: não havia defeito.</li>
              <li><strong>Wontfix</strong> — defeito conhecido que, por decisão, não será tratado.</li>
            </ul>
          </div>
        </div>
      </details>

      <section className="space-y-3">
        <div className="rounded-xl border border-border bg-card/50 p-3 space-y-2.5">
          <FilterGroup
            titulo="Fontes"
            itens={FONTES.map((f) => ({ valor: f, rotulo: f }))}
            counts={aggData.porFonte}
            sel={fontesSel}
            onToggle={(v) => setFontesSel((s) => toggleSet(s, v))}
          />
          <FilterGroup
            titulo="Status"
            itens={STATUS_QA.map((s) => ({ valor: s, rotulo: STATUS_LABEL[s] ?? s }))}
            counts={aggData.porStatus}
            sel={statusSel}
            onToggle={(v) => setStatusSel((s) => toggleSet(s, v))}
          />
          <FilterGroup
            titulo="Regras"
            itens={regrasAll.map((r) => ({ valor: r, rotulo: r }))}
            counts={aggData.porRegra}
            sel={regrasSel}
            onToggle={(v) => setRegrasSel((s) => toggleSet(s, v))}
            mono
          />
          {algumFiltro && (
            <button
              type="button"
              className="text-[11px] text-accent underline"
              onClick={() => {
                setFontesSel(new Set());
                setStatusSel(new Set());
                setRegrasSel(new Set());
              }}
            >
              Limpar filtros
            </button>
          )}
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : findings.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum defeito com esses filtros.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {findings.map((f) => (
              <li key={f.id} className="p-4">
                <div className="block -m-4 p-4 rounded-md">
                  <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wider">
                    <span className={`px-1.5 py-0.5 rounded ${SEV_COLOR[f.severidade]}`}>
                      {f.severidade}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-accent/15 text-accent">
                      {STATUS_LABEL[f.status] ?? f.status}
                    </span>
                    <span className="text-muted-foreground">· {f.fonte}</span>
                    <div className="ml-auto flex flex-col items-end gap-1 normal-case tracking-normal">
                      <span
                        className="text-muted-foreground"
                        title="Data em que esta inconsistência foi detectada — não é a data do contrato"
                      >
                        Aviso emitido em{" "}
                        {new Date(f.detectado_em).toLocaleDateString("pt-BR")}
                      </span>
                      <div className="flex flex-col items-end gap-0.5 text-[11px]">
                        {f.entidade.url_interno && (
                          <a
                            href={f.entidade.url_interno}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="text-accent inline-flex items-center gap-1"
                          >
                            Registro interno <ExternalLink className="size-3" />
                          </a>
                        )}
                        {f.entidade.url_oficial && (
                          <a
                            href={f.entidade.url_oficial}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="text-accent inline-flex items-center gap-1"
                          >
                            Fonte oficial <ExternalLink className="size-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 text-sm">
                    <span className="font-medium">{f.entidade.tipo}</span>{" "}
                    <code className="text-xs">{f.entidade.id}</code>{" "}
                    <span className="text-muted-foreground">— {f.regra}</span>
                  </div>
                  {f.comparacao && (
                    <div className="mt-1 text-xs text-muted-foreground font-mono">
                      {f.comparacao.armazenadoLabel ?? "armazenado"} {fmtBRL(f.comparacao.armazenado)} → {f.comparacao.esperadoLabel ?? "esperado"}{" "}
                      {fmtBRL(f.comparacao.esperado)}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function FilterGroup({
  titulo,
  itens,
  counts,
  sel,
  onToggle,
  mono,
}: {
  titulo: string;
  itens: Array<{ valor: string; rotulo: string }>;
  counts: Record<string, number>;
  sel: Set<string>;
  onToggle: (v: string) => void;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground w-12 shrink-0">
        {titulo}
      </span>
      {itens.map((it) => {
        const n = counts[it.valor] ?? 0;
        const ativo = sel.has(it.valor);
        return (
          <button
            key={it.valor}
            type="button"
            onClick={() => onToggle(it.valor)}
            className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] transition-colors ${
              ativo
                ? "border-accent bg-accent/15 text-accent"
                : "border-border bg-background text-muted-foreground hover:border-accent/50"
            } ${n === 0 && !ativo ? "opacity-50" : ""}`}
          >
            <span className={mono ? "font-mono" : ""}>{it.rotulo}</span>
            <span className={`rounded px-1 tabular-nums ${ativo ? "bg-accent/20" : "bg-muted"}`}>
              {n}
            </span>
          </button>
        );
      })}
    </div>
  );
}