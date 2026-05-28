import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import * as React from "react";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { ensureAdminBeforeLoad } from "@/lib/admin-guard";
import { AdminNav } from "@/components/AdminNav";
import { useDataSource } from "@/lib/data-store";
import { EmptyState } from "@/components/EmptyState";
import { InvestigacaoInline } from "@/components/InvestigacaoInline";

const SEV_MAP = { alta: "critico", media: "aviso", baixa: "info" } as const;

export const Route = createFileRoute("/_authenticated/admin_/sinais")({
  beforeLoad: ensureAdminBeforeLoad,
  component: SinaisAdminPage,
  head: () => ({ meta: [{ title: "Sinais — Admin" }] }),
});

const SEV_ORDER: Record<string, number> = { alta: 0, media: 1, baixa: 2 };
const SEV_STYLES: Record<string, string> = {
  alta: "bg-destructive/10 text-destructive border-destructive/30",
  media: "bg-muted text-foreground border-border",
  baixa: "bg-muted text-muted-foreground border-border",
};

const REGRA_LABEL: Record<string, string> = {
  crescimento_abrupto: "Crescimento abrupto (fornecedor)",
  fracionamento: "Fracionamento de despesa",
  concentracao: "Concentração de fornecedor",
  outlier_valor: "Outlier de valor",
  fornecedor_recente_alto: "Fornecedor recém-chegado",
  descricao_generica: "Descrição genérica",
  dispensa_recorrente: "Dispensa recorrente",
  crescimento_orgao: "Crescimento do órgão",
  transparencia_baixa: "Transparência baixa (ITI)",
};

function anoDeEvidencia(e: Record<string, string | number>) {
  return Number(e.ano ?? e.ano_anterior ?? new Date().getFullYear());
}

function buildCurlsSinal(f: ReturnType<ReturnType<typeof useDataSource>["listAnomalias"]>[number]) {
  if (f.entidadeTipo === "contrato") {
    const id = encodeURIComponent(f.entidadeId);
    return [{
      label: "Endpoint /contratos/id (detalhe oficial)",
      command: `curl -H 'chave-api-dados: $PORTAL_TRANSPARENCIA_API_KEY' -H 'accept: application/json' 'https://api.portaldatransparencia.gov.br/api-de-dados/contratos/id?id=${id}'`,
      nota: "Compare valorInicialCompra e valorFinalCompra. Na CGU JSON, 117560.3000 significa R$ 117.560,30.",
    }];
  }
  if (f.entidadeTipo === "orgao") {
    const ano = anoDeEvidencia(f.evidencia);
    const orgao = encodeURIComponent(f.entidadeId);
    return [{
      label: `Endpoint /contratos do órgão em ${ano}`,
      command: `curl -H 'chave-api-dados: $PORTAL_TRANSPARENCIA_API_KEY' -H 'accept: application/json' 'https://api.portaldatransparencia.gov.br/api-de-dados/contratos?codigoOrgao=${orgao}&dataInicial=01%2F01%2F${ano}&dataFinal=31%2F12%2F${ano}&pagina=1'`,
    }];
  }
  const contratoAlto = f.evidencia.contrato_alto;
  if (contratoAlto) {
    const id = encodeURIComponent(String(contratoAlto));
    return [{
      label: "Endpoint /contratos/id do contrato citado",
      command: `curl -H 'chave-api-dados: $PORTAL_TRANSPARENCIA_API_KEY' -H 'accept: application/json' 'https://api.portaldatransparencia.gov.br/api-de-dados/contratos/id?id=${id}'`,
    }];
  }
  return undefined;
}

function SinaisAdminPage() {
  const ds = useDataSource();
  const all = React.useMemo(
    () =>
      ds
        .listAnomalias()
        .sort(
          (a, b) =>
            (SEV_ORDER[a.severidade] ?? 9) - (SEV_ORDER[b.severidade] ?? 9),
        ),
    [ds],
  );

  const [regraSel, setRegraSel] = React.useState<string | null>(null);
  const [sevSel, setSevSel] = React.useState<string | null>(null);
  const [statusSel, setStatusSel] = React.useState<string>("aberto");

  const filtrados = all.filter(
    (f) =>
      (!regraSel || f.regra === regraSel) &&
      (!sevSel || f.severidade === sevSel),
  );

  const porSev = (s: string) => all.filter((f) => f.severidade === s).length;
  const porRegra = (r: string) => all.filter((f) => f.regra === r).length;
  const regras = Array.from(new Set(all.map((f) => f.regra)));

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 space-y-6">
      <Link
        to="/admin"
        className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
      >
        <ArrowLeft className="size-3.5" /> voltar
      </Link>
      <header>
        <h1 className="font-display text-4xl">Sinais</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Padrões estatísticos detectados pelo heurístico cidadão sobre os
          dados em cache. São <strong>indícios</strong>, não irregularidades —
          a visão pública vive em{" "}
          <Link to="/anomalias" className="underline">
            /anomalias
          </Link>
          . Aqui você prioriza o que merece virar finding investigado em{" "}
          <Link to="/admin/qualidade" className="underline">
            Qualidade
          </Link>
          .
        </p>
      </header>
      <AdminNav />

      <section className="grid sm:grid-cols-4 gap-3">
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Total
          </div>
          <div className="text-2xl font-display mt-1">{all.length}</div>
        </div>
        {(["alta", "media", "baixa"] as const).map((s) => (
          <div key={s} className="rounded-lg border border-border bg-card p-3">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              {s}
            </div>
            <div className="text-2xl font-display mt-1">{porSev(s)}</div>
          </div>
        ))}
      </section>

      <section className="space-y-2">
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="text-[11px] uppercase tracking-widest text-muted-foreground self-center mr-1">
            Severidade
          </span>
          {(["alta", "media", "baixa"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSevSel(sevSel === s ? null : s)}
              className={`px-2.5 py-1 rounded-full border transition ${sevSel === s ? "bg-foreground text-background border-foreground" : "bg-card border-border hover:bg-muted"}`}
            >
              {s} <span className="opacity-60 ml-1">{porSev(s)}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 text-xs items-center">
          <span className="text-[11px] uppercase tracking-widest text-muted-foreground mr-1">
            Status
          </span>
          <select
            className="rounded-md border border-input bg-background px-2 py-1"
            value={statusSel}
            onChange={(e) => setStatusSel(e.target.value)}
          >
            <option value="">Todos os status</option>
            <option value="aberto">Aberto</option>
            <option value="confirmado">Confirmado</option>
            <option value="reportado">Reportado</option>
            <option value="corrigido_origem">Corrigido na origem</option>
            <option value="falso_positivo">Falso positivo</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="text-[11px] uppercase tracking-widest text-muted-foreground self-center mr-1">
            Regra
          </span>
          {regras.map((r) => (
            <button
              key={r}
              onClick={() => setRegraSel(regraSel === r ? null : r)}
              className={`px-2.5 py-1 rounded-full border transition ${regraSel === r ? "bg-accent text-accent-foreground border-accent" : "bg-card border-border hover:bg-muted"}`}
            >
              {REGRA_LABEL[r] ?? r}{" "}
              <span className="opacity-60 ml-1">{porRegra(r)}</span>
            </button>
          ))}
          {(regraSel || sevSel) && (
            <button
              onClick={() => {
                setRegraSel(null);
                setSevSel(null);
              }}
              className="px-2.5 py-1 rounded-full border border-border text-muted-foreground hover:bg-muted"
            >
              limpar
            </button>
          )}
        </div>
      </section>

      <section className="space-y-3">
        {filtrados.length === 0 ? (
          <EmptyState
            title="Nenhum sinal para mostrar"
            hint={
              all.length === 0
                ? "Sem dados reais em cache. Importe contratos em /admin/dados para o detector ter base de cálculo."
                : "Nenhum sinal bate com os filtros atuais."
            }
          />
        ) : (
          filtrados.map((f) => {
            const href =
              f.entidadeTipo === "orgao"
                ? `/orgaos/${f.entidadeId}`
                : f.entidadeTipo === "fornecedor"
                  ? `/fornecedores/${f.entidadeId}`
                  : `/contratos/${f.entidadeId}`;
            return (
              <InvestigacaoInline
                key={f.id}
                statusFilter={statusSel || undefined}
                candidato={{
                  fonte: "cgu",
                  entidade_tipo: f.entidadeTipo,
                  entidade_id: f.entidadeId,
                  regra: f.regra,
                  origem: "sinal",
                  severidade: SEV_MAP[f.severidade],
                  detalhes: {
                    titulo: f.titulo,
                    entidade_nome: f.entidadeNome,
                    evidencia: f.evidencia,
                    explicacao: f.explicacao,
                  },
                }}
                  curls={buildCurlsSinal(f)}
              >
                <div className={`rounded-md -m-4 p-4 ${SEV_STYLES[f.severidade] ?? ""}`}>
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest font-bold">
                        <span>{f.severidade}</span>
                        <span className="opacity-50">·</span>
                        <span>{REGRA_LABEL[f.regra] ?? f.regra}</span>
                      </div>
                      <h3 className="font-display text-lg mt-1 leading-tight text-foreground">
                        {f.titulo}
                      </h3>
                      <p className="text-xs text-foreground/80 mt-1">{f.explicacao}</p>
                      <div className="text-xs text-foreground/80 mt-1">
                        <a
                          href={href}
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold underline underline-offset-2"
                        >
                          {f.entidadeNome}
                        </a>{" "}
                        <span className="text-muted-foreground">
                          · {f.entidadeTipo} {f.entidadeId}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </InvestigacaoInline>
            );
          })
        )}
      </section>
    </div>
  );
}