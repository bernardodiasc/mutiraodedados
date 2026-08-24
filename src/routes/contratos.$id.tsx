import * as React from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useData, useDataSource } from "@/lib/data-store";
import { getContratoPorId } from "@/lib/data/real/portal.functions";
import { getContratoPncpPorId, type ContratoPNCPRow } from "@/lib/data/pncp/queries.functions";
import type { Contrato, Fornecedor, Orgao } from "@/lib/data/types";
import { FlagsCidada } from "@/components/FlagsCidada";
import { QualidadeBanner } from "@/components/QualidadeBanner";
import { fmtBRL } from "@/lib/fmt";
import { sanitizarTextoPublico } from "@/lib/sanitize";
import { AcoesDaEntidade } from "@/components/AcoesDaEntidade";
import { BlocoRastreabilidade } from "@/components/BlocoRastreabilidade";
import { Cartao, Estatistica } from "@/components/Cartao";
import { TrilhaDeNavegacao } from "@/components/TrilhaDeNavegacao";
import { textoCopiavelDeEntidade } from "@/lib/itens-salvos/logic";

export const Route = createFileRoute("/contratos/$id")({
  component: ContratoDetail,
  head: ({ params }) => ({
    meta: [
      { title: `Contrato ${params.id} — Mutirão de Dados` },
      {
        name: "description",
        content:
          "Ficha do contrato público: valor, vigência, órgão contratante e fornecedor, com link para a fonte oficial.",
      },
    ],
  }),
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
  const fetchPncp = useServerFn(getContratoPncpPorId);

  const local = hydrated ? ds.getContrato(id) : undefined;
  // Fallback server-side: o dataset do cliente é limitado a 10k linhas, então
  // contratos válidos (inclusive os sinalizados em QA) podem não estar nele.
  // `undefined` = ainda buscando; `null` = não existe nem no banco.
  const [remoto, setRemoto] = React.useState<
    { contrato: Contrato; fornecedor: Fornecedor | null; orgao: Orgao | null } | null | undefined
  >(undefined);
  // Mesma página para as duas fontes: se o id não está na base CGU, tenta o
  // acervo do PNCP (contratos de todos os entes) antes do notFound.
  const [pncp, setPncp] = React.useState<ContratoPNCPRow | null | undefined>(undefined);
  React.useEffect(() => {
    if (!hydrated || local) return;
    let cancel = false;
    setRemoto(undefined);
    setPncp(undefined);
    fetchPorId({ data: { id } })
      .then((r) => {
        if (cancel) return;
        if (r.contrato) {
          setRemoto(r as NonNullable<typeof remoto>);
          setPncp(null);
          return;
        }
        setRemoto(null);
        return fetchPncp({ data: { id } }).then((p) => {
          if (!cancel) setPncp(p.contrato ?? null);
        });
      })
      .catch(() => {
        if (!cancel) {
          setRemoto(null);
          setPncp(null);
        }
      });
    return () => {
      cancel = true;
    };
  }, [hydrated, local, id, fetchPorId, fetchPncp]);

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center text-muted-foreground">
        Carregando…
      </div>
    );
  }
  const c = local ?? remoto?.contrato ?? null;
  if (!local && (remoto === undefined || (remoto === null && pncp === undefined))) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center text-muted-foreground">
        Carregando…
      </div>
    );
  }
  if (!c && pncp) return <ContratoPncpDetail c={pncp} />;
  if (!c) throw notFound();
  const orgao = local ? ds.getOrgao(c.orgaoCod) : (remoto?.orgao ?? undefined);
  const fornecedor = local ? ds.getFornecedor(c.fornecedorCnpj) : (remoto?.fornecedor ?? undefined);

  const urlOficial = `https://portaldatransparencia.gov.br/contratos/${encodeURIComponent(c.id)}`;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <TrilhaDeNavegacao
        itens={[{ label: "Contratos", to: "/contratos" }, { label: `Contrato ${c.id}` }]}
      />
      <div className="text-xs font-semibold uppercase tracking-widest text-accent mt-4">
        {c.modalidade}
      </div>
      <h1 className="font-display text-3xl mt-1">{sanitizarTextoPublico(c.objeto)}</h1>

      <AcoesDaEntidade
        className="mt-4"
        entidadeTipo="contrato"
        entidadeId={c.id}
        titulo={sanitizarTextoPublico(c.objeto).slice(0, 200)}
        url={`/contratos/${encodeURIComponent(c.id)}`}
        contexto={`${c.modalidade} · ${fmtBRL(c.valor)}${orgao ? ` · ${orgao.sigla}` : ""}${fornecedor ? ` · ${fornecedor.nome}` : ""}`}
        snapshotDe={c}
        fonteOficialHref={urlOficial}
        obterTextoCopiavel={() =>
          textoCopiavelDeEntidade(
            `Contrato ${c.id} — ${sanitizarTextoPublico(c.objeto).slice(0, 120)}`,
            urlOficial,
            {
              contrato: c,
              fornecedor,
              orgao: orgao ? { cod: orgao.cod, sigla: orgao.sigla, nome: orgao.nome } : null,
            },
          )
        }
        rotuloCopiar="Copiar dados"
        mensagemCopiar="Dados do contrato copiados — cole na sua IA"
      />

      <div className="mt-6">
        <QualidadeBanner fonte="cgu" entidadeTipo="contrato" entidadeId={c.id} />
      </div>

      <div className="mt-8 grid sm:grid-cols-3 gap-4">
        <Estatistica rotulo="Valor" valor={fmtBRL(c.valor)} />
        <Estatistica
          rotulo="Assinado em"
          valor={(() => {
            if (!c.dataAssinatura) {
              return <span className="text-muted-foreground">Não assinado</span>;
            }
            const d = new Date(c.dataAssinatura);
            return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR");
          })()}
        />
        <Estatistica
          rotulo="Início de vigência"
          valor={(() => {
            if (!c.dataInicioVigencia) return "—";
            const d = new Date(c.dataInicioVigencia);
            return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR");
          })()}
        />
      </div>

      <div className="mt-6 grid sm:grid-cols-2 gap-4">
        <Cartao titulo="Órgão contratante">
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
        </Cartao>
        <Cartao titulo="Fornecedor">
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
        </Cartao>
      </div>

      <div className="mt-10">
        <h2 className="font-display text-2xl mb-3">Marcações cidadãs</h2>
        <FlagsCidada entidadeTipo="contrato" entidadeId={c.id} />
      </div>

      <div className="mt-10">
        <BlocoRastreabilidade
          fontes={[
            {
              label: "Portal da Transparência (CGU)",
              href: urlOficial,
              origem: "registro oficial do contrato",
            },
          ]}
          observacao="Dados pessoais identificáveis em campos livres (CPF, e-mails, telefones, CEPs) são mascarados automaticamente — veja /tratamento-de-dados."
        />
      </div>
    </div>
  );
}

/** Ficha de contrato do PNCP — a outra fonte da mesma página /contratos/$id. */
function ContratoPncpDetail({ c }: { c: ContratoPNCPRow }) {
  const objeto = c.objeto ? sanitizarTextoPublico(c.objeto) : `Contrato ${c.numero_controle_pncp}`;
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <TrilhaDeNavegacao
        itens={[
          { label: "Contratos", to: "/contratos", search: { fonte: "pncp" } },
          { label: `Contrato ${c.numero_controle_pncp}` },
        ]}
      />
      <div className="text-xs font-semibold uppercase tracking-widest text-accent mt-4">
        PNCP · {c.esfera ?? "—"}
      </div>
      <h1 className="font-display text-3xl mt-1">{objeto}</h1>
      <p className="text-xs font-mono text-muted-foreground mt-1">
        controle PNCP {c.numero_controle_pncp}
      </p>

      <AcoesDaEntidade
        className="mt-4"
        entidadeTipo="contrato"
        entidadeId={c.id}
        titulo={objeto.slice(0, 200)}
        url={`/contratos/${encodeURIComponent(c.id)}`}
        contexto={[c.orgao_nome, c.uf, c.municipio_nome].filter(Boolean).join(" · ")}
        snapshotDe={c}
        fonteOficialHref={c.url_pncp ?? undefined}
        obterTextoCopiavel={() =>
          textoCopiavelDeEntidade(
            `Contrato PNCP ${c.numero_controle_pncp} — ${objeto.slice(0, 120)}`,
            c.url_pncp,
            c,
          )
        }
        rotuloCopiar="Copiar dados"
        mensagemCopiar="Dados do contrato copiados — cole na sua IA"
      />

      <div className="mt-6">
        <QualidadeBanner fonte="pncp" entidadeTipo="contrato" entidadeId={c.id} />
      </div>

      <div className="mt-8 grid sm:grid-cols-2 gap-4">
        <Estatistica rotulo="Valor global" valor={fmtBRL(Number(c.valor_global ?? 0))} />
        <Estatistica
          rotulo="Assinado em"
          valor={c.data_assinatura ? new Date(c.data_assinatura).toLocaleDateString("pt-BR") : "—"}
        />
      </div>

      <div className="mt-6 grid sm:grid-cols-2 gap-4">
        <Cartao titulo="Órgão contratante">
          <div className="font-semibold">{c.orgao_nome}</div>
          <div className="text-xs font-mono text-muted-foreground">
            {c.orgao_cnpj}
            {c.uf ? ` · ${c.uf}` : ""}
            {c.municipio_nome ? ` · ${c.municipio_nome}` : ""}
          </div>
        </Cartao>
        <Cartao titulo="Fornecedor">
          {c.fornecedor_nome || c.fornecedor_cnpj_cpf ? (
            <>
              <div className="font-semibold">{c.fornecedor_nome ?? "—"}</div>
              <div className="text-xs font-mono text-muted-foreground">
                {c.fornecedor_cnpj_cpf ?? ""}
              </div>
            </>
          ) : (
            <div className="text-muted-foreground">Não informado</div>
          )}
        </Cartao>
      </div>

      <div className="mt-10">
        <BlocoRastreabilidade
          fontes={[
            {
              label: "PNCP — Portal Nacional de Contratações Públicas",
              href: c.url_pncp ?? undefined,
              origem: "publicação primária do contrato (Lei 14.133)",
            },
          ]}
          observacao="Contratos do PNCP cobrem todos os entes — União, estados e municípios. O mesmo contrato pode aparecer também na base da CGU quando o órgão é do Executivo federal."
        />
      </div>
    </div>
  );
}
