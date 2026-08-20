import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { getConvenioCguPorId } from "@/lib/data/real/queries.functions";
import { BotaoCopiar } from "@/components/BotaoCopiar";
import { BotaoFonteOficial } from "@/components/BotaoFonteOficial";
import { linksDoConvenio } from "@/lib/links-oficiais";
import { BotaoSalvarItem } from "@/components/BotaoSalvarItem";
import { textoCopiavelDeEntidade } from "@/lib/itens-salvos/logic";
import { QualidadeBanner } from "@/components/QualidadeBanner";
import { fmtBRL } from "@/lib/fmt";
import { sanitizarTextoPublico } from "@/lib/sanitize";

export const Route = createFileRoute("/convenios/$id")({
  component: ConvenioDetalhe,
  head: () => ({ meta: [{ title: "Convênio — Mutirão de Dados" }] }),
});

function ConvenioDetalhe() {
  const { id } = useParams({ from: "/convenios/$id" });
  const fetchFn = useServerFn(getConvenioCguPorId);
  const { data, isLoading } = useQuery({
    queryKey: ["convenio-cgu", id],
    queryFn: () => fetchFn({ data: { id } }),
  });

  if (isLoading)
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-sm text-muted-foreground">Carregando…</div>
    );
  const c = data?.convenio;
  if (!c)
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Link
          to="/convenios"
          className="text-xs text-muted-foreground inline-flex items-center gap-1"
        >
          <ArrowLeft className="size-3.5" /> voltar
        </Link>
        <h1 className="font-display text-3xl mt-3">Convênio não encontrado</h1>
        <p className="text-sm text-muted-foreground mt-2">
          O id <code>{id}</code> não está no cache local. Tente buscar no Portal da Transparência.
        </p>
        <a
          href="https://portaldatransparencia.gov.br/convenios"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-accent hover:underline mt-3"
        >
          Abrir no Portal da Transparência <ExternalLink className="size-3.5" />
        </a>
      </div>
    );

  return (
    <article className="mx-auto max-w-4xl px-4 py-10 space-y-6">
      <Link
        to="/convenios"
        className="text-xs text-muted-foreground inline-flex items-center gap-1"
      >
        <ArrowLeft className="size-3.5" /> voltar
      </Link>
      <header>
        <div className="text-xs uppercase tracking-wider text-accent">
          {c.tipo_instrumento ?? "Convênio / instrumento"}
        </div>
        <h1 className="font-display text-3xl mt-1">
          {c.objeto ? sanitizarTextoPublico(c.objeto) : `Convênio ${c.numero ?? c.id}`}
        </h1>
        <p className="text-xs font-mono text-muted-foreground mt-1">
          nº {c.numero ?? "—"}
          {c.codigo_siconv ? ` · SICONV ${c.codigo_siconv}` : ""}
        </p>
        {/* Os dois portais do mesmo convênio — o Transferegov costuma ter o
            detalhe de execução que o Portal não mostra. */}
        <div className="mt-2 flex flex-wrap gap-2">
          {linksDoConvenio({
            id: c.id,
            numero: c.numero,
            codigoSiconv: c.codigo_siconv,
          }).map((l) => (
            <BotaoFonteOficial key={l.portal} href={l.url} rotulo={`Ver no ${l.portal}`} />
          ))}
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        <BotaoCopiar
          obterTexto={() =>
            textoCopiavelDeEntidade(`Convênio ${c.numero ?? c.id}`, c.url_oficial, c)
          }
          rotulo="Copiar dados"
          mensagemToast="Dados do convênio copiados — cole na sua IA"
        />
        <BotaoSalvarItem
          entidadeTipo="convenio"
          entidadeId={c.id}
          titulo={
            c.objeto
              ? sanitizarTextoPublico(c.objeto).slice(0, 200)
              : `Convênio ${c.numero ?? c.id}`
          }
          url={`/convenios/${encodeURIComponent(c.id)}`}
          contexto={[c.tipo_instrumento, c.numero ? `nº ${c.numero}` : null, fmtBRL(c.valor)]
            .filter(Boolean)
            .join(" · ")}
          snapshotDe={c}
        />
      </div>

      <QualidadeBanner fonte="cgu_convenios" entidadeTipo="convenio" entidadeId={c.id} />

      <div className="grid sm:grid-cols-3 gap-4">
        <Card title="Valor global">{fmtBRL(c.valor)}</Card>
        <Card title="Valor liberado">{fmtBRL(c.valor_liberado)}</Card>
        <Card title="Contrapartida">{fmtBRL(c.valor_contrapartida)}</Card>
      </div>

      <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
        <Field label="Situação" value={c.situacao} />
        <Field
          label="Vigência"
          value={[c.data_inicio_vigencia, c.data_fim_vigencia].filter(Boolean).join(" — ") || null}
        />
        <Field label="Órgão concedente" value={c.orgao_nome} />
        <Field label="CNPJ concedente" value={c.orgao_cnpj} />
        <Field label="Convenente" value={c.convenente_nome} />
        <Field label="CNPJ convenente" value={c.convenente_cnpj} />
        <Field
          label="UF / Município"
          value={[c.uf, c.municipio_nome].filter(Boolean).join(" / ") || null}
        />
        <Field label="Publicação" value={c.data_publicacao} />
      </dl>

      <p className="text-[11px] text-muted-foreground border-t border-border pt-4">
        Dados do endpoint <code>/convenios</code> do Portal da Transparência (CGU). Para a fonte
        nativa do instrumento (Transferegov), veja{" "}
        <Link to="/transferegov" className="text-accent underline">
          Transferegov
        </Link>
        .
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
