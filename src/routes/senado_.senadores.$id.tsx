import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSenadorDetalhe } from "@/lib/data/senado/queries.functions";
import { AvisoMetodologico } from "@/components/AvisoMetodologico";
import { fmtBRL } from "@/lib/fmt";
import { ExternalLink } from "lucide-react";

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

  if (isLoading) return <div className="mx-auto max-w-7xl px-4 py-10">Carregando…</div>;
  if (error) return <div className="mx-auto max-w-7xl px-4 py-10 text-destructive">{(error as Error).message}</div>;
  if (!data) throw notFound();

  const { senador, totalGeral, despesas, porTipo, porFornecedor, porMes } = data;
  const mediaMensal = porMes.length > 0 ? totalGeral / porMes.length : 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 space-y-10">
      <div>
        <div className="text-xs text-muted-foreground uppercase tracking-wider">
          <Link to="/senado" className="hover:text-accent">Senado</Link>
          {" · "}
          <Link to="/senado/senadores" className="hover:text-accent">Senadores</Link>
        </div>
        <div className="flex items-start gap-5 mt-3 flex-wrap">
          {senador.urlFoto && (
            <img
              src={senador.urlFoto}
              alt=""
              className="size-28 rounded-md object-cover border border-border"
            />
          )}
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
          </div>
        </div>
      </div>

      <AvisoMetodologico compacto />

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
                      <td className="px-4 py-2">{f.nome}</td>
                      <td className="px-4 py-2 text-muted-foreground font-mono text-xs hidden md:table-cell">
                        {f.cnpj ?? "—"}
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
            <h2 className="font-display text-2xl">Notas fiscais ({despesas.length})</h2>
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
                  {despesas.slice(0, 500).map((d) => (
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
              {despesas.length > 500 && (
                <div className="px-4 py-2 text-xs text-muted-foreground border-t border-border">
                  Mostrando 500 de {despesas.length} notas.
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