import * as React from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useData, useDataSource } from "@/lib/data-store";
import { getContratoPorId } from "@/lib/data/real/portal.functions";
import type { Contrato, Fornecedor, Orgao } from "@/lib/data/types";
import { FlagsCidada } from "@/components/FlagsCidada";
import { QualidadeBanner } from "@/components/QualidadeBanner";
import { fmtBRL } from "@/lib/fmt";
import { sanitizarTextoPublico } from "@/lib/sanitize";
import { BotaoCopiar } from "@/components/BotaoCopiar";
import { BotaoFonteOficial } from "@/components/BotaoFonteOficial";
import { BotaoSalvarItem } from "@/components/BotaoSalvarItem";
import { textoCopiavelDeEntidade } from "@/lib/itens-salvos/logic";

export const Route = createFileRoute("/contratos/$id")({
  component: ContratoDetail,
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-4 py-20 text-center">
      <h1 className="font-display text-3xl">Contrato não encontrado</h1>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-3xl px-4 py-20">
      <h1 className="font-display text-2xl">Erro</h1>
      <p>{error.message}</p>
    </div>
  ),
});

function ContratoDetail() {
  const { id } = Route.useParams();
  const { hydrated } = useData();
  const ds = useDataSource();
  const fetchPorId = useServerFn(getContratoPorId);

  const local = hydrated ? ds.getContrato(id) : undefined;
  // Fallback server-side: o dataset do cliente é limitado a 10k linhas, então
  // contratos válidos (inclusive os sinalizados em QA) podem não estar nele.
  // `undefined` = ainda buscando; `null` = não existe nem no banco.
  const [remoto, setRemoto] = React.useState<
    { contrato: Contrato; fornecedor: Fornecedor | null; orgao: Orgao | null } | null | undefined
  >(undefined);
  React.useEffect(() => {
    if (!hydrated || local) return;
    let cancel = false;
    setRemoto(undefined);
    fetchPorId({ data: { id } })
      .then((r) => {
        if (!cancel) setRemoto(r.contrato ? (r as NonNullable<typeof remoto>) : null);
      })
      .catch(() => {
        if (!cancel) setRemoto(null);
      });
    return () => {
      cancel = true;
    };
  }, [hydrated, local, id, fetchPorId]);

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center text-muted-foreground">
        Carregando…
      </div>
    );
  }
  const c = local ?? remoto?.contrato ?? null;
  if (!local && remoto === undefined) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center text-muted-foreground">
        Carregando…
      </div>
    );
  }
  if (!c) throw notFound();
  const orgao = local ? ds.getOrgao(c.orgaoCod) : (remoto?.orgao ?? undefined);
  const fornecedor = local ? ds.getFornecedor(c.fornecedorCnpj) : (remoto?.fornecedor ?? undefined);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Link to="/orgaos" className="text-sm text-muted-foreground hover:text-foreground">
        ← Voltar
      </Link>
      <div className="text-xs font-semibold uppercase tracking-widest text-accent mt-3">
        {c.modalidade}
      </div>
      <h1 className="font-display text-3xl mt-1">{sanitizarTextoPublico(c.objeto)}</h1>
      <div className="mt-2">
        <BotaoFonteOficial
          href={`https://portaldatransparencia.gov.br/contratos/${encodeURIComponent(c.id)}`}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <BotaoCopiar
          obterTexto={() =>
            textoCopiavelDeEntidade(
              `Contrato ${c.id} — ${sanitizarTextoPublico(c.objeto).slice(0, 120)}`,
              null,
              {
                contrato: c,
                fornecedor,
                orgao: orgao ? { cod: orgao.cod, sigla: orgao.sigla, nome: orgao.nome } : null,
              },
            )
          }
          rotulo="Copiar dados"
          mensagemToast="Dados do contrato copiados — cole na sua IA"
        />
        <BotaoSalvarItem
          entidadeTipo="contrato"
          entidadeId={c.id}
          titulo={sanitizarTextoPublico(c.objeto).slice(0, 200)}
          url={`/contratos/${encodeURIComponent(c.id)}`}
          contexto={`${c.modalidade} · ${fmtBRL(c.valor)}${orgao ? ` · ${orgao.sigla}` : ""}${fornecedor ? ` · ${fornecedor.nome}` : ""}`}
          snapshotDe={c}
        />
      </div>

      <div className="mt-6">
        <QualidadeBanner fonte="cgu" entidadeTipo="contrato" entidadeId={c.id} />
      </div>

      <div className="mt-8 grid sm:grid-cols-3 gap-4">
        <div className="border border-border rounded-xl p-5 bg-card">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Valor</div>
          <div className="font-display text-3xl mt-1">{fmtBRL(c.valor)}</div>
        </div>
        <div className="border border-border rounded-xl p-5 bg-card">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Assinado em</div>
          <div className="font-display text-3xl mt-1">
            {(() => {
              if (!c.dataAssinatura) {
                return <span className="text-muted-foreground">Não assinado</span>;
              }
              const d = new Date(c.dataAssinatura);
              return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR");
            })()}
          </div>
        </div>
        <div className="border border-border rounded-xl p-5 bg-card">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Início de vigência
          </div>
          <div className="font-display text-3xl mt-1">
            {(() => {
              if (!c.dataInicioVigencia) return "—";
              const d = new Date(c.dataInicioVigencia);
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
              <div className="text-xs font-mono text-muted-foreground">
                {orgao.sigla} · {orgao.cod}
              </div>
            </Link>
          ) : (
            <div className="text-muted-foreground">{c.orgaoCod}</div>
          )}
        </Card>
        <Card title="Fornecedor">
          {fornecedor ? (
            <Link
              to="/fornecedores/$cnpj"
              params={{ cnpj: fornecedor.cnpj }}
              className="hover:text-accent"
            >
              <div className="font-semibold">{fornecedor.nome}</div>
              <div className="text-xs font-mono text-muted-foreground">{fornecedor.cnpj}</div>
            </Link>
          ) : (
            <div className="text-muted-foreground">{c.fornecedorCnpj}</div>
          )}
        </Card>
      </div>

      <div className="mt-10">
        <h2 className="font-display text-2xl mb-3">Marcações cidadãs</h2>
        <FlagsCidada entidadeTipo="contrato" entidadeId={c.id} />
      </div>

      <p className="mt-10 text-[11px] text-muted-foreground border-t border-border pt-4">
        Dados pessoais identificáveis em campos livres (CPF, e-mails, telefones, CEPs) são
        mascarados automaticamente.{" "}
        <a href="/tratamento-de-dados" className="underline">
          Saiba por quê
        </a>
        .
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
