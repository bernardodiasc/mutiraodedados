import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { QualidadeBanner } from "@/components/QualidadeBanner";
import { AcoesDaEntidade } from "@/components/AcoesDaEntidade";
import { BlocoLacuna } from "@/components/BlocoLacuna";
import { BlocoRastreabilidade } from "@/components/BlocoRastreabilidade";
import { Estatistica } from "@/components/Cartao";
import { FlagsCidada } from "@/components/FlagsCidada";
import { SerieAnualChart } from "@/components/SerieAnualChart";
import { TrilhaDeNavegacao } from "@/components/TrilhaDeNavegacao";
import { textoCopiavelDeEntidade } from "@/lib/itens-salvos/logic";
import { linkFornecedorPortal } from "@/lib/links-oficiais";
import { DoacoesEleitoraisContainer as DoacoesEleitorais } from "@/containers/DoacoesEleitoraisContainer";
import { GrafoFornecedor } from "@/components/GrafoFornecedor";
import { RadarRisco } from "@/components/RadarRisco";
import { MetodologiaPopover } from "@/components/MetodologiaPopover";
import { obterFornecedor, type FichaFornecedor } from "@/lib/data/fornecedores.functions";
import {
  calcularRadar,
  derivarEstadoFicha,
  h1DoFornecedor,
  montarNosGrafo,
  serieAnualDe,
  sinaisSimples,
} from "@/lib/fornecedor-ficha/logic";
import { formatarCnpj, soDigitos } from "@/lib/cnpj";
import { fmtBRL } from "@/lib/fmt";
import { sanitizarTextoPublico } from "@/lib/sanitize";
import { tituloDaPagina } from "@/lib/titulo-pagina/logic";
import { carregarH1 } from "@/lib/titulo-pagina/loader";

export const Route = createFileRoute("/fornecedores/$cnpj")({
  component: FornecedorDetail,
  // Pré-carrega a mesma query do componente só para o título da aba seguir o
  // H1; falha ou CNPJ inexistente ficam com o componente, como antes.
  loader: ({ params, context }) =>
    carregarH1(context.queryClient, {
      queryKey: ["fornecedor-ficha", params.cnpj],
      queryFn: () => obterFornecedor({ data: { cnpj: params.cnpj } }),
      h1: (ficha) =>
        derivarEstadoFicha(ficha) === "inexistente"
          ? null
          : h1DoFornecedor(params.cnpj, ficha.cadastro),
    }),
  head: ({ loaderData }) => ({
    meta: [
      { title: tituloDaPagina(loaderData?.h1, "Fornecedor") },
      {
        name: "description",
        content:
          "Ficha do fornecedor: contratos federais, radar de risco, presença no PNCP, cotas parlamentares e doações de campanha do mesmo CNPJ.",
      },
    ],
  }),
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-4 py-20 text-center">
      <h1 className="font-display text-3xl">Fornecedor não encontrado</h1>
      <p className="text-sm text-muted-foreground mt-2">
        Não encontramos este CNPJ em nenhuma fonte do acervo — contratos, cotas parlamentares ou
        doações de campanha. Os dados entram aos poucos; o registro pode ainda não ter chegado.
      </p>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-3xl px-4 py-20">
      <h1 className="font-display text-2xl">Erro</h1>
      <p>{error.message}</p>
    </div>
  ),
});

function FornecedorDetail() {
  const { cnpj } = Route.useParams();
  const buscar = useServerFn(obterFornecedor);
  const { data: ficha, isLoading } = useQuery({
    queryKey: ["fornecedor-ficha", cnpj],
    staleTime: 5 * 60_000,
    queryFn: () => buscar({ data: { cnpj } }),
  });

  if (isLoading || !ficha) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center text-muted-foreground">
        Carregando…
      </div>
    );
  }

  const estado = derivarEstadoFicha(ficha);
  if (estado === "inexistente") throw notFound();

  const cnpjFmt = formatarCnpj(cnpj);
  const nome = h1DoFornecedor(cnpj, ficha.cadastro);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <TrilhaDeNavegacao
        itens={[{ label: "Fornecedores", to: "/fornecedores" }, { label: nome }]}
      />
      <h1 className="font-display text-4xl mt-3">{nome}</h1>
      <div className="font-mono text-sm text-muted-foreground">CNPJ {cnpjFmt}</div>
      <div className="mt-3">
        <QualidadeBanner agregado="fornecedor" agregadoId={cnpjFmt} />
      </div>
      <AcoesDaEntidade
        className="mt-4"
        entidadeTipo="fornecedor"
        entidadeId={cnpjFmt}
        titulo={nome}
        url={`/fornecedores/${encodeURIComponent(cnpjFmt)}`}
        snapshotDe={{
          fornecedor: ficha.cadastro,
          total_contratos: ficha.totalContratos,
          pncp: ficha.pncp.total,
        }}
        obterTextoCopiavel={() =>
          textoCopiavelDeEntidade(`Fornecedor ${nome} — CNPJ ${cnpjFmt}`, null, {
            fornecedor: ficha.cadastro,
            total_contratos: ficha.totalContratos,
            presenca_pncp: ficha.pncp.total,
            notas_cota_parlamentar: ficha.ceapCamara.total + ficha.ceapSenado.total,
            doacoes_campanha: ficha.doacoes.total,
          })
        }
        rotuloCopiar="Copiar dados"
        mensagemCopiar="Dados do fornecedor copiados — cole na sua IA"
        fonteOficialHref={linkFornecedorPortal(cnpjFmt)}
        fonteOficialLabel="Ver no Portal"
      />

      {estado === "completo" ? (
        <FichaCompleta ficha={ficha} cnpjFmt={cnpjFmt} nome={nome} />
      ) : (
        <FichaDegradada ficha={ficha} cnpjFmt={cnpjFmt} />
      )}

      <div className="mt-10">
        <BlocoRastreabilidade
          fontes={[
            {
              label: "Portal da Transparência (CGU)",
              href: linkFornecedorPortal(cnpjFmt),
              origem: "contratos federais deste CNPJ",
            },
            ...(ficha.pncp.total > 0
              ? [{ label: "PNCP", origem: "contratos de todos os entes (Lei 14.133)" }]
              : []),
            ...(ficha.doacoes.total > 0
              ? [{ label: "TSE", origem: "doações de campanha declaradas" }]
              : []),
          ]}
          observacao="Cada fonte cobre um recorte diferente do mesmo CNPJ — a ausência em uma fonte não significa ausência nas demais."
        />
      </div>
    </div>
  );
}

function FichaCompleta({
  ficha,
  cnpjFmt,
  nome,
}: {
  ficha: FichaFornecedor;
  cnpjFmt: string;
  nome: string;
}) {
  const contratos = ficha.contratos;
  const serie = serieAnualDe(contratos);
  const { total, nOrgaos, orgaoUnico, pctDispensa, dispAltoValor } = sinaisSimples(contratos);
  const eixos = calcularRadar(contratos, fmtBRL);
  const nos = montarNosGrafo(contratos);
  const parcial = ficha.totalContratos > contratos.length;

  return (
    <>
      <div className="mt-8 grid sm:grid-cols-3 gap-4">
        <Estatistica
          rotulo="Recebido (total)"
          valor={fmtBRL(total)}
          detalhe={parcial ? `soma dos ${contratos.length} contratos mais recentes` : undefined}
        />
        <Estatistica
          rotulo="Contratos"
          valor={ficha.totalContratos.toLocaleString("pt-BR")}
          detalhe={
            ficha.pncp.total > 0
              ? `+ ${ficha.pncp.total.toLocaleString("pt-BR")} no PNCP`
              : undefined
          }
        />
        <Estatistica rotulo="Órgãos contratantes" valor={String(nOrgaos)} />
      </div>

      <div className="mt-4 border border-dashed border-border rounded-xl p-4 bg-card text-sm text-muted-foreground">
        <strong className="text-foreground">Sinais a observar:</strong>{" "}
        {orgaoUnico && <span className="mr-2">contrata apenas com 1 órgão · </span>}
        {pctDispensa > 0.5 && (
          <span className="mr-2">
            {(pctDispensa * 100).toFixed(0)}% dos contratos por dispensa ·{" "}
          </span>
        )}
        {dispAltoValor > 0 && <span className="mr-2">{dispAltoValor} dispensa(s) ≥ R$ 50k · </span>}
        <span>nada disso, isoladamente, é irregular — são pontos para começar a olhar.</span>
      </div>

      <div className="mt-10 grid lg:grid-cols-2 gap-6">
        <div>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="font-display text-2xl">Radar de risco</h2>
            <MetodologiaPopover titulo="Eixos do radar">
              <p>
                Cada eixo é normalizado de 0 a 1 a partir dos contratos deste fornecedor. Quanto
                mais próximo da borda, mais atenção o eixo merece — sempre como sinal, nunca como
                prova.
              </p>
            </MetodologiaPopover>
          </div>
          <div className="border border-border rounded-xl p-4 bg-card">
            <RadarRisco eixos={eixos} />
          </div>
        </div>
        <div>
          <h2 className="font-display text-2xl mb-3">Evolução do recebido</h2>
          <div className="border border-border rounded-xl p-4 bg-card">
            <SerieAnualChart data={serie} />
          </div>
        </div>
      </div>

      {nos.length > 1 && (
        <div className="mt-10">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="font-display text-2xl">Mapa de relacionamento</h2>
            <MetodologiaPopover titulo="Como ler o grafo">
              <p>
                O fornecedor está no centro. Cada satélite é um órgão contratante. Espessura da
                aresta e tamanho do nó são proporcionais ao volume contratado.
              </p>
              <p>
                Concentração em poucos órgãos não é, por si só, irregular — depende do mercado e do
                objeto.
              </p>
            </MetodologiaPopover>
          </div>
          <div className="border border-border rounded-xl p-4 bg-card">
            <GrafoFornecedor central={nome} nos={nos} />
          </div>
        </div>
      )}

      <div className="mt-10">
        <DoacoesEleitorais cnpj={cnpjFmt} />
      </div>

      <div className="mt-10 grid lg:grid-cols-2 gap-6">
        <div>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="font-display text-2xl">Contratos</h2>
            <Link
              to="/contratos"
              search={{ fornecedor: cnpjFmt }}
              className="text-xs font-semibold text-accent hover:underline underline-offset-4"
            >
              Ver todos os contratos deste fornecedor →
            </Link>
          </div>
          <div className="border border-border rounded-xl bg-card divide-y divide-border">
            {contratos.slice(0, 12).map((c) => (
              <Link
                key={c.id}
                to="/contratos/$id"
                params={{ id: c.id }}
                className="block p-4 hover:bg-muted"
              >
                <div className="text-sm font-semibold">
                  {sanitizarTextoPublico(c.objeto ?? `Contrato ${c.numero ?? c.id}`)}
                </div>
                <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground">
                  <span className="font-mono uppercase">
                    {[c.orgao_sigla ?? c.orgao_cod, c.modalidade, c.ano]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  <span className="font-mono text-foreground">{fmtBRL(c.valor)}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
        <div>
          <h2 className="font-display text-2xl mb-3">Marcações cidadãs</h2>
          <FlagsCidada entidadeTipo="fornecedor" entidadeId={cnpjFmt} />
        </div>
      </div>
    </>
  );
}

function FichaDegradada({ ficha, cnpjFmt }: { ficha: FichaFornecedor; cnpjFmt: string }) {
  const presencas = [
    ficha.pncp.total > 0 && {
      titulo: `${ficha.pncp.total.toLocaleString("pt-BR")} contrato(s) no PNCP`,
      texto: "Contratações de União, estados e municípios sob a Lei 14.133.",
      to: "/contratos",
      search: { fonte: "pncp", fornecedor: soDigitos(cnpjFmt) },
      label: "Ver os contratos no PNCP",
    },
    (ficha.ceapCamara.total > 0 || ficha.ceapSenado.total > 0) && {
      titulo: `${(ficha.ceapCamara.total + ficha.ceapSenado.total).toLocaleString("pt-BR")} nota(s) de cota parlamentar`,
      texto:
        "Este CNPJ aparece como fornecedor de despesas da cota de deputados ou senadores (CEAP/CEAPS).",
    },
  ].filter(Boolean) as Array<{
    titulo: string;
    texto: string;
    to?: string;
    search?: Record<string, unknown>;
    label?: string;
  }>;

  return (
    <>
      <div className="mt-8">
        <BlocoLacuna
          tipo="Transparência"
          titulo="Sem contratos federais deste CNPJ no acervo"
          descricao="Não encontramos contratos deste fornecedor no Portal da Transparência (CGU) — mas o CNPJ aparece em outras fontes, listadas abaixo. Contratos federais entram no acervo aos poucos."
        />
      </div>

      {presencas.length > 0 && (
        <section className="mt-6 space-y-2">
          <h2 className="font-display text-2xl">O que sabemos deste CNPJ</h2>
          <ul className="space-y-2 text-sm">
            {presencas.map((p) => (
              <li key={p.titulo} className="rounded-xl border border-border bg-card p-4">
                <strong className="text-foreground">{p.titulo}.</strong>{" "}
                <span className="text-muted-foreground">{p.texto}</span>
                {p.to && (
                  <>
                    {" "}
                    <Link
                      to={p.to as never}
                      search={p.search as never}
                      className="text-accent underline"
                    >
                      {p.label}
                    </Link>
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-10">
        <DoacoesEleitorais cnpj={cnpjFmt} />
      </div>

      <div className="mt-10">
        <h2 className="font-display text-2xl mb-3">Marcações cidadãs</h2>
        <FlagsCidada entidadeTipo="fornecedor" entidadeId={cnpjFmt} />
      </div>
    </>
  );
}
