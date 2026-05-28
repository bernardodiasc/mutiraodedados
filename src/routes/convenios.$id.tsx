import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { obterInstrumento } from "@/lib/data/transferegov/queries.functions";
import { QualidadeBanner } from "@/components/QualidadeBanner";
import { fmtBRL } from "@/lib/fmt";
import { sanitizarTextoPublico } from "@/lib/sanitize";

export const Route = createFileRoute("/convenios/$id")({
  component: ConvenioDetalhe,
  head: () => ({ meta: [{ title: "Convênio — Auditoria Cidadã" }] }),
});

function ConvenioDetalhe() {
  const { id } = useParams({ from: "/convenios/$id" });
  const fetchFn = useServerFn(obterInstrumento);
  const { data, isLoading } = useQuery({
    queryKey: ["instrumento", id],
    queryFn: () => fetchFn({ data: { id } }),
  });

  if (isLoading)
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-sm text-muted-foreground">
        Carregando…
      </div>
    );
  const i = data?.instrumento;
  if (!i)
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Link to="/convenios" className="text-xs text-muted-foreground inline-flex items-center gap-1">
          <ArrowLeft className="size-3.5" /> voltar
        </Link>
        <h1 className="font-display text-3xl mt-3">Convênio não encontrado</h1>
        <p className="text-sm text-muted-foreground mt-2">
          O id <code>{id}</code> não está no cache local. Tente abrir no Portal
          da Transparência diretamente.
        </p>
        <a
          href={`https://portaldatransparencia.gov.br/convenios/${encodeURIComponent(id)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-accent hover:underline mt-3"
        >
          Abrir no Portal da Transparência <ExternalLink className="size-3.5" />
        </a>
      </div>
    );

  const urlOficial =
    (i.codigo_siconv
      ? `https://discricionarias.transferegov.sistema.gov.br/voluntarias/ConsultarProposta/ResultadoDaConsultaDeConvenioSelecionarConvenio.do?sequencialConvenio=${encodeURIComponent(i.codigo_siconv)}`
      : i.url_transferegov ??
        (i.numero
          ? `https://portaldatransparencia.gov.br/convenios/consulta?nrConvenio=${encodeURIComponent(i.numero)}`
          : `https://portaldatransparencia.gov.br/convenios/${encodeURIComponent(i.id)}`));

  return (
    <article className="mx-auto max-w-4xl px-4 py-10 space-y-6">
      <Link to="/convenios" className="text-xs text-muted-foreground inline-flex items-center gap-1">
        <ArrowLeft className="size-3.5" /> voltar
      </Link>
      <header>
        <div className="text-xs uppercase tracking-wider text-accent">
          {i.modalidade ?? "Convênio / instrumento"}
        </div>
        <h1 className="font-display text-3xl mt-1">
          {i.objeto ? sanitizarTextoPublico(i.objeto) : `Convênio ${i.numero}`}
        </h1>
        <p className="text-xs font-mono text-muted-foreground mt-1">
          nº {i.numero}
          {i.codigo_siconv ? ` · SICONV ${i.codigo_siconv}` : ""}
        </p>
        <a
          href={urlOficial}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-accent hover:underline mt-2"
        >
          Ver documento oficial <ExternalLink className="size-3.5" />
        </a>
      </header>

      <QualidadeBanner fonte="transferegov" entidadeTipo="instrumento" entidadeId={i.id} />

      <div className="grid sm:grid-cols-3 gap-4">
        <Card title="Valor global">{fmtBRL(i.valor_global)}</Card>
        <Card title="Valor de repasse">{fmtBRL(i.valor_repasse)}</Card>
        <Card title="Contrapartida">{fmtBRL(i.valor_contrapartida ?? 0)}</Card>
      </div>

      <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
        <Field label="Situação" value={i.situacao} />
        <Field label="Assinado em" value={i.data_assinatura} />
        <Field label="Vigência" value={[i.data_inicio_vigencia, i.data_fim_vigencia].filter(Boolean).join(" — ") || null} />
        <Field label="Órgão concedente" value={i.orgao_concedente_nome} />
        <Field label="CNPJ concedente" value={i.orgao_concedente_cnpj} />
        <Field label="Beneficiário" value={i.beneficiario_nome} />
        <Field label="CNPJ beneficiário" value={i.beneficiario_cnpj} />
        <Field label="UF / Município" value={[i.uf_beneficiario, i.municipio_nome].filter(Boolean).join(" / ") || null} />
      </dl>

      <p className="text-[11px] text-muted-foreground border-t border-border pt-4">
        Dados extraídos do endpoint <code>/convenios</code> do Portal da
        Transparência (CGU). Se um valor parecer truncado, abra a fonte oficial
        — o endpoint de listagem ocasionalmente retorna valores com escala
        errada para o mesmo registro.
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