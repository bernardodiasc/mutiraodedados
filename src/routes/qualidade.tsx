import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import * as React from "react";
import { ExternalLink } from "lucide-react";
import {
  listarQualidadePublico,
  agregadoQualidade,
} from "@/lib/data/qa.functions";

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
};

function fmtBRL(n?: number | null) {
  if (n == null) return "—";
  return Number(n).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function QualidadePage() {
  const fetchAgg = useServerFn(agregadoQualidade);
  const fetchList = useServerFn(listarQualidadePublico);
  const [fonte, setFonte] = React.useState<string | undefined>();
  const [status, setStatus] = React.useState<string | undefined>();

  const { data: agg = [] } = useQuery({
    queryKey: ["qa-agg-pub"],
    queryFn: () => fetchAgg(),
    staleTime: 60_000,
  });
  const { data: findings = [], isLoading } = useQuery({
    queryKey: ["qa-list-pub", fonte, status],
    queryFn: () => fetchList({ data: { fonte, status, limit: 200 } }),
    staleTime: 60_000,
  });

  const totais = agg.reduce(
    (acc, a) => {
      acc.abertos += a.abertos;
      acc.confirmados += a.confirmados;
      acc.reportados += a.reportados;
      acc.corrigidos += a.corrigidos;
      return acc;
    },
    { abertos: 0, confirmados: 0, reportados: 0, corrigidos: 0 },
  );

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

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Metric label="Abertas" value={totais.abertos} />
        <Metric label="Confirmadas" value={totais.confirmados} />
        <Metric label="Reportadas" value={totais.reportados} />
        <Metric label="Corrigidas na origem" value={totais.corrigidos} />
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select
            className="rounded-md border border-input bg-background px-2 py-1"
            value={fonte ?? ""}
            onChange={(e) => setFonte(e.target.value || undefined)}
          >
            <option value="">Todas as fontes</option>
            {FONTES.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
          <select
            className="rounded-md border border-input bg-background px-2 py-1"
            value={status ?? ""}
            onChange={(e) => setStatus(e.target.value || undefined)}
          >
            <option value="">Todos os status</option>
            <option value="aberto">Aberto</option>
            <option value="confirmado">Confirmado</option>
            <option value="reportado">Reportado ao órgão</option>
            <option value="corrigido_origem">Corrigido na origem</option>
            <option value="corrigido_automaticamente">Corrigido automaticamente</option>
            <option value="falso_positivo">Falso positivo</option>
          </select>
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

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="font-display text-3xl mt-1">{value}</div>
    </div>
  );
}