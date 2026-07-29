import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { getLicitacaoPorId } from "@/lib/data/real/queries.functions";
import { BotaoCopiar } from "@/components/BotaoCopiar";
import { BotaoFonteOficial } from "@/components/BotaoFonteOficial";
import { BotaoSalvarItem } from "@/components/BotaoSalvarItem";
import { textoCopiavelDeEntidade } from "@/lib/itens-salvos/logic";
import { QualidadeBanner } from "@/components/QualidadeBanner";
import { fmtBRL } from "@/lib/fmt";
import { sanitizarTextoPublico } from "@/lib/sanitize";
import { linkBuscaPncp } from "@/lib/links-oficiais";

export const Route = createFileRoute("/licitacoes/$id")({
  component: LicitacaoDetalhe,
  head: () => ({ meta: [{ title: "Licitação — Mutirão de Dados" }] }),
});

function LicitacaoDetalhe() {
  const { id } = useParams({ from: "/licitacoes/$id" });
  const fetchFn = useServerFn(getLicitacaoPorId);
  const { data, isLoading } = useQuery({
    queryKey: ["licitacao", id],
    queryFn: () => fetchFn({ data: { id } }),
  });

  if (isLoading)
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-sm text-muted-foreground">Carregando…</div>
    );
  const l = data?.licitacao;
  if (!l)
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Link
          to="/licitacoes"
          className="text-xs text-muted-foreground inline-flex items-center gap-1"
        >
          <ArrowLeft className="size-3.5" /> voltar
        </Link>
        <h1 className="font-display text-3xl mt-3">Licitação não encontrada</h1>
        <p className="text-sm text-muted-foreground mt-2">
          O id <code>{id}</code> não está no cache local. Tente buscar no Portal da Transparência.
        </p>
        <a
          href="https://portaldatransparencia.gov.br/licitacoes"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-accent hover:underline mt-3"
        >
          Abrir no Portal da Transparência <ExternalLink className="size-3.5" />
        </a>
      </div>
    );

  const urlPncp = linkBuscaPncp({ cnpjOrgao: l.orgao_cnpj, numero: l.numero_processo ?? l.numero });

  return (
    <article className="mx-auto max-w-4xl px-4 py-10 space-y-6">
      <Link
        to="/licitacoes"
        className="text-xs text-muted-foreground inline-flex items-center gap-1"
      >
        <ArrowLeft className="size-3.5" /> voltar
      </Link>
      <header>
        <div className="text-xs uppercase tracking-wider text-accent">
          {l.modalidade ?? "Licitação"}
        </div>
        <h1 className="font-display text-3xl mt-1">
          {l.objeto ? sanitizarTextoPublico(l.objeto) : `Licitação ${l.numero ?? ""}`}
        </h1>
        <p className="text-xs font-mono text-muted-foreground mt-1">
          nº {l.numero ?? "—"}
          {l.numero_processo ? ` · processo ${l.numero_processo}` : ""}
        </p>
        <div className="flex flex-wrap items-center gap-3 mt-2">
          {l.url_oficial && <BotaoFonteOficial href={l.url_oficial} />}
          <a
            href={urlPncp}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-accent hover:underline"
          >
            Buscar processo no PNCP <ExternalLink className="size-3.5" />
          </a>
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
      <BotaoCopiar
        obterTexto={() =>
          textoCopiavelDeEntidade(`Licitação ${l.numero ?? l.id}`, l.url_oficial, l)
        }
        rotulo="Copiar dados"
        mensagemToast="Dados da licitação copiados — cole na sua IA"
      />
      <BotaoSalvarItem
        entidadeTipo="licitacao"
        entidadeId={l.id}
        titulo={
          l.objeto
            ? sanitizarTextoPublico(l.objeto).slice(0, 200)
            : `Licitação ${l.numero ?? l.id}`
        }
        url={`/licitacoes/${encodeURIComponent(l.id)}`}
        contexto={[l.modalidade, l.situacao, fmtBRL(l.valor)].filter(Boolean).join(" · ")}
        snapshotDe={l}
      />
      </div>

      <QualidadeBanner fonte="cgu_licitacoes" entidadeTipo="licitacao" entidadeId={l.id} />

      <div className="grid sm:grid-cols-3 gap-4">
        <Card title="Valor">{fmtBRL(l.valor)}</Card>
        <Card title="Situação">{l.situacao ?? "—"}</Card>
        <Card title="Modalidade">{l.modalidade ?? "—"}</Card>
      </div>

      <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
        <Field label="Abertura" value={l.data_abertura} />
        <Field label="Publicação" value={l.data_publicacao} />
        <Field label="Resultado" value={l.data_resultado} />
        <Field label="Unidade gestora" value={l.unidade_gestora} />
        <Field label="Órgão (CNPJ)" value={l.orgao_cnpj} />
        <Field
          label="UF / Município"
          value={[l.uf, l.municipio_nome].filter(Boolean).join(" / ") || null}
        />
      </dl>

      <p className="text-[11px] text-muted-foreground border-t border-border pt-4">
        Dados extraídos do endpoint <code>/licitacoes</code> do Portal da Transparência (CGU). O
        edital, termo de referência e atas de lances ficam no PNCP — a API da CGU não traz a chave
        de acoplamento, então o link para o PNCP é uma busca por órgão e número.
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
