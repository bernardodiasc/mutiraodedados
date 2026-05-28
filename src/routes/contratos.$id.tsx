import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useData, useDataSource } from "@/lib/data-store";
import { FlagsCidada } from "@/components/FlagsCidada";
import { QualidadeBanner } from "@/components/QualidadeBanner";
import { fmtBRL } from "@/lib/fmt";
import { sanitizarTextoPublico } from "@/lib/sanitize";
import { ExternalLink } from "lucide-react";

export const Route = createFileRoute("/contratos/$id")({
  component: ContratoDetail,
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-4 py-20 text-center">
      <h1 className="font-display text-3xl">Contrato não encontrado</h1>
    </div>
  ),
  errorComponent: ({ error }) => <div className="mx-auto max-w-3xl px-4 py-20"><h1 className="font-display text-2xl">Erro</h1><p>{error.message}</p></div>,
});

function ContratoDetail() {
  const { id } = Route.useParams();
  const { hydrated } = useData();
  const ds = useDataSource();
  if (!hydrated) {
    return <div className="mx-auto max-w-3xl px-4 py-20 text-center text-muted-foreground">Carregando…</div>;
  }
  const c = ds.getContrato(id);
  if (!c) throw notFound();
  const orgao = ds.getOrgao(c.orgaoCod);
  const fornecedor = ds.getFornecedor(c.fornecedorCnpj);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Link to="/orgaos" className="text-sm text-muted-foreground hover:text-foreground">← Voltar</Link>
      <div className="text-xs font-semibold uppercase tracking-widest text-accent mt-3">{c.modalidade}</div>
      <h1 className="font-display text-3xl mt-1">{sanitizarTextoPublico(c.objeto)}</h1>
      <a
        href={`https://portaldatransparencia.gov.br/contratos/${encodeURIComponent(c.id)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-sm text-accent hover:underline mt-2"
      >
        Ver documento oficial <ExternalLink className="size-3.5" />
      </a>

      <div className="mt-6">
        <QualidadeBanner fonte="cgu" entidadeTipo="contrato" entidadeId={c.id} />
      </div>

      <div className="mt-8 grid sm:grid-cols-2 gap-4">
        <div className="border border-border rounded-xl p-5 bg-card">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Valor</div>
          <div className="font-display text-3xl mt-1">{fmtBRL(c.valor)}</div>
        </div>
        <div className="border border-border rounded-xl p-5 bg-card">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Assinado em</div>
          <div className="font-display text-3xl mt-1">
            {(() => {
              if (!c.dataAssinatura) return "—";
              const d = new Date(c.dataAssinatura);
              return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR");
            })()}
          </div>
        </div>
      </div>

      <div className="mt-6 grid sm:grid-cols-2 gap-4">
        <Card title="Órgão contratante">
          {orgao ? (
            <Link to="/orgaos/$cod" params={{ cod: orgao.cod }} className="hover:text-accent">
              <div className="font-semibold">{orgao.nome}</div>
              <div className="text-xs font-mono text-muted-foreground">{orgao.sigla} · {orgao.cod}</div>
            </Link>
          ) : <div className="text-muted-foreground">{c.orgaoCod}</div>}
        </Card>
        <Card title="Fornecedor">
          {fornecedor ? (
            <Link to="/fornecedores/$cnpj" params={{ cnpj: fornecedor.cnpj }} className="hover:text-accent">
              <div className="font-semibold">{fornecedor.nome}</div>
              <div className="text-xs font-mono text-muted-foreground">{fornecedor.cnpj}</div>
            </Link>
          ) : <div className="text-muted-foreground">{c.fornecedorCnpj}</div>}
        </Card>
      </div>

      <div className="mt-10">
        <h2 className="font-display text-2xl mb-3">Marcações cidadãs</h2>
        <FlagsCidada entidadeTipo="contrato" entidadeId={c.id} />
      </div>

      <p className="mt-10 text-[11px] text-muted-foreground border-t border-border pt-4">
        Dados pessoais identificáveis em campos livres (CPF, e-mails, telefones, CEPs) são
        mascarados automaticamente. <a href="/tratamento-de-dados" className="underline">Saiba por quê</a>.
      </p>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-border rounded-xl p-5 bg-card">
      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">{title}</div>
      {children}
    </div>
  );
}
