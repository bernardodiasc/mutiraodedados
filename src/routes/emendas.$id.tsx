import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft } from "lucide-react";
import { getEmendaPorId } from "@/lib/data/real/queries.functions";
import { BotaoCopiar } from "@/components/BotaoCopiar";
import { BotaoFonteOficial } from "@/components/BotaoFonteOficial";
import { BotaoSalvarItem } from "@/components/BotaoSalvarItem";
import { textoCopiavelDeEntidade } from "@/lib/itens-salvos/logic";
import { QualidadeBanner } from "@/components/QualidadeBanner";
import { fmtBRL } from "@/lib/fmt";

export const Route = createFileRoute("/emendas/$id")({
  component: EmendaDetalhe,
  head: () => ({ meta: [{ title: "Emenda parlamentar — Auditoria Cidadã" }] }),
});

function EmendaDetalhe() {
  const { id } = useParams({ from: "/emendas/$id" });
  const fetchFn = useServerFn(getEmendaPorId);
  const { data, isLoading } = useQuery({
    queryKey: ["emenda", id],
    queryFn: () => fetchFn({ data: { id } }),
  });

  if (isLoading)
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-sm text-muted-foreground">Carregando…</div>
    );
  const e = data?.emenda;
  if (!e)
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Link
          to="/emendas"
          className="text-xs text-muted-foreground inline-flex items-center gap-1"
        >
          <ArrowLeft className="size-3.5" /> voltar
        </Link>
        <h1 className="font-display text-3xl mt-3">Emenda não encontrada</h1>
        <p className="text-sm text-muted-foreground mt-2">
          O código <code>{id}</code> não está no cache local.
        </p>
      </div>
    );

  return (
    <article className="mx-auto max-w-4xl px-4 py-10 space-y-6">
      <Link to="/emendas" className="text-xs text-muted-foreground inline-flex items-center gap-1">
        <ArrowLeft className="size-3.5" /> voltar
      </Link>
      <header>
        <div className="text-xs uppercase tracking-wider text-accent">
          {e.tipo_emenda ?? "Emenda parlamentar"}
        </div>
        <h1 className="font-display text-3xl mt-1">{e.autor ?? "Emenda"}</h1>
        <p className="text-xs font-mono text-muted-foreground mt-1">
          código {e.id} · nº {e.numero_emenda ?? "—"} · {e.ano}
        </p>
        {e.url_oficial && (
          <div className="mt-2">
            <BotaoFonteOficial href={e.url_oficial} />
          </div>
        )}
      </header>

      <div className="flex flex-wrap gap-2">
      <BotaoCopiar
        obterTexto={() =>
          textoCopiavelDeEntidade(
            `Emenda ${e.id} — ${e.autor ?? "autor não identificado"} (${e.ano})`,
            e.url_oficial,
            e,
          )
        }
        rotulo="Copiar dados"
        mensagemToast="Dados da emenda copiados — cole na sua IA"
      />
      <BotaoSalvarItem
        entidadeTipo="emenda"
        entidadeId={e.id}
        titulo={`${e.autor ?? "Emenda"} · nº ${e.numero_emenda ?? e.id} (${e.ano})`}
        url={`/emendas/${encodeURIComponent(e.id)}`}
        contexto={[e.tipo_emenda, e.localidade, e.funcao].filter(Boolean).join(" · ")}
        snapshotDe={e}
      />
      </div>

      <QualidadeBanner fonte="cgu_emendas" entidadeTipo="emenda" entidadeId={e.id} />

      {/* As três fases da despesa (o "DNA" do gasto). */}
      <div className="grid sm:grid-cols-3 gap-4">
        <Card title="Empenhado (reserva)">{fmtBRL(e.valor_empenhado)}</Card>
        <Card title="Liquidado (atestado)">{fmtBRL(e.valor_liquidado)}</Card>
        <Card title="Pago (saída)">{fmtBRL(e.valor_pago)}</Card>
      </div>

      <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
        <Field label="Autor" value={e.autor} />
        <Field label="Localidade do gasto" value={e.localidade} />
        <Field label="Função" value={e.funcao} />
        <Field label="Subfunção" value={e.subfuncao} />
        <Field label="Restos a pagar inscritos" value={fmtBRL(e.valor_resto_inscrito)} />
        <Field label="Restos a pagar pagos" value={fmtBRL(e.valor_resto_pago)} />
        <Field label="Restos cancelados" value={fmtBRL(e.valor_resto_cancelado)} />
      </dl>

      {/* Detalhe de execução das Transferências Especiais (EC 105), vindo da API
          do Transferegov e juntado na ingestão. Só aparece quando há plano de ação. */}
      {e.planos_acao_count != null && (
        <section className="space-y-3 rounded-2xl border border-border bg-muted/20 p-5">
          <h2 className="font-display text-xl flex items-center gap-2">
            Transferência Especial — plano de ação{" "}
            <span className="text-xs font-normal text-muted-foreground">(Transferegov)</span>
          </h2>
          <div className="grid sm:grid-cols-3 gap-4">
            <Card title="Custeio">{fmtBRL(e.valor_custeio ?? 0)}</Card>
            <Card title="Investimento">{fmtBRL(e.valor_investimento ?? 0)}</Card>
            <Card title="Planos de ação">{String(e.planos_acao_count)}</Card>
          </div>
          <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <Field label="Situação do plano" value={e.plano_acao_situacao} />
            <Field label="Beneficiário" value={e.beneficiario_nome} />
            <Field label="CNPJ do beneficiário" value={e.beneficiario_cnpj} />
            <Field label="Áreas de política pública" value={e.areas_politicas} />
          </dl>
        </section>
      )}

      <p className="text-[11px] text-muted-foreground border-t border-border pt-4">
        Dados do endpoint <code>/emendas</code> do Portal da Transparência (CGU). Um valor empenhado
        é apenas uma reserva; só o pagamento prova que o dinheiro saiu do caixa público. O detalhe
        do plano de ação das Transferências Especiais vem da API do Transferegov, juntado pelo
        código da emenda na ingestão.
      </p>
    </article>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-border rounded-xl p-5 bg-card">
      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">{title}</div>
      <div className="font-display text-2xl">{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value ?? "—"}</dd>
    </div>
  );
}
