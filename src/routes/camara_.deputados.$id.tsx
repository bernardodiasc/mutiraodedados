import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getDeputadoDetalhe } from "@/lib/data/camara/queries.functions";
import { proposicoesDoDeputado } from "@/lib/data/camara/proposicoes.functions";
import { AvisoMetodologico } from "@/components/AvisoMetodologico";
import { SituacaoBadge, Trajetoria } from "@/components/Trajetoria";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { fmtBRL } from "@/lib/fmt";
import { ExternalLink, ChevronDown } from "lucide-react";
import { AcoesDaEntidade } from "@/components/AcoesDaEntidade";
import { SecaoEleicaoContainer as SecaoEleicao } from "@/containers/SecaoEleicaoContainer";
import { BotaoBaixarCsv } from "@/components/BotaoBaixarCsv";
import {
  CSV_COLUNAS_DESPESA,
  agregarDespesas,
  anosDisponiveis,
  despesasParaCsv,
  filtrarDespesas,
  mesesDisponiveis,
} from "@/lib/cota-parlamentar/logic";

function anosDaLegislatura(n: number): string {
  const ini = 2003 + (n - 52) * 4;
  return `${ini}–${ini + 4}`;
}

export const Route = createFileRoute("/camara_/deputados/$id")({
  component: DeputadoDetalhe,
  head: ({ params }) => ({
    meta: [{ title: `Deputado ${params.id} — Mutirão de Dados` }],
  }),
});

function DeputadoDetalhe() {
  const { id } = Route.useParams();
  const numId = Number(id);
  const fn = useServerFn(getDeputadoDetalhe);
  const { data, isLoading, error } = useQuery({
    queryKey: ["camara", "dep", numId],
    queryFn: () => fn({ data: { id: numId } }),
  });
  const propsFn = useServerFn(proposicoesDoDeputado);
  const { data: props } = useQuery({
    queryKey: ["camara", "dep-props", numId],
    queryFn: () => propsFn({ data: { deputadoId: numId } }),
  });
  const [ano, setAno] = useState<number | null>(null);
  const [mes, setMes] = useState<number | null>(null);

  if (isLoading) return <div className="mx-auto max-w-7xl px-4 py-10">Carregando…</div>;
  if (error)
    return (
      <div className="mx-auto max-w-7xl px-4 py-10 text-destructive">
        {(error as Error).message}
      </div>
    );
  if (!data) throw notFound();

  const { deputado, perfil, mandatos, despesas } = data;
  const anos = anosDisponiveis(despesas);
  const meses = mesesDisponiveis(despesas, ano);
  const visiveis = filtrarDespesas(despesas, ano, mes);
  const { totalGeral, porTipo, porFornecedor, porMes } = agregarDespesas(visiveis);
  const mediaMensal = porMes.length > 0 ? totalGeral / porMes.length : 0;
  const csvFilename = `despesas_${deputado.nome.toLowerCase().replace(/\s+/g, "-")}_${ano ?? "todos"}${
    mes ? `-${String(mes).padStart(2, "0")}` : ""
  }`;
  const fonteOficialHref =
    perfil?.urlPerfil ?? `https://www.camara.leg.br/deputados/${deputado.id}`;
  const foto =
    deputado.urlFoto ?? `https://www.camara.leg.br/internet/deputado/bandep/${deputado.id}.jpg`;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 space-y-10">
      <div>
        <div className="text-xs text-muted-foreground uppercase tracking-wider">
          <Link to="/camara" className="hover:text-accent">
            Câmara
          </Link>
          {" · "}
          <Link to="/camara/deputados" className="hover:text-accent">
            Deputados
          </Link>
        </div>
        <div className="flex items-start gap-5 mt-3 flex-wrap">
          <img src={foto} alt="" className="size-28 rounded-md object-cover border border-border" />
          <div className="flex-1 min-w-[260px]">
            <h1 className="font-display text-4xl leading-tight">{deputado.nome}</h1>
            <div className="mt-2 text-sm text-muted-foreground flex flex-wrap items-center gap-x-1.5 gap-y-2">
              <span>
                {deputado.siglaPartido ?? "—"} · {deputado.siglaUf ?? "—"}
                {deputado.idLegislatura ? ` · Legislatura ${deputado.idLegislatura}` : ""}
              </span>
              {deputado.situacao && <SituacaoBadge situacao={deputado.situacao} />}
            </div>
            {deputado.email && (
              <a
                href={`mailto:${deputado.email}`}
                className="text-sm text-accent underline mt-1 inline-block"
              >
                {deputado.email}
              </a>
            )}
            <div className="mt-3">
              <a
                href={`https://dadosabertos.camara.leg.br/api/v2/deputados/${deputado.id}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-muted-foreground hover:text-accent inline-flex items-center gap-1"
              >
                <ExternalLink className="size-3" /> dados primários (JSON)
              </a>
            </div>
            <AcoesDaEntidade
              className="mt-4"
              entidadeTipo="parlamentar"
              entidadeId={String(deputado.id)}
              titulo={deputado.nome}
              url={`/camara/deputados/${deputado.id}`}
              contexto={`Deputado · ${deputado.siglaPartido ?? "—"}/${deputado.siglaUf ?? "—"}`}
              snapshotDe={deputado}
              fonteOficialHref={fonteOficialHref}
              fonteOficialLabel="Perfil na Câmara"
            />
          </div>
        </div>
      </div>

      {(perfil || mandatos.length > 0) && (
        <section className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h2 className="font-display text-xl">Perfil e links oficiais</h2>
          <div className="grid gap-4 sm:grid-cols-2 text-sm">
            <dl className="space-y-2">
              {perfil?.nomeCivil && (
                <div>
                  <dt className="text-xs uppercase tracking-wider text-muted-foreground">
                    Nome civil
                  </dt>
                  <dd>{perfil.nomeCivil}</dd>
                </div>
              )}
              {perfil?.naturalidade && (
                <div>
                  <dt className="text-xs uppercase tracking-wider text-muted-foreground">
                    Naturalidade
                  </dt>
                  <dd>{perfil.naturalidade}</dd>
                </div>
              )}
              {perfil?.escolaridade && (
                <div>
                  <dt className="text-xs uppercase tracking-wider text-muted-foreground">
                    Escolaridade
                  </dt>
                  <dd>{perfil.escolaridade}</dd>
                </div>
              )}
              {perfil?.gabineteTelefone && (
                <div>
                  <dt className="text-xs uppercase tracking-wider text-muted-foreground">
                    Gabinete
                  </dt>
                  <dd>{perfil.gabineteTelefone}</dd>
                </div>
              )}
            </dl>
            <div className="flex flex-col gap-2">
              {perfil?.urlPerfil && (
                <a
                  href={perfil.urlPerfil}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent hover:underline inline-flex items-center gap-1.5"
                >
                  <ExternalLink className="size-3.5" /> Perfil oficial na Câmara
                </a>
              )}
              {perfil?.urlWebsite && (
                <a
                  href={perfil.urlWebsite}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent hover:underline inline-flex items-center gap-1.5"
                >
                  <ExternalLink className="size-3.5" /> Site oficial
                </a>
              )}
              {(perfil?.gabineteEmail ?? deputado.email) && (
                <a
                  href={`mailto:${perfil?.gabineteEmail ?? deputado.email}`}
                  className="text-accent hover:underline inline-flex items-center gap-1.5"
                >
                  <ExternalLink className="size-3.5" /> {perfil?.gabineteEmail ?? deputado.email}
                </a>
              )}
              {(perfil?.redeSocial ?? []).map((u) => (
                <a
                  key={u}
                  href={u}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent hover:underline inline-flex items-center gap-1.5 truncate"
                >
                  <ExternalLink className="size-3.5 shrink-0" />{" "}
                  <span className="truncate">{u.replace(/^https?:\/\/(www\.)?/, "")}</span>
                </a>
              ))}
            </div>
          </div>

          {mandatos.length > 0 && (
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5">
                Mandatos por legislatura
              </div>
              <div className="flex flex-wrap gap-2">
                {mandatos.map((m) => (
                  <span
                    key={m.legislatura}
                    className="rounded-md border border-border bg-muted/40 px-2 py-1 text-xs"
                  >
                    {m.legislatura}ª ({anosDaLegislatura(m.legislatura)}) · {m.siglaPartido ?? "—"}/
                    {m.siglaUf ?? "—"}
                  </span>
                ))}
              </div>
            </div>
          )}

          <Collapsible className="rounded-lg border border-border">
            <CollapsibleTrigger className="group w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/40">
              <ChevronDown className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
              Dados abertos deste deputado (JSON)
            </CollapsibleTrigger>
            <CollapsibleContent className="px-3 pb-3 pt-1">
              <div className="flex flex-wrap gap-2">
                {[
                  { nome: "Cadastro", path: "" },
                  { nome: "Despesas", path: "/despesas" },
                  { nome: "Discursos", path: "/discursos" },
                  { nome: "Eventos", path: "/eventos" },
                  { nome: "Órgãos", path: "/orgaos" },
                  { nome: "Frentes", path: "/frentes" },
                  { nome: "Ocupações", path: "/ocupacoes" },
                  { nome: "Profissões", path: "/profissoes" },
                ].map((s) => (
                  <a
                    key={s.nome}
                    href={`https://dadosabertos.camara.leg.br/api/v2/deputados/${deputado.id}${s.path}`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md border border-border px-2 py-1 text-xs hover:border-accent hover:text-accent inline-flex items-center gap-1"
                  >
                    <ExternalLink className="size-3" /> {s.nome}
                  </a>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </section>
      )}

      {data.eventos.length > 0 && (
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-display text-xl">Trajetória no mandato</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Posse, licenças, afastamentos, vacância e reassunções registrados pela Câmara — da mais
            recente à mais antiga. É como se acompanha quem deixou o cargo (renúncia, posse em outro
            cargo, etc.) e quando um suplente assumiu.
          </p>
          <Trajetoria
            items={data.eventos.map((e) => ({
              data: e.dataHora,
              situacao: e.situacao,
              meta:
                [
                  e.legislatura ? `${e.legislatura}ª legislatura` : null,
                  e.siglaPartido || e.siglaUf
                    ? `${e.siglaPartido ?? "—"}/${e.siglaUf ?? "—"}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || null,
              detalhe: e.condicaoEleitoral,
              descricao: e.descricao,
            }))}
          />
        </section>
      )}

      <AvisoMetodologico compacto />

      {despesas.length > 0 && (
        <section className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Ano</label>
            <select
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              value={ano ?? ""}
              onChange={(e) => {
                setAno(e.target.value ? Number(e.target.value) : null);
                setMes(null);
              }}
            >
              <option value="">Todos</option>
              {anos.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Mês</label>
            <select
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              value={mes ?? ""}
              onChange={(e) => setMes(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Todos</option>
              {meses.map((m) => (
                <option key={m} value={m}>
                  {String(m).padStart(2, "0")}
                </option>
              ))}
            </select>
          </div>
          <BotaoBaixarCsv
            filename={csvFilename}
            obterLinhas={() => despesasParaCsv(visiveis)}
            colunas={CSV_COLUNAS_DESPESA}
            rotulo={`Exportar CSV (${visiveis.length})`}
            disabled={visiveis.length === 0}
          />
        </section>
      )}

      <section className="grid gap-4 sm:grid-cols-3">
        <Card label="Total reembolsado (CEAP)" value={fmtBRL(totalGeral)} />
        <Card label="Meses com despesas" value={String(porMes.length)} />
        <Card label="Média mensal" value={fmtBRL(mediaMensal)} />
      </section>

      {despesas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
          Sem despesas CEAP em cache para este deputado. Um administrador precisa importar um
          período no painel admin.
        </div>
      ) : (
        <>
          <section>
            <h2 className="font-display text-2xl">Onde o dinheiro foi gasto</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Reembolsos agrupados por tipo de despesa. Lembre que CEAP cobre categorias definidas
              em ato da Mesa — combustível, passagem, divulgação, escritório, etc.
            </p>
            <div className="mt-4 rounded-xl border border-border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-2">Categoria</th>
                    <th className="text-right px-4 py-2">Total</th>
                    <th className="text-right px-4 py-2 hidden sm:table-cell">% do total</th>
                  </tr>
                </thead>
                <tbody>
                  {porTipo.map((t) => (
                    <tr key={t.tipo} className="border-t border-border">
                      <td className="px-4 py-2">{t.tipo}</td>
                      <td className="px-4 py-2 text-right font-mono">{fmtBRL(t.total)}</td>
                      <td className="px-4 py-2 text-right text-muted-foreground hidden sm:table-cell">
                        {totalGeral > 0 ? ((t.total / totalGeral) * 100).toFixed(1) : "0.0"}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="font-display text-2xl">Principais fornecedores</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Quem mais recebeu reembolsos vinculados a este mandato. Concentração elevada em um
              único fornecedor pode merecer checagem — pode haver explicação legítima (fornecedor
              único naquele tipo de serviço) ou padrão atípico.
            </p>
            <div className="mt-4 rounded-xl border border-border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-2">Fornecedor</th>
                    <th className="text-left px-4 py-2 hidden md:table-cell">CNPJ/CPF</th>
                    <th className="text-right px-4 py-2">Notas</th>
                    <th className="text-right px-4 py-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {porFornecedor.map((f, i) => (
                    <tr key={`${f.cnpj ?? f.nome}-${i}`} className="border-t border-border">
                      <td className="px-4 py-2">
                        {f.cnpj ? (
                          <Link
                            to="/fornecedores/$cnpj"
                            params={{ cnpj: f.cnpj }}
                            className="hover:text-accent hover:underline"
                          >
                            {f.nome}
                          </Link>
                        ) : (
                          f.nome
                        )}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground font-mono text-xs hidden md:table-cell">
                        {f.cnpj ? (
                          <Link
                            to="/fornecedores/$cnpj"
                            params={{ cnpj: f.cnpj }}
                            className="hover:text-accent hover:underline"
                          >
                            {f.cnpj}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-2 text-right text-muted-foreground">{f.count}</td>
                      <td className="px-4 py-2 text-right font-mono">{fmtBRL(f.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="font-display text-2xl">Distribuição mensal</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Picos podem indicar período eleitoral, fim de mandato ou simplesmente despesas
              concentradas. Comparação contextual ajuda a interpretar.
            </p>
            <div className="mt-4 rounded-xl border border-border bg-card p-4 overflow-x-auto">
              <BarsMensais data={porMes} />
            </div>
          </section>

          <section>
            <h2 className="font-display text-2xl">Notas fiscais ({visiveis.length})</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Quando disponível, há link direto para o documento fiscal publicado pela Câmara.
            </p>
            <div className="mt-4 rounded-xl border border-border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-2">Data</th>
                    <th className="text-left px-4 py-2">Tipo</th>
                    <th className="text-left px-4 py-2 hidden md:table-cell">Fornecedor</th>
                    <th className="text-right px-4 py-2">Valor</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {visiveis.slice(0, 500).map((d) => (
                    <tr key={d.id} className="border-t border-border">
                      <td className="px-4 py-2 whitespace-nowrap text-muted-foreground">
                        {d.dataDocumento ?? `${d.ano}-${String(d.mes).padStart(2, "0")}`}
                      </td>
                      <td className="px-4 py-2">{d.tipoDespesa}</td>
                      <td className="px-4 py-2 hidden md:table-cell">{d.fornecedorNome ?? "—"}</td>
                      <td className="px-4 py-2 text-right font-mono whitespace-nowrap">
                        {fmtBRL(d.valorLiquido)}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {d.urlDocumento && (
                          <a
                            href={d.urlDocumento}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-accent hover:underline inline-flex items-center gap-1"
                          >
                            <ExternalLink className="size-3" /> NF
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {visiveis.length > 500 && (
                <div className="px-4 py-2 text-xs text-muted-foreground border-t border-border">
                  Mostrando 500 de {visiveis.length} notas.
                </div>
              )}
            </div>
          </section>
        </>
      )}

      <SecaoEleicao tipo="deputado" id={String(numId)} />

      {props && props.length > 0 && (
        <section>
          <h2 className="font-display text-2xl">Proposições assinadas ({props.length})</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Inclui projetos em que o deputado é autor principal ou coautor. Quando proponente,
            assume a iniciativa formal da proposição.
          </p>
          <div className="mt-4 rounded-xl border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2 w-36">Proposição</th>
                  <th className="text-left px-4 py-2 w-28 hidden sm:table-cell">Apresentada</th>
                  <th className="text-left px-4 py-2">Ementa</th>
                  <th className="text-left px-4 py-2 w-24">Papel</th>
                </tr>
              </thead>
              <tbody>
                {props.slice(0, 200).map((p) => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="px-4 py-2 whitespace-nowrap">
                      <Link
                        to="/camara/proposicoes/$id"
                        params={{ id: String(p.id) }}
                        className="font-mono text-accent hover:underline"
                      >
                        {p.siglaTipo} {p.numero}/{p.ano}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap hidden sm:table-cell">
                      {p.dataApresentacao ?? "—"}
                    </td>
                    <td className="px-4 py-2">
                      <p className="line-clamp-2 leading-snug">{p.ementa ?? "(sem ementa)"}</p>
                    </td>
                    <td className="px-4 py-2 text-xs">
                      {p.proponente ? (
                        <span className="text-accent">proponente</span>
                      ) : (
                        <span className="text-muted-foreground">coautor</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {props.length > 200 && (
              <div className="px-4 py-2 text-xs text-muted-foreground border-t border-border">
                Mostrando 200 de {props.length} proposições.
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className="font-display text-2xl mt-1">{value}</div>
    </div>
  );
}

function BarsMensais({ data }: { data: Array<{ mes: string; total: number }> }) {
  if (data.length === 0) return <div className="text-sm text-muted-foreground">Sem dados.</div>;
  const max = Math.max(...data.map((d) => d.total));
  return (
    <div className="flex items-end gap-1 h-40 min-w-[480px]">
      {data.map((d) => {
        const h = max > 0 ? (d.total / max) * 100 : 0;
        return (
          <div key={d.mes} className="flex-1 flex flex-col items-center gap-1 group">
            <div
              className="w-full bg-accent/70 group-hover:bg-accent transition-colors rounded-sm"
              style={{ height: `${h}%` }}
              title={`${d.mes}: ${fmtBRL(d.total)}`}
            />
            <div className="text-[9px] text-muted-foreground rotate-45 origin-left translate-y-2 whitespace-nowrap">
              {d.mes}
            </div>
          </div>
        );
      })}
    </div>
  );
}
