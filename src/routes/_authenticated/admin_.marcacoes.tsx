import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { ArrowLeft, Trash2, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { ensureAdminBeforeLoad } from "@/lib/admin-guard";
import { AdminNav } from "@/components/AdminNav";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { InvestigacaoInline } from "@/components/InvestigacaoInline";
import {
  listarContestacoesAdmin,
  atualizarContestacao,
  listarMarcacoesAdmin,
  deletarMarcacao,
  agregadoMarcacoes,
} from "@/lib/data/marcacoes.functions";

export const Route = createFileRoute("/_authenticated/admin_/marcacoes")({
  beforeLoad: ensureAdminBeforeLoad,
  component: MarcacoesAdminPage,
  head: () => ({ meta: [{ title: "Marcações — Admin" }] }),
});

const STATUS_CONTESTACAO = ["aberta", "em_analise", "respondida", "arquivada"] as const;
const TIPO_CONTESTACAO_LABEL: Record<string, string> = {
  correcao_factual: "Correção factual",
  dado_desatualizado: "Dado desatualizado",
  pii_exposicao: "Exposição de PII",
  classificacao_inadequada: "Classificação inadequada",
  outro: "Outro",
};

function buildCurlsMarcacao(entidadeTipo: string, entidadeId: string) {
  if (entidadeTipo !== "contrato") return undefined;
  const id = encodeURIComponent(entidadeId);
  return [{
    label: "Endpoint /contratos/id (detalhe oficial)",
    command: `curl -H 'chave-api-dados: $PORTAL_TRANSPARENCIA_API_KEY' -H 'accept: application/json' 'https://api.portaldatransparencia.gov.br/api-de-dados/contratos/id?id=${id}'`,
    nota: "Compare valorInicialCompra e valorFinalCompra. Na CGU JSON, 117560.3000 significa R$ 117.560,30.",
  }];
}

function MarcacoesAdminPage() {
  const qc = useQueryClient();
  const fetchAgg = useServerFn(agregadoMarcacoes);
  const fetchContestacoes = useServerFn(listarContestacoesAdmin);
  const mutContestacao = useServerFn(atualizarContestacao);
  const fetchMarcacoes = useServerFn(listarMarcacoesAdmin);
  const mutDeletar = useServerFn(deletarMarcacao);

  const [aba, setAba] = React.useState<"contestacoes" | "marcacoes">(
    "contestacoes",
  );
  const [statusCt, setStatusCt] = React.useState<string>("aberta");
  const [tipoFlag, setTipoFlag] = React.useState<string>("");
  const [statusFlag, setStatusFlag] = React.useState<string>("aberto");

  const { data: agg } = useQuery({
    queryKey: ["marc-agg"],
    queryFn: () => fetchAgg(),
  });

  const ctsQuery = useQuery({
    queryKey: ["marc-ct", statusCt],
    queryFn: () =>
      fetchContestacoes({
        data: statusCt
          ? { status: statusCt as (typeof STATUS_CONTESTACAO)[number] }
          : {},
      }),
    enabled: aba === "contestacoes",
  });

  const flQuery = useQuery({
    queryKey: ["marc-fl", tipoFlag],
    queryFn: () =>
      fetchMarcacoes({
        data: tipoFlag
          ? { entidade_tipo: tipoFlag as "orgao" | "fornecedor" | "contrato" }
          : {},
      }),
    enabled: aba === "marcacoes",
  });

  const invalidar = () => {
    qc.refetchQueries({ queryKey: ["marc-ct"] });
    qc.refetchQueries({ queryKey: ["marc-fl"] });
    qc.refetchQueries({ queryKey: ["marc-agg"] });
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 space-y-6">
      <Link
        to="/admin"
        className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
      >
        <ArrowLeft className="size-3.5" /> voltar
      </Link>
      <header>
        <h1 className="font-display text-4xl">Marcações</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Curadoria do que a comunidade envia: <strong>contestações</strong>{" "}
          (pedidos formais de correção em páginas do site) e{" "}
          <strong>marcações cidadãs</strong> (flags em órgãos, fornecedores e
          contratos).
        </p>
      </header>
      <AdminNav />

      <section className="grid sm:grid-cols-4 gap-3">
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Contestações abertas
          </div>
          <div className="text-2xl font-display mt-1">
            {agg?.contestacoes.aberta ?? 0}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {agg?.contestacoes.em_analise ?? 0} em análise ·{" "}
            {agg?.contestacoes.respondida ?? 0} respondidas
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Contestações total
          </div>
          <div className="text-2xl font-display mt-1">
            {agg?.contestacoes.total ?? 0}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Marcações cidadãs
          </div>
          <div className="text-2xl font-display mt-1">
            {agg?.marcacoes.total ?? 0}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {agg?.marcacoes.orgao ?? 0} órgãos ·{" "}
            {agg?.marcacoes.fornecedor ?? 0} fornecedores ·{" "}
            {agg?.marcacoes.contrato ?? 0} contratos
          </div>
        </div>
      </section>

      <div className="flex gap-2 border-b border-border">
        {(["contestacoes", "marcacoes"] as const).map((a) => (
          <button
            key={a}
            onClick={() => setAba(a)}
            className={`px-3 py-2 text-sm border-b-2 -mb-px ${aba === a ? "border-accent text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {a === "contestacoes" ? "Contestações" : "Marcações cidadãs"}
          </button>
        ))}
      </div>

      {aba === "contestacoes" ? (
        <section className="space-y-3">
          <div className="flex flex-wrap gap-2 text-xs">
            <select
              className="rounded-md border border-input bg-background px-2 py-1"
              value={statusCt}
              onChange={(e) => setStatusCt(e.target.value)}
            >
              <option value="">Todos os status</option>
              {STATUS_CONTESTACAO.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          {ctsQuery.isLoading ? (
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" /> Carregando…
            </div>
          ) : (ctsQuery.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma contestação nesses filtros.
            </p>
          ) : (
            (ctsQuery.data ?? []).map((c) => (
              <ContestacaoCard
                key={c.id}
                item={c}
                onSalvar={async (status, resposta) => {
                  try {
                    await mutContestacao({
                      data: { id: c.id, status, resposta },
                    });
                    toast.success("Contestação atualizada.");
                    invalidar();
                  } catch (e) {
                    toast.error((e as Error).message);
                  }
                }}
              />
            ))
          )}
        </section>
      ) : (
        <section className="space-y-3">
          <div className="flex flex-wrap gap-2 text-xs">
            <select
              className="rounded-md border border-input bg-background px-2 py-1"
              value={tipoFlag}
              onChange={(e) => setTipoFlag(e.target.value)}
            >
              <option value="">Todos os tipos</option>
              <option value="orgao">órgão</option>
              <option value="fornecedor">fornecedor</option>
              <option value="contrato">contrato</option>
            </select>
            <select
              className="rounded-md border border-input bg-background px-2 py-1"
              value={statusFlag}
              onChange={(e) => setStatusFlag(e.target.value)}
            >
              <option value="">Todos os status</option>
              <option value="aberto">Aberto</option>
              <option value="confirmado">Confirmado</option>
              <option value="reportado">Reportado</option>
              <option value="corrigido_origem">Corrigido na origem</option>
              <option value="falso_positivo">Falso positivo</option>
            </select>
          </div>
          {flQuery.isLoading ? (
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" /> Carregando…
            </div>
          ) : (flQuery.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma marcação nesses filtros.
            </p>
          ) : (
            <div className="space-y-3">
              {(flQuery.data ?? []).map((f) => {
                const href =
                  f.entidade_tipo === "orgao"
                    ? `/orgaos/${f.entidade_id}`
                    : f.entidade_tipo === "fornecedor"
                      ? `/fornecedores/${f.entidade_id}`
                      : `/contratos/${f.entidade_id}`;
                return (
                  <InvestigacaoInline
                    key={f.id}
                    statusFilter={statusFlag || undefined}
                    candidato={{
                      fonte: "cgu",
                      entidade_tipo: f.entidade_tipo,
                      entidade_id: f.entidade_id,
                      regra: `marcacao_${f.tipo}`,
                      origem: "marcacao_cidada",
                      severidade:
                        f.votos_score >= 5
                          ? "critico"
                          : f.votos_score >= 1
                            ? "aviso"
                            : "info",
                      detalhes: {
                        tipo_marcacao: f.tipo,
                        comentario: f.comentario,
                        votos_score: f.votos_score,
                        votos_total: f.votos_total,
                        user_id: f.user_id,
                        criado_em: f.created_at,
                      },
                    }}
                    curls={buildCurlsMarcacao(f.entidade_tipo, f.entidade_id)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] uppercase tracking-wider text-accent font-semibold">
                          {f.tipo} · {f.entidade_tipo}
                        </div>
                        <a
                          href={href}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm underline inline-flex items-center gap-1 mt-0.5"
                        >
                          {f.entidade_id} <ExternalLink className="size-3" />
                        </a>
                        {f.comentario && (
                          <p className="text-sm text-foreground/80 mt-1">
                            {f.comentario}
                          </p>
                        )}
                        <div className="text-[11px] text-muted-foreground mt-1">
                          {new Date(f.created_at).toLocaleString("pt-BR")} ·
                          votos: {f.votos_score >= 0 ? "+" : ""}
                          {f.votos_score} ({f.votos_total})
                        </div>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Remover marcação"
                        onClick={async () => {
                          if (!confirm("Remover esta marcação?")) return;
                          try {
                            await mutDeletar({ data: { id: f.id } });
                            toast.success("Marcação removida.");
                            invalidar();
                          } catch (e) {
                            toast.error((e as Error).message);
                          }
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </InvestigacaoInline>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function ContestacaoCard({
  item,
  onSalvar,
}: {
  item: Awaited<ReturnType<typeof listarContestacoesAdmin>>[number];
  onSalvar: (
    status: (typeof STATUS_CONTESTACAO)[number],
    resposta?: string,
  ) => Promise<void>;
}) {
  const [status, setStatus] = React.useState<(typeof STATUS_CONTESTACAO)[number]>(
    item.status as (typeof STATUS_CONTESTACAO)[number],
  );
  const [resposta, setResposta] = React.useState(item.resposta ?? "");
  const [saving, setSaving] = React.useState(false);

  const dirty = status !== item.status || resposta !== (item.resposta ?? "");

  return (
    <article className="rounded-xl border border-border bg-card p-4 space-y-3">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wider text-accent font-semibold">
            {TIPO_CONTESTACAO_LABEL[item.tipo] ?? item.tipo} ·{" "}
            {item.solicitante_tipo}
          </div>
          <a
            href={item.url_pagina}
            target="_blank"
            rel="noreferrer"
            className="text-sm underline break-all inline-flex items-center gap-1 mt-0.5"
          >
            {item.url_pagina} <ExternalLink className="size-3 shrink-0" />
          </a>
          <div className="text-[11px] text-muted-foreground mt-1">
            recebida em {new Date(item.created_at).toLocaleString("pt-BR")}
            {item.contato ? ` · contato: ${item.contato}` : ""}
          </div>
        </div>
        <span className="text-[11px] uppercase tracking-wider px-2 py-0.5 rounded-full border border-border bg-muted">
          {item.status}
        </span>
      </header>

      <div>
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
          Descrição
        </div>
        <p className="text-sm whitespace-pre-wrap">{item.descricao}</p>
      </div>
      {item.fundamento && (
        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
            Fundamento
          </div>
          <p className="text-sm whitespace-pre-wrap text-foreground/80">
            {item.fundamento}
          </p>
        </div>
      )}

      <div className="grid sm:grid-cols-[160px_1fr] gap-3 pt-2 border-t border-border">
        <div>
          <label className="text-[11px] uppercase tracking-wider text-muted-foreground block mb-1">
            Status
          </label>
          <select
            className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
            value={status}
            onChange={(e) =>
              setStatus(e.target.value as (typeof STATUS_CONTESTACAO)[number])
            }
          >
            {STATUS_CONTESTACAO.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-wider text-muted-foreground block mb-1">
            Resposta (opcional — vai pro solicitante quando responder)
          </label>
          <Textarea
            value={resposta}
            onChange={(e) => setResposta(e.target.value)}
            rows={3}
            maxLength={8000}
            placeholder="Resposta pública à contestação…"
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] text-muted-foreground">
          {item.respondido_em
            ? `respondida em ${new Date(item.respondido_em).toLocaleString("pt-BR")}`
            : "sem resposta registrada"}
        </div>
        <Button
          size="sm"
          disabled={!dirty || saving}
          onClick={async () => {
            setSaving(true);
            try {
              await onSalvar(status, resposta);
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? <Loader2 className="size-3.5 animate-spin" /> : "Salvar"}
        </Button>
      </div>
    </article>
  );
}