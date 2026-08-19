import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { corDaFaixa, rotuloDaFaixa } from "@/lib/transparencia";
import { MetodologiaPopover } from "@/components/MetodologiaPopover";
import { EmptyState } from "@/components/EmptyState";
import { rankingITI, type LinhaRanking } from "@/lib/data/ranking-iti.functions";

export const Route = createFileRoute("/transparencia-institucional")({
  component: TransparenciaPage,
  head: () => ({
    meta: [
      { title: "Transparência institucional — Mutirão de Dados" },
      {
        name: "description",
        content:
          "Índice de Transparência Institucional por órgão: completude, competitividade, diversidade, volume e atualidade dos contratos publicados (Portal CGU e PNCP).",
      },
      { property: "og:title", content: "Transparência institucional — Mutirão de Dados" },
      {
        property: "og:description",
        content:
          "Comparação entre órgãos federais, estaduais e municipais quanto à clareza informacional do gasto contratado.",
      },
    ],
  }),
});

function TransparenciaPage() {
  const fetchRanking = useServerFn(rankingITI);
  const { data, isLoading } = useQuery({
    queryKey: ["ranking-iti"],
    queryFn: () => fetchRanking(),
    staleTime: 5 * 60 * 1000,
  });
  const linhas: LinhaRanking[] = data?.linhas ?? [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      <span className="inline-block text-xs font-semibold tracking-widest text-accent uppercase">
        Análise institucional
      </span>
      <h1 className="font-display text-5xl leading-[0.95] mt-2">Transparência institucional</h1>
      <p className="mt-6 text-lg text-muted-foreground max-w-3xl">
        Comparação entre órgãos públicos a partir da{" "}
        <strong className="text-foreground">clareza informacional</strong> de seus contratos
        publicados (Portal CGU e PNCP — União, Estados, Municípios). O Índice de Transparência
        Institucional (ITI) varia de 0 a 100 e mede o quanto cada órgão facilita a interpretação
        pública do gasto — não a legalidade ou a eficiência administrativa.
      </p>

      <div className="mt-6 border border-border rounded-xl bg-card p-5 text-sm text-muted-foreground">
        <div className="flex items-baseline justify-between flex-wrap gap-3">
          <strong className="text-foreground">Como ler o índice</strong>
          <MetodologiaPopover titulo="Composição do ITI">
            <p>
              <strong>Completude (25%)</strong> — % de contratos com objeto específico (&gt; 30
              caracteres, sem termo genérico).
            </p>
            <p>
              <strong>Competitividade (25%)</strong> — % por pregão ou concorrência.
            </p>
            <p>
              <strong>Diversidade (20%)</strong> — 1 - HHI dos fornecedores. Quanto mais distribuído
              o gasto, maior.
            </p>
            <p>
              <strong>Volume (15%)</strong> — log saturado em 200 contratos.
            </p>
            <p>
              <strong>Atualidade (15%)</strong> — último contrato nos últimos 365 dias.
            </p>
            <p>
              Cálculo apenas sobre os dados já carregados na plataforma. Órgãos sem dados não
              aparecem.
            </p>
          </MetodologiaPopover>
        </div>
        <div className="mt-3 grid sm:grid-cols-3 gap-3 text-xs">
          <Faixa
            rotulo="Alta"
            min={70}
            cor="text-emerald-400"
            descricao="Sinal de boa publicação contratual."
          />
          <Faixa
            rotulo="Média"
            min={45}
            cor="text-amber-400"
            descricao="Aspectos relevantes para revisar."
          />
          <Faixa
            rotulo="Baixa"
            min={0}
            cor="text-rose-400"
            descricao="Publicação opaca; controle social difícil."
          />
        </div>
      </div>

      {isLoading ? (
        <div className="mt-10 text-sm text-muted-foreground">Calculando ranking…</div>
      ) : linhas.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            title="Sem dados carregados"
            hint="A importação de contratos é feita pela equipe administrativa. O índice é calculado assim que houver dados de pelo menos um órgão."
          />
        </div>
      ) : (
        <div className="mt-8 border border-border rounded-xl bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left p-3">Órgão</th>
                <th className="text-left p-3 hidden md:table-cell">Função / esfera</th>
                <th className="text-left p-3 hidden sm:table-cell">Fonte</th>
                <th className="text-right p-3">Amostra</th>
                <th className="text-left p-3 w-48">ITI</th>
                <th className="text-left p-3">Faixa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {linhas.map((l) => (
                <tr key={`${l.fonte}-${l.id}`} className="hover:bg-muted/50">
                  <td className="p-3">
                    {l.fonte === "cgu" ? (
                      <Link
                        to="/orgaos/$cod"
                        params={{ cod: l.id }}
                        className="font-semibold hover:text-accent"
                      >
                        {l.nome}
                      </Link>
                    ) : (
                      <span className="font-semibold">{l.nome}</span>
                    )}
                    <div className="text-xs font-mono text-muted-foreground">{l.sigla}</div>
                  </td>
                  <td className="p-3 hidden md:table-cell text-muted-foreground">{l.funcao}</td>
                  <td className="p-3 hidden sm:table-cell">
                    <span
                      className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded whitespace-nowrap ${
                        l.fonte === "cgu"
                          ? "bg-sky-500/15 text-sky-400"
                          : "bg-violet-500/15 text-violet-400"
                      }`}
                    >
                      {l.fonte === "cgu" ? "Portal CGU" : "PNCP"}
                    </span>
                  </td>
                  <td className="p-3 text-right font-mono">{l.nota.amostra}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span className={`font-mono font-semibold ${corDaFaixa(l.nota.faixa)}`}>
                        {l.nota.nota}
                      </span>
                      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-accent"
                          style={{ width: `${l.nota.nota}%` }}
                          aria-hidden
                        />
                      </div>
                    </div>
                  </td>
                  <td className="p-3">
                    <span
                      className={`text-xs uppercase tracking-wider ${corDaFaixa(l.nota.faixa)}`}
                    >
                      {rotuloDaFaixa(l.nota.faixa)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-8 text-xs text-muted-foreground max-w-3xl leading-relaxed">
        O ITI é uma medida exploratória, não normativa. Não substitui auditorias formais nem avalia
        a regularidade jurídica dos atos administrativos. A nota depende do que a plataforma já
        baixou — veja a{" "}
        <Link to="/cobertura" className="text-accent underline">
          cobertura dos dados
        </Link>{" "}
        para entender o escopo. Veja também a{" "}
        <Link to="/metodologia" className="text-accent underline">
          Metodologia
        </Link>{" "}
        e o{" "}
        <Link to="/tratamento-de-dados" className="text-accent underline">
          Tratamento de Dados
        </Link>
        .
      </p>
    </div>
  );
}

function Faixa({
  rotulo,
  min,
  cor,
  descricao,
}: {
  rotulo: string;
  min: number;
  cor: string;
  descricao: string;
}) {
  return (
    <div className="border border-border rounded-lg p-3 bg-background/40">
      <div className={`font-semibold ${cor}`}>
        {rotulo} <span className="font-mono text-[10px] text-muted-foreground">≥ {min}</span>
      </div>
      <div className="text-muted-foreground mt-1">{descricao}</div>
    </div>
  );
}
