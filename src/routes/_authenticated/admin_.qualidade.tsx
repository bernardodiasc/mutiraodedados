import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { ensureAdminBeforeLoad } from "@/lib/admin-guard";
import { AdminNav } from "@/components/AdminNav";
import { Button } from "@/components/ui/button";
import { AnomaliaInvestigacao } from "@/components/AnomaliaInvestigacao";
import {
  listarQualidadeAdmin,
  agregadoQualidade,
  marcarStatusFinding,
  salvarReporteFinding,
  salvarNotaFinding,
  revalidarFindingCgu,
  aplicarHeuristicasFonte,
} from "@/lib/data/qa.functions";

export const Route = createFileRoute("/_authenticated/admin_/qualidade")({
  beforeLoad: ensureAdminBeforeLoad,
  component: QualidadeAdminPage,
  head: () => ({ meta: [{ title: "Qualidade dos dados — Admin" }] }),
});

const FONTES = ["cgu", "pncp", "camara_ceap", "senado_ceaps", "transferegov", "siconfi"] as const;

type FindingAdmin = Awaited<ReturnType<typeof listarQualidadeAdmin>>[number];

function isoToBR(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function buildCurls(f: FindingAdmin) {
  if (f.fonte === "cgu" && f.entidade.tipo === "contrato") {
  const id = encodeURIComponent(f.entidade.id);
  const out: Array<{ label: string; command: string; nota?: string }> = [];

  const ctx = f.contexto_origem;
  if (ctx?.orgao_cod && ctx.data_assinatura) {
    const dia = isoToBR(ctx.data_assinatura);
    const orgao = encodeURIComponent(ctx.orgao_cod);
    // O endpoint /contratos não filtra por id; usamos a janela do dia da
    // assinatura para localizar o registro com o valor (errado) que entrou no cache.
    out.push({
      label: "Endpoint /contratos (origem do valor armazenado)",
      command: `curl -H 'chave-api-dados: $PORTAL_TRANSPARENCIA_API_KEY' -H 'accept: application/json' 'https://api.portaldatransparencia.gov.br/api-de-dados/contratos?codigoOrgao=${orgao}&dataInicial=${encodeURIComponent(dia)}&dataFinal=${encodeURIComponent(dia)}&pagina=1'`,
      nota: `Procure o item com id=${f.entidade.id}. Este é o endpoint de listagem que populou o cache — o valor que aparece aqui é o que está errado.`,
    });
  }
  out.push({
    label: "Endpoint /contratos/id (re-checagem)",
    command: `curl -H 'chave-api-dados: $PORTAL_TRANSPARENCIA_API_KEY' -H 'accept: application/json' 'https://api.portaldatransparencia.gov.br/api-de-dados/contratos/id?id=${id}'`,
    nota: "Endpoint de detalhe que usamos pra confirmar o valor correto. Compare valorInicialCompra e valorFinalCompra.",
  });
  return out;
  }
  if (f.fonte === "transferegov" && f.entidade.tipo === "instrumento") {
    const id = encodeURIComponent(f.entidade.id);
    const out: Array<{ label: string; command: string; nota?: string }> = [];
    const ctx = f.contexto_instrumento;
    if (ctx?.data_assinatura) {
      const dia = isoToBR(ctx.data_assinatura);
      const params: string[] = [
        `dataInicial=${encodeURIComponent(dia)}`,
        `dataFinal=${encodeURIComponent(dia)}`,
        `pagina=1`,
      ];
      if (ctx.municipio_ibge) params.push(`codigoIBGE=${encodeURIComponent(ctx.municipio_ibge)}`);
      else if (ctx.uf_beneficiario) params.push(`codigoUFConvenente=${encodeURIComponent(ctx.uf_beneficiario)}`);
      out.push({
        label: "Endpoint /convenios (origem do valor armazenado)",
        command: `curl -H 'chave-api-dados: $PORTAL_TRANSPARENCIA_API_KEY' -H 'accept: application/json' 'https://api.portaldatransparencia.gov.br/api-de-dados/convenios?${params.join("&")}'`,
        nota: `Procure o item com id=${f.entidade.id}. Esta é a listagem que populou o cache — o ingest agora detecta valores suspeitos aqui e re-checa contra o detalhe automaticamente.`,
      });
    }
    out.push({
      label: "Endpoint /convenios/id (re-checagem)",
      command: `curl -H 'chave-api-dados: $PORTAL_TRANSPARENCIA_API_KEY' -H 'accept: application/json' 'https://api.portaldatransparencia.gov.br/api-de-dados/convenios/id?id=${id}'`,
      nota: "Endpoint oficial de detalhe. Compare 'valor', 'valorLiberado' e 'valorContrapartida' com o que está no card.",
    });
    return out;
  }
  if (f.fonte === "transferegov" && f.entidade.tipo === "emenda") {
    const ctx = f.contexto_emenda;
    if (!ctx?.codigo_emenda && !ctx?.numero_emenda) return undefined;
    const cod = encodeURIComponent(ctx.codigo_emenda ?? ctx.numero_emenda ?? "");
    return [
      {
        label: "Endpoint /emendas (consulta pública)",
        command: `curl -H 'accept: application/json' 'https://portaldatransparencia.gov.br/emendas/consulta/resultado?ordenarPor=ano&direcao=desc&codigoEmenda=${cod}'`,
        nota: "A API pública de emendas não exige chave. Compare 'valor' e 'valorPago' com o que está no card.",
      },
    ];
  }
  return undefined;
}

function QualidadeAdminPage() {
  const qc = useQueryClient();
  const fetchList = useServerFn(listarQualidadeAdmin);
  const fetchAgg = useServerFn(agregadoQualidade);
  const mutStatus = useServerFn(marcarStatusFinding);
  const mutReporte = useServerFn(salvarReporteFinding);
  const mutNota = useServerFn(salvarNotaFinding);
  const mutRevalUm = useServerFn(revalidarFindingCgu);
  const mutHeur = useServerFn(aplicarHeuristicasFonte);

  const [fonte, setFonte] = React.useState<string | undefined>(undefined);
  const [status, setStatus] = React.useState<string | undefined>("aberto");
  const [busy, setBusy] = React.useState(false);

  const { data: agg = [] } = useQuery({ queryKey: ["qa-agg"], queryFn: () => fetchAgg() });
  const { data: findings = [], isLoading } = useQuery({
    queryKey: ["qa-list", fonte, status],
    queryFn: () => fetchList({ data: { fonte, status, limit: 200 } }),
  });

  const invalidar = () => {
    qc.refetchQueries({ queryKey: ["qa-list"] });
    qc.refetchQueries({ queryKey: ["qa-agg"] });
  };

  const runHeuristicas = async (f: (typeof FONTES)[number]) => {
    setBusy(true);
    try {
      const r = await mutHeur({ data: { fonte: f } });
      toast.success(`${f}: ${r.novos} novas suspeitas (${r.totalAnalisado} registros analisados).`);
      invalidar();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 space-y-6">
      <Link to="/admin" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
        <ArrowLeft className="size-3.5" /> voltar
      </Link>
      <header>
        <h1 className="font-display text-4xl">Qualidade dos dados</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Defeitos detectados nas bases ingeridas. Cada suspeita é investigada, re-checada contra a
          fonte oficial e, quando confirmada como erro da origem, reportada ao órgão responsável.
        </p>
      </header>
      <AdminNav />

      <section className="grid sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {FONTES.map((f) => {
          const a = agg.find((x) => x.fonte === f);
          return (
            <div key={f} className="rounded-lg border border-border bg-card p-3">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">{f}</div>
              <div className="text-2xl font-display mt-1">{a?.abertos ?? 0}</div>
              <div className="text-[11px] text-muted-foreground" title="abertas · confirmadas (divergência real) · reportadas ao órgão · corrigidas na origem">
                {a?.confirmados ?? 0} confirmadas · {a?.reportados ?? 0} reportadas · {a?.corrigidos ?? 0} corrigidas
              </div>
            </div>
          );
        })}
      </section>

      <section className="rounded-xl border border-border bg-card/50 p-4 space-y-4">
          <div>
            <h2 className="font-display text-lg">Ações em lote</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Aplique as heurísticas em cada fonte para detectar suspeitas usando só os
              dados em cache (rápido, sem chamar API externa). A re-checagem contra a
              fonte oficial é feita item-a-item, dentro de cada suspeita abaixo.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {FONTES.map((f) => (
                <Button
                  key={f}
                  size="sm"
                  variant="outline"
                  onClick={() => runHeuristicas(f)}
                  disabled={busy}
                >
                  Detectar em {f}
                </Button>
              ))}
            </div>
          </div>
        </section>

      <section className="space-y-3">
        <div className="flex flex-wrap gap-2 text-xs">
          <select
            className="rounded-md border border-input bg-background px-2 py-1"
            value={fonte ?? ""}
            onChange={(e) => setFonte(e.target.value || undefined)}
          >
            <option value="">Todas as fontes</option>
            {FONTES.map((f) => (
              <option key={f} value={f}>{f}</option>
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
            <option value="reportado">Reportado</option>
            <option value="corrigido_origem">Corrigido na origem</option>
            <option value="corrigido_automaticamente">Corrigido automaticamente</option>
            <option value="falso_positivo">Falso positivo</option>
          </select>
        </div>

        {isLoading ? (
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" /> Carregando…
          </div>
        ) : findings.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma suspeita com esses filtros.</p>
        ) : (
          <div className="space-y-3">
            {findings.map((f) => (
              <AnomaliaInvestigacao
                key={f.id}
                anomalia={f}
                notaInicial={f.notas_admin ?? null}
                curls={buildCurls(f)}
                actions={{
                  onRevalidar:
                    f.fonte === "cgu"
                      ? async () => {
                          const r = await mutRevalUm({ data: { id: f.id } });
                          if (r.resultado === "confirmado") {
                            toast.success(
                              `Divergência confirmada: cache R$${r.valor_armazenado} → Portal R$${r.valor_detalhe}. Cache corrigido.`,
                            );
                          } else {
                            toast.message(
                              `Falso positivo: Portal retorna R$${r.valor_detalhe}, coincide com o cache.`,
                            );
                          }
                          invalidar();
                        }
                      : undefined,
                  onReportar: async (canal, protocolo) => {
                    await mutReporte({ data: { id: f.id, canal, protocolo: protocolo || undefined } });
                    invalidar();
                  },
                  onConfirmar: async () => {
                    await mutStatus({ data: { id: f.id, status: "confirmado" } });
                    invalidar();
                  },
                  onMarcarCorrigido: async () => {
                    await mutStatus({ data: { id: f.id, status: "corrigido_origem" } });
                    invalidar();
                  },
                  onMarcarFalsoPositivo: async () => {
                    await mutStatus({ data: { id: f.id, status: "falso_positivo" } });
                    invalidar();
                  },
                  onSalvarNota: async (nota) => {
                    await mutNota({ data: { id: f.id, nota } });
                    invalidar();
                  },
                }}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}