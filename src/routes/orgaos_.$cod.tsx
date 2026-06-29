import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useDataSource, useData } from "@/lib/data-store";
import { ORGAOS_BASE } from "@/lib/data/catalog";
import { EmptyState } from "@/components/EmptyState";
import { SerieAnualChart } from "@/components/SerieAnualChart";
import { FlagsCidada } from "@/components/FlagsCidada";
import { HeatmapMensal } from "@/components/HeatmapMensal";
import { RadarRisco, type RadarEixo } from "@/components/RadarRisco";
import { MetodologiaPopover } from "@/components/MetodologiaPopover";
import { medianaPorFuncao, descreverValor } from "@/lib/contexto";
import { calcularNotaTransparencia, corDaFaixa, rotuloDaFaixa } from "@/lib/transparencia";
import { fmtBRL } from "@/lib/fmt";
import { sanitizarTextoPublico } from "@/lib/sanitize";
import { ExternalLink } from "lucide-react";
import { BotaoSalvarItem } from "@/components/BotaoSalvarItem";

export const Route = createFileRoute("/orgaos_/$cod")({
  component: OrgaoDetail,
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-4 py-20 text-center">
      <h1 className="font-display text-4xl">Órgão não encontrado</h1>
      <Link to="/orgaos" className="text-accent mt-4 inline-block">Voltar à lista</Link>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-3xl px-4 py-20">
      <h1 className="font-display text-2xl">Algo deu errado</h1>
      <p className="text-sm text-muted-foreground mt-2">{error.message}</p>
    </div>
  ),
});

function OrgaoDetail() {
  const { cod } = Route.useParams();
  const base = ORGAOS_BASE.find(o => o.cod === cod);
  if (!base) throw notFound();

  const ds = useDataSource();
  const { dataset } = useData();
  const orgao = ds.getOrgao(cod);
  const serie = ds.serieAnualOrgao(cod);
  const contratos = ds.contratosOrgao(cod);
  const total = serie.reduce((s, x) => s + x.valor, 0);

  // Top fornecedores
  const porForn = new Map<string, number>();
  for (const c of contratos) porForn.set(c.fornecedorCnpj, (porForn.get(c.fornecedorCnpj) ?? 0) + c.valor);
  const topForn = [...porForn.entries()].sort((a,b)=>b[1]-a[1]).slice(0, 5);

  // === Indicadores derivados para o radar de risco ===
  const totForn = topForn.length ? topForn[0][1] : 0;
  const concentracao = total > 0 ? totForn / total : 0;
  const pctDispensa = contratos.length
    ? contratos.filter(c => c.modalidade === "dispensa").length / contratos.length
    : 0;
  const ticketMedio = contratos.length ? total / contratos.length : 0;
  const ticketRef = 500_000;
  const ticketScore = Math.min(1, ticketMedio / ticketRef);
  // crescimento vs ano anterior
  let crescimento = 0;
  if (serie.length >= 2) {
    const prev = serie[serie.length-2].valor;
    const cur = serie[serie.length-1].valor;
    crescimento = prev > 0 ? Math.min(1, Math.max(0, (cur/prev - 1) / 2)) : 0;
  }
  // fornecedores novos (primeira aparição no último ano coberto)
  const ultimoAno = serie.length ? serie[serie.length-1].ano : 0;
  const firstSeen = new Map<string, string>();
  for (const c of contratos) {
    const cur = firstSeen.get(c.fornecedorCnpj);
    if (!cur || c.dataAssinatura < cur) firstSeen.set(c.fornecedorCnpj, c.dataAssinatura);
  }
  const novosUltimoAno = [...firstSeen.values()].filter(d => new Date(d).getFullYear() === ultimoAno).length;
  const novosScore = porForn.size ? Math.min(1, novosUltimoAno / porForn.size) : 0;
  // fragmentação: dispensas abaixo do teto
  const fragCount = contratos.filter(c => c.modalidade === "dispensa" && c.valor < 17_600).length;
  const fragScore = contratos.length ? Math.min(1, fragCount / Math.max(5, contratos.length * 0.1)) : 0;

  const eixos: RadarEixo[] = [
    { label: "Concentração",  valor: concentracao, descricao: `Top fornecedor = ${(concentracao*100).toFixed(0)}% do contratado.` },
    { label: "% Dispensa",    valor: pctDispensa,  descricao: `${(pctDispensa*100).toFixed(0)}% dos contratos sem licitação.` },
    { label: "Crescimento",   valor: crescimento,  descricao: `Variação relativa do gasto vs ano anterior.` },
    { label: "Forn. novos",   valor: novosScore,   descricao: `${novosUltimoAno} novos fornecedores em ${ultimoAno || "—"}.` },
    { label: "Ticket médio",  valor: ticketScore,  descricao: `${fmtBRL(ticketMedio)} por contrato (ref. R$ 500k).` },
    { label: "Fragmentação",  valor: fragScore,    descricao: `${fragCount} dispensas abaixo de R$ 17.600.` },
  ];

  // Contexto: comparar com mediana da função
  const medFuncao = medianaPorFuncao(dataset, base.funcao);

  const iti = calcularNotaTransparencia(dataset, cod);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <Link to="/orgaos" className="text-sm text-muted-foreground hover:text-foreground">← Órgãos</Link>
      <div className="mt-3 flex items-baseline justify-between flex-wrap gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-accent">{base.funcao}</div>
          <h1 className="font-display text-4xl mt-1">{base.nome}</h1>
          <div className="font-mono text-sm text-muted-foreground mt-1">{base.sigla} · cod. {base.cod}</div>
        </div>
        <a
          href={`https://portaldatransparencia.gov.br/orgaos/${encodeURIComponent(base.cod)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-accent hover:underline"
        >
          Ver no Portal da Transparência <ExternalLink className="size-3.5" />
        </a>
      </div>

      <div className="mt-4">
        <BotaoSalvarItem
          entidadeTipo="orgao"
          entidadeId={base.cod}
          titulo={`${base.sigla} — ${base.nome}`}
          url={`/orgaos/${encodeURIComponent(base.cod)}`}
          contexto={base.funcao}
        />
      </div>

      {!orgao && (
        <div className="mt-8">
          {base.disponivelPortal ? (
            <EmptyState
              title="Sem dados carregados para este órgão"
              hint="A importação de dados é feita pela equipe de administração. Volte em breve."
            />
          ) : (
            <div className="mt-6">
              <EmptyState
                title={`${base.sigla} ainda não está conectado`}
                hint={base.nota ?? "Este órgão não é coberto pelo /contratos do Portal da Transparência (CGU). A integração com a API própria está planejada."}
              />
            </div>
          )}
        </div>
      )}

      {orgao && (
        <>
          <div className="mt-8 grid sm:grid-cols-3 gap-4">
            <Stat label="Total contratado" value={fmtBRL(total)} />
            <Stat label="Contratos" value={contratos.length.toString()} />
            <Stat label="Fornecedores únicos" value={porForn.size.toString()} />
          </div>

          <div className="mt-4 border border-dashed border-border rounded-xl p-4 bg-card text-sm text-muted-foreground">
            <strong className="text-foreground">Contexto:</strong> os {fmtBRL(total)} contratados representam{" "}
            {descreverValor(total)}.
            {medFuncao > 0 && (
              <> Para órgãos da função <em>{base.funcao}</em>, a mediana contratada nesta amostra é {fmtBRL(medFuncao)} — este órgão está em{" "}
              <strong className="text-foreground">{total >= medFuncao ? `${(total/medFuncao).toFixed(1)}× a mediana` : `${((total/medFuncao)*100).toFixed(0)}% da mediana`}</strong>.</>
            )}{" "}
            <MetodologiaPopover titulo="Como o contexto é calculado">
              <p>Mediana = ponto central dos totais contratados por órgãos da mesma função, considerando apenas os dados já carregados na plataforma.</p>
              <p>Comparação com salário mínimo usa o valor nacional vigente para 2026, para fins didáticos.</p>
            </MetodologiaPopover>
          </div>

          {iti.amostra > 0 && (
            <div className="mt-4 border border-border rounded-xl bg-card p-5">
              <div className="flex items-baseline justify-between flex-wrap gap-3">
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Índice de Transparência Institucional</div>
                  <div className="mt-1 flex items-baseline gap-3">
                    <span className={`font-display text-3xl ${corDaFaixa(iti.faixa)}`}>{iti.nota}<span className="text-sm text-muted-foreground font-mono">/100</span></span>
                    <span className={`text-xs uppercase tracking-wider ${corDaFaixa(iti.faixa)}`}>{rotuloDaFaixa(iti.faixa)}</span>
                  </div>
                </div>
                <Link to="/transparencia-institucional" className="text-xs text-accent hover:underline">Comparar com outros órgãos →</Link>
              </div>
              <div className="mt-4 grid sm:grid-cols-5 gap-2">
                {iti.componentes.map((c) => (
                  <div key={c.chave} className="border border-border rounded-lg p-2 bg-background/40">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{c.label}</div>
                    <div className="mt-1 font-mono text-sm">{Math.round(c.valor * 100)}</div>
                    <div className="mt-1 h-1 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-accent" style={{ width: `${c.valor * 100}%` }} aria-hidden />
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Mede a <strong className="text-foreground">clareza informacional</strong> do que o órgão publica.
                Não avalia legalidade nem eficiência.
              </p>
            </div>
          )}

          <div className="mt-10">
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="font-display text-2xl">Série histórica (nominal)</h2>
              <MetodologiaPopover titulo="Série histórica">
                <p>Soma anual dos valores dos contratos assinados pelo órgão, sem deflação. Mostra o nominal — o reajuste pelo IPCA virá em fase posterior.</p>
              </MetodologiaPopover>
            </div>
            <div className="border border-border rounded-xl p-4 bg-card">
              <SerieAnualChart data={serie} />
            </div>
          </div>

          <div className="mt-10 grid lg:grid-cols-2 gap-6">
            <div>
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="font-display text-2xl">Radar de risco</h2>
                <MetodologiaPopover titulo="Eixos do radar">
                  <p>Cada eixo é normalizado de 0 a 1 a partir dos contratos carregados. Quanto mais próximo da borda, mais atenção o eixo merece — sempre como sinal, nunca como prova.</p>
                </MetodologiaPopover>
              </div>
              <div className="border border-border rounded-xl p-4 bg-card">
                <RadarRisco eixos={eixos} />
              </div>
            </div>
            <div>
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="font-display text-2xl">Sazonalidade mensal</h2>
                <MetodologiaPopover titulo="Heatmap mensal">
                  <p>Cada célula = soma dos contratos assinados naquele mês. Padrões anormais (ex.: pico de dezembro) podem indicar contratos de fim de ano para empenhar saldo.</p>
                </MetodologiaPopover>
              </div>
              <div className="border border-border rounded-xl p-4 bg-card">
                <HeatmapMensal contratos={contratos} />
              </div>
            </div>
          </div>

          <div className="mt-10 grid lg:grid-cols-2 gap-6">
            <div>
              <h2 className="font-display text-2xl mb-3">Principais fornecedores</h2>
              <div className="border border-border rounded-xl bg-card divide-y divide-border">
                {topForn.map(([cnpj, valor]) => {
                  const f = ds.getFornecedor(cnpj);
                  return (
                    <Link key={cnpj} to="/fornecedores/$cnpj" params={{ cnpj }} className="flex items-center justify-between p-4 hover:bg-muted transition-colors">
                      <div>
                        <div className="font-semibold">{f?.nome ?? cnpj}</div>
                        <div className="text-xs font-mono text-muted-foreground">{cnpj}</div>
                      </div>
                      <div className="font-mono text-sm">{fmtBRL(valor)}</div>
                    </Link>
                  );
                })}
              </div>
            </div>
            <div>
              <h2 className="font-display text-2xl mb-3">Marcações cidadãs</h2>
              <FlagsCidada entidadeTipo="orgao" entidadeId={cod} />
            </div>
          </div>

          <div className="mt-10">
            <h2 className="font-display text-2xl mb-3">Contratos recentes</h2>
            <div className="border border-border rounded-xl bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left p-3">Objeto</th>
                    <th className="text-left p-3 hidden sm:table-cell">Modalidade</th>
                    <th className="text-left p-3 hidden md:table-cell">Ano</th>
                    <th className="text-right p-3">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {contratos.slice(0, 15).map(c => (
                    <tr key={c.id} className="hover:bg-muted/50">
                      <td className="p-3">
                        <Link to="/contratos/$id" params={{ id: c.id }} className="hover:text-accent">{sanitizarTextoPublico(c.objeto)}</Link>
                      </td>
                      <td className="p-3 hidden sm:table-cell"><span className="text-xs uppercase font-mono text-muted-foreground">{c.modalidade}</span></td>
                      <td className="p-3 hidden md:table-cell font-mono">{c.ano}</td>
                      <td className="p-3 text-right font-mono">{fmtBRL(c.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border rounded-xl p-5 bg-card">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-display text-2xl mt-1">{value}</div>
    </div>
  );
}
