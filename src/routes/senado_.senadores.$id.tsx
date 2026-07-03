import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getSenadorDetalhe } from "@/lib/data/senado/queries.functions";
import { AvisoMetodologico } from "@/components/AvisoMetodologico";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { fmtBRL } from "@/lib/fmt";
import { ExternalLink, ChevronDown } from "lucide-react";
import { AcoesDaEntidade } from "@/components/AcoesDaEntidade";
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

export const Route = createFileRoute("/senado_/senadores/$id")({
  component: SenadorDetalhe,
  head: ({ params }) => ({
    meta: [{ title: `Senador ${params.id} — Auditoria Cidadã` }],
  }),
});

function SenadorDetalhe() {
  const { id } = Route.useParams();
  const numId = Number(id);
  const fn = useServerFn(getSenadorDetalhe);
  const { data, isLoading, error } = useQuery({
    queryKey: ["senado", "sen", numId],
    queryFn: () => fn({ data: { id: numId } }),
  });
  const [ano, setAno] = useState<number | null>(null);
  const [mes, setMes] = useState<number | null>(null);

  if (isLoading) return <div className="mx-auto max-w-7xl px-4 py-10">Carregando…</div>;
  if (error) return <div className="mx-auto max-w-7xl px-4 py-10 text-destructive">{(error as Error).message}</div>;
  if (!data) throw notFound();

  const { senador, perfil, mandatos, legislaturas, despesas } = data;
  const anos = anosDisponiveis(despesas);
  const meses = mesesDisponiveis(despesas, ano);
  const visiveis = filtrarDespesas(despesas, ano, mes);
  const visiveisCota = visiveis.map((d) => ({
    ano: d.ano,
    mes: d.mes,
    dataDocumento: d.dataDocumento,
    tipoDespesa: d.tipoDespesa ?? "(sem tipo)",
    valorLiquido: d.valorReembolsado,
    fornecedorNome: d.fornecedorNome,
    fornecedorCnpj: d.fornecedorCnpj,
  }));
  const { totalGeral, porTipo, porFornecedor, porMes } = agregarDespesas(visiveisCota);
  const mediaMensal = porMes.length > 0 ? totalGeral / porMes.length : 0;
  const csvFilename = `despesas_${senador.nome.toLowerCase().replace(/\s+/g, "-")}_${ano ?? "todos"}${
    mes ? `-${String(mes).padStart(2, "0")}` : ""
  }`;
  const fonteOficialHref =
    perfil?.urlPagina ??
    `https://www25.senado.leg.br/web/senadores/senador/-/perfil/${senador.codigoParlamentar}`;
  const foto =
    senador.urlFoto ??
    `https://www.senado.leg.br/senadores/img/fotos-oficiais/senador${senador.codigoParlamentar}.jpg`;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 space-y-10">
      <div>
        <div className="text-xs text-muted-foreground uppercase tracking-wider">
          <Link to="/senado" className="hover:text-accent">Senado</Link>
          {" · "}
          <Link to="/senado/senadores" className="hover:text-accent">Senadores</Link>
        </div>
        <div className="flex items-start gap-5 mt-3 flex-wrap">
          <img
            src={foto}
            alt=""
            className="size-28 rounded-md object-cover border border-border"
          />
          <div className="flex-1 min-w-[260px]">
            <h1 className="font-display text-4xl leading-tight">{senador.nome}</h1>
            <div className="mt-2 text-sm text-muted-foreground">
              {senador.siglaPartido ?? "—"} · {senador.siglaUf ?? "—"}
              {senador.situacao ? ` · ${senador.situacao}` : ""}
            </div>
            {senador.email && (
              <a href={`mailto:${senador.email}`} className="text-sm text-accent underline mt-1 inline-block">
                {senador.email}
              </a>
            )}
            <div className="mt-3">
              <a
                href={`https://legis.senado.leg.br/dadosabertos/senador/${senador.codigoParlamentar}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-muted-foreground hover:text-accent inline-flex items-center gap-1"
              >
                <ExternalLink className="size-3" /> dados primários (JSON/XML)
              </a>
            </div>
            <AcoesDaEntidade
              className="mt-4"
              entidadeTipo="parlamentar"
              entidadeId={String(senador.codigoParlamentar)}
              titulo={senador.nome}
              url={`/senado/senadores/${senador.codigoParlamentar}`}
              contexto={`Senador · ${senador.siglaPartido ?? "—"}/${senador.siglaUf ?? "—"}`}
              snapshotDe={senador}
              fonteOficialHref={fonteOficialHref}
              fonteOficialLabel="Perfil no Senado"
            />
          </div>
        </div>
      </div>

      {(perfil || mandatos.length > 0) && (
        <section className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h2 className="font-display text-xl">Perfil e links oficiais</h2>
          <div className="grid gap-4 sm:grid-cols-2 text-sm">
            <dl className="space-y-2">
              {(perfil?.nomeCompleto ?? senador.nomeCompleto) && (
                <div>
                  <dt className="text-xs uppercase tracking-wider text-muted-foreground">Nome completo</dt>
                  <dd>{perfil?.nomeCompleto ?? senador.nomeCompleto}</dd>
                </div>
              )}
              {perfil?.sexo && (
                <div>
                  <dt className="text-xs uppercase tracking-wider text-muted-foreground">Sexo</dt>
                  <dd>{perfil.sexo}</dd>
                </div>
              )}
            </dl>
            <div className="flex flex-col gap-2">
              {perfil?.urlPagina && (
                <a href={perfil.urlPagina} target="_blank" rel="noreferrer" className="text-accent hover:underline inline-flex items-center gap-1.5">
                  <ExternalLink className="size-3.5" /> Perfil oficial no Senado
                </a>
              )}
              {perfil?.urlParticular && (
                <a href={perfil.urlParticular} target="_blank" rel="noreferrer" className="text-accent hover:underline inline-flex items-center gap-1.5">
                  <ExternalLink className="size-3.5" /> Site pessoal
                </a>
              )}
              {(perfil?.email ?? senador.email) && (
                <a href={`mailto:${perfil?.email ?? senador.email}`} className="text-accent hover:underline inline-flex items-center gap-1.5">
                  <ExternalLink className="size-3.5" /> {perfil?.email ?? senador.email}
                </a>
              )}
            </div>
          </div>

          {(mandatos.length > 0 || legislaturas.length > 0) && (
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5">
                {mandatos.length > 0 ? "Mandatos (8 anos cada)" : "Legislaturas em que atuou"}
              </div>
              <div className="flex flex-wrap gap-2">
                {mandatos.length > 0
                  ? mandatos.map((m, i) => (
                      <span key={i} className="rounded-md border border-border bg-muted/40 px-2 py-1 text-xs">
                        {m.anoInicio ?? "?"}–{m.anoFim ?? "?"}
                        {m.legInicio
                          ? ` · ${m.legInicio}ª${m.legFim && m.legFim !== m.legInicio ? `–${m.legFim}ª` : ""} leg.`
                          : ""}
                        {m.uf ? ` · ${m.uf}` : ""}
                        {m.participacao ? ` · ${m.participacao}` : ""}
                      </span>
                    ))
                  : legislaturas.map((m) => (
                      <span key={m.legislatura} className="rounded-md border border-border bg-muted/40 px-2 py-1 text-xs">
                        {m.legislatura}ª ({anosDaLegislatura(m.legislatura)}) · {m.siglaPartido ?? "—"}/{m.siglaUf ?? "—"}
                        {m.participacao ? ` · ${m.participacao}` : ""}
                      </span>
                    ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Cada legislatura dura 4 anos; o mandato de senador é de 8 anos (duas legislaturas).
              </p>
            </div>
          )}

          {perfil && perfil.servicos.length > 0 && (
            <Collapsible className="rounded-lg border border-border">
              <CollapsibleTrigger className="group w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/40">
                <ChevronDown className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                Dados abertos deste senador (JSON)
                <span className="ml-auto text-xs text-muted-foreground">{perfil.servicos.length}</span>
              </CollapsibleTrigger>
              <CollapsibleContent className="px-3 pb-3 pt-1">
                <div className="flex flex-wrap gap-2">
                  {perfil.servicos.map((s) => (
                    <a
                      key={s.url}
                      href={s.url}
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
          )}
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
            obterLinhas={() => despesasParaCsv(visiveisCota)}
            colunas={CSV_COLUNAS_DESPESA}
            rotulo={`Exportar CSV (${visiveis.length})`}
            disabled={visiveis.length === 0}
          />
        </section>
      )}

      <section className="grid gap-4 sm:grid-cols-3">
        <Card label="Total reembolsado (CEAPS)" value={fmtBRL(totalGeral)} />
        <Card label="Meses com despesas" value={String(porMes.length)} />
        <Card label="Média mensal" value={fmtBRL(mediaMensal)} />
      </section>

      {despesas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
          Sem despesas CEAPS em cache para este senador. Um administrador precisa importar
          um período no painel admin.
        </div>
      ) : (
        <>
          <section>
            <h2 className="font-display text-2xl">Onde o dinheiro foi gasto</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Reembolsos agrupados por tipo de despesa (passagem, combustível, divulgação, etc.).
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
              Quem mais recebeu reembolsos vinculados a este mandato. Concentração elevada
              em um único fornecedor pode merecer checagem.
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
            <div className="mt-4 rounded-xl border border-border bg-card p-4 overflow-x-auto">
              <BarsMensais data={porMes} />
            </div>
          </section>

          <section>
            <h2 className="font-display text-2xl">Notas fiscais ({visiveis.length})</h2>
            <div className="mt-4 rounded-xl border border-border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-2">Data</th>
                    <th className="text-left px-4 py-2">Tipo</th>
                    <th className="text-left px-4 py-2 hidden md:table-cell">Fornecedor</th>
                    <th className="text-right px-4 py-2">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {visiveis.slice(0, 500).map((d) => (
                    <tr key={d.id} className="border-t border-border">
                      <td className="px-4 py-2 whitespace-nowrap text-muted-foreground">
                        {d.dataDocumento ?? `${d.ano}-${String(d.mes).padStart(2, "0")}`}
                      </td>
                      <td className="px-4 py-2">{d.tipoDespesa ?? "—"}</td>
                      <td className="px-4 py-2 hidden md:table-cell">{d.fornecedorNome ?? "—"}</td>
                      <td className="px-4 py-2 text-right font-mono whitespace-nowrap">
                        {fmtBRL(d.valorReembolsado)}
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