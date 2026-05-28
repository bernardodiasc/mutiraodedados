import { createFileRoute, Link } from "@tanstack/react-router";
import * as React from "react";
import { useDataSource } from "@/lib/data-store";
import { EmptyState } from "@/components/EmptyState";
import { AlertTriangle, Info } from "lucide-react";
import { ChecklistInvestigacao } from "@/components/ChecklistInvestigacao";
import { AvisoMetodologico } from "@/components/AvisoMetodologico";

export const Route = createFileRoute("/anomalias")({
  component: AnomaliasPage,
  head: () => ({
    meta: [
      { title: "Anomalias detectadas — Auditoria Cidadã" },
      { name: "description", content: "Padrões fora do esperado em contratos e gastos federais, com critério, severidade e checklist de investigação." },
      { property: "og:title", content: "Anomalias detectadas em gastos federais" },
      { property: "og:description", content: "Sinais investigativos com critério, severidade e contexto — ponto de partida para o controle social." },
      { property: "og:url", content: "https://auditoriacidada.ia.br/anomalias" },
    ],
    links: [{ rel: "canonical", href: "https://auditoriacidada.ia.br/anomalias" }],
  }),
});

const SEV_STYLES: Record<string, string> = {
  alta: "bg-destructive/10 text-destructive border-destructive/30",
  media: "bg-muted text-foreground border-border",
  baixa: "bg-muted text-muted-foreground border-border",
};

const REGRAS: Record<string, { label: string; criterio: string }> = {
  crescimento_abrupto:    { label: "Crescimento abrupto",       criterio: "Fornecedor: receita > 3× ano anterior (base ≥ R$ 500k)." },
  fracionamento:          { label: "Fracionamento de despesa",  criterio: "≥5 dispensas no mesmo órgão+fornecedor+ano abaixo do teto de R$ 17.600." },
  concentracao:           { label: "Concentração de fornecedor",criterio: "Fornecedor concentra > 60% do contratado por um órgão num ano (> R$ 2M)." },
  outlier_valor:          { label: "Outlier de valor",          criterio: "Contrato com valor ≥ 3 desvios-padrão acima da média." },
  fornecedor_recente_alto:{ label: "Fornecedor recém-chegado",  criterio: "Primeira aparição há < 1 ano e já recebeu contrato ≥ R$ 1M." },
  descricao_generica:     { label: "Descrição genérica",        criterio: "Objeto contratual muito curto ou vago para um valor ≥ R$ 200k." },
  dispensa_recorrente:    { label: "Dispensa recorrente",       criterio: "≥3 dispensas/ano com o mesmo fornecedor em ≥2 anos consecutivos." },
  crescimento_orgao:      { label: "Crescimento do órgão",      criterio: "Gasto anual do órgão ≥ 2× mediana dos 3 anos anteriores (baseline ≥ R$ 1M)." },
};

function AnomaliasPage() {
  const ds = useDataSource();
  const all = ds.listAnomalias().sort((a, b) => {
    const order: Record<string, number> = { alta: 0, media: 1, baixa: 2 };
    return order[a.severidade] - order[b.severidade];
  });
  const [regraSel, setRegraSel] = React.useState<string | null>(null);
  const [sevSel, setSevSel] = React.useState<string | null>(null);

  const flags = all.filter(f => (!regraSel || f.regra === regraSel) && (!sevSel || f.severidade === sevSel));

  const countRegra = (k: string) => all.filter(f => f.regra === k).length;
  const countSev = (k: string) => all.filter(f => f.severidade === k).length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-4xl">Sinais investigativos</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            Padrões estatísticos extraídos automaticamente dos dados carregados. Cada sinal
            traz hipótese, parâmetros e vínculo com o dispositivo legal pertinente. Servem
            como ponto de partida para checagem cidadã, jornalística ou institucional.
          </p>
        </div>
      </div>

      <div className="mt-6"><AvisoMetodologico /></div>

      <div className="mt-6 flex flex-wrap gap-2">
        <span className="text-[11px] uppercase tracking-widest text-muted-foreground self-center mr-1">Severidade</span>
        {(["alta","media","baixa"] as const).map(s => (
          <button
            key={s}
            onClick={() => setSevSel(sevSel === s ? null : s)}
            className={`text-xs px-3 py-1 rounded-full border transition ${sevSel===s ? "bg-foreground text-background border-foreground" : "bg-card border-border hover:bg-muted"}`}
          >{s} <span className="opacity-60 ml-1">{countSev(s)}</span></button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="text-[11px] uppercase tracking-widest text-muted-foreground self-center mr-1">Regra</span>
        {Object.entries(REGRAS).map(([k, v]) => (
          <button
            key={k}
            onClick={() => setRegraSel(regraSel === k ? null : k)}
            title={v.criterio}
            className={`text-xs px-3 py-1 rounded-full border transition ${regraSel===k ? "bg-accent text-accent-foreground border-accent" : "bg-card border-border hover:bg-muted"}`}
          >{v.label} <span className="opacity-60 ml-1">{countRegra(k)}</span></button>
        ))}
        {(regraSel || sevSel) && (
          <button onClick={() => { setRegraSel(null); setSevSel(null); }} className="text-xs px-3 py-1 rounded-full border border-border text-muted-foreground hover:bg-muted">
            Limpar filtros
          </button>
        )}
      </div>

      <div className="mt-4 flex items-start gap-2 text-xs text-muted-foreground border border-border rounded-md bg-card p-3">
        <Info className="size-4 shrink-0 mt-0.5" />
        <span>
          Antes de tirar qualquer conclusão, abra o caso e leia o contexto. A página{" "}
          <Link to="/aprender" className="text-accent underline">Aprender</Link> distingue
          anomalia, indício e irregularidade — vocabulário essencial para uso responsável
          destes indicadores.
        </span>
      </div>

      <div className="mt-8 space-y-3">
        {flags.length === 0 ? (
          <EmptyState
            title="Nenhuma anomalia para mostrar"
            hint={all.length === 0 ? "Carregue contratos reais pelo admin para que o detector tenha base de cálculo." : "Nenhuma anomalia bate com os filtros selecionados."}
          />
        ) : flags.map(f => (
          <article key={f.id} className={`border rounded-xl p-5 ${SEV_STYLES[f.severidade]}`}>
            <div className="flex items-start gap-3">
              <AlertTriangle className="size-5 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest font-bold">
                  <span>{f.severidade}</span>
                  <span className="opacity-50">·</span>
                  <span>{REGRAS[f.regra]?.label ?? f.regra}</span>
                </div>
                <h3 className="font-display text-xl mt-1 leading-tight text-foreground">{f.titulo}</h3>
                <div className="text-sm text-foreground/80 mt-1">
                  Em{" "}
                  <Link
                    to={f.entidadeTipo === "orgao" ? "/orgaos/$cod" : f.entidadeTipo === "fornecedor" ? "/fornecedores/$cnpj" : "/contratos/$id"}
                    params={f.entidadeTipo === "orgao" ? { cod: f.entidadeId } : f.entidadeTipo === "fornecedor" ? { cnpj: f.entidadeId } : { id: f.entidadeId }}
                    className="font-semibold underline underline-offset-2"
                  >
                    {f.entidadeNome}
                  </Link>
                </div>
                <p className="text-sm mt-3 text-foreground/90">{f.explicacao}</p>
                <div className="mt-3 flex items-center gap-2">
                  <ChecklistInvestigacao anomalia={f} />
                  <span className="text-[11px] text-muted-foreground italic">
                    Padrão incomum — não comprova irregularidade.
                  </span>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
