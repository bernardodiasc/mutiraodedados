import { Link } from "@tanstack/react-router";
import { Landmark } from "lucide-react";
import { fmtBRL, fmtPct } from "@/lib/fmt";
import {
  anotarVariacoes,
  barrasPatrimonio,
  serieBens,
  type CandidaturaAnotada,
  type CandidaturaHistorico,
  type Variacao,
} from "@/lib/candidato-ficha/logic";

export type HistoricoCandidaturasViewProps = {
  candidaturas: CandidaturaHistorico[];
  /** CPF ausente/sentinela na fonte: não dá para ligar a outras candidaturas. */
  indisponivel: boolean;
};

export function HistoricoCandidaturasView({
  candidaturas,
  indisponivel,
}: HistoricoCandidaturasViewProps) {
  const linhas = anotarVariacoes(candidaturas);
  const barras = barrasPatrimonio(serieBens(candidaturas));
  const temAlgumaBarra = barras.some((b) => !b.ausente);

  return (
    <section className="border border-border rounded-xl p-5 bg-card">
      <h2 className="font-display text-lg flex items-center gap-2">
        <Landmark className="size-4 text-accent" /> Histórico de candidaturas
      </h2>

      {indisponivel ? (
        <p className="text-sm text-muted-foreground mt-2">
          O TSE não divulgou nem o título eleitoral nem o CPF nesta candidatura, então não dá para
          ligá-la com segurança a outras candidaturas da mesma pessoa.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground mt-2">
          {linhas.length === 1
            ? "Nos anos já importados, esta é a única candidatura desta pessoa."
            : `${linhas.length} candidaturas da mesma pessoa, do mais recente para o mais antigo.`}
        </p>
      )}

      {temAlgumaBarra && <BarrasPatrimonio barras={barras} />}

      <ul className="grid gap-1 mt-4 text-sm">
        {linhas.map((l) => (
          <LinhaCandidatura key={`${l.sq}-${l.ano}`} linha={l} />
        ))}
      </ul>

      <p className="text-xs text-muted-foreground mt-4 border-t border-border/60 pt-3">
        Valores nominais, como declarados ao TSE em cada eleição — sem correção monetária, então
        parte da variação é apenas a inflação do período. Anos sem barra ainda não tiveram a
        declaração de bens importada, ou a pessoa não declarou bens.
      </p>
    </section>
  );
}
HistoricoCandidaturasView.displayName = "HistoricoCandidaturasView";

function LinhaCandidatura({ linha }: { linha: CandidaturaAnotada }) {
  const rotulo = [linha.cargo ?? "cargo não informado", linha.uf, linha.partido]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border/60 py-2">
      <div className="min-w-0">
        <span className="font-mono text-muted-foreground mr-2">{linha.ano}</span>
        {linha.atual ? (
          <span className="font-medium">{rotulo}</span>
        ) : (
          <Link
            to="/eleicoes/candidatos/$sq"
            params={{ sq: linha.sq }}
            search={{ ano: linha.ano }}
            className="hover:text-accent"
          >
            {rotulo}
          </Link>
        )}
        {linha.atual && (
          <span className="text-xs text-muted-foreground ml-2">(esta candidatura)</span>
        )}
        {linha.situacao && (
          <span className="block text-xs text-muted-foreground">{linha.situacao}</span>
        )}
        {linha.outrasNoMesmoAno > 0 && (
          <span className="block text-xs text-muted-foreground">
            Há mais de um registro de candidatura neste ano na fonte.
          </span>
        )}
      </div>
      <div className="text-right shrink-0">
        {linha.bensTotal == null ? (
          <span className="text-muted-foreground">sem dados</span>
        ) : (
          <span className="font-mono">{fmtBRL(linha.bensTotal)}</span>
        )}
        <span className="block text-xs">
          <RotuloVariacao variacao={linha.variacao} />
        </span>
      </div>
    </li>
  );
}

export function RotuloVariacao({ variacao }: { variacao: Variacao }) {
  if (variacao.motivo === "sem-anterior") {
    return <span className="text-muted-foreground">primeira candidatura registrada</span>;
  }
  if (variacao.motivo === "anterior-ausente") {
    return <span className="text-muted-foreground">sem base para comparar</span>;
  }
  if (variacao.motivo === "atual-ausente") {
    return <span className="text-muted-foreground">—</span>;
  }
  if (variacao.motivo === "anterior-zero") {
    return (
      <span className="text-muted-foreground">
        {variacao.delta != null ? `+${fmtBRL(variacao.delta)} vindo de zero` : "vindo de zero"}
      </span>
    );
  }
  if (variacao.fracao == null) return <span className="text-muted-foreground">—</span>;

  const cresceu = variacao.fracao > 0;
  const sinal = cresceu ? "+" : "";
  return (
    <span className={cresceu ? "text-foreground" : "text-muted-foreground"}>
      {sinal}
      {fmtPct(variacao.fracao)}
      {variacao.delta != null && (
        <span className="text-muted-foreground">
          {" "}
          ({sinal}
          {fmtBRL(variacao.delta)})
        </span>
      )}
    </span>
  );
}

/**
 * Minigráfico em CSS puro, como `BarraAnos` em CoberturaSecao.
 *
 * Recharts entraria no bundle de uma página pública por causa de meia dúzia de
 * barras, e o que ele torna difícil é justamente o que aqui importa: distinguir
 * "sem dado" (lacuna tracejada) de "declarou zero" (traço na linha de base).
 */
function BarrasPatrimonio({ barras }: { barras: ReturnType<typeof barrasPatrimonio> }) {
  return (
    <div className="flex items-end gap-2 h-28 mt-4">
      {barras.map((b) => (
        <div key={b.ano} className="flex-1 flex flex-col h-full">
          <div className="flex-1 flex items-end">
            {b.ausente ? (
              <div
                role="img"
                className="w-full h-full rounded-t border border-dashed border-border/70"
                title={`${b.ano}: sem dados`}
                aria-label={`${b.ano}: sem dados`}
              />
            ) : b.zero ? (
              <div
                role="img"
                className="w-full h-0.5 bg-muted-foreground/60"
                title={`${b.ano}: R$ 0,00 declarado`}
                aria-label={`${b.ano}: zero declarado`}
              />
            ) : (
              <div
                role="img"
                className="w-full bg-accent/70 rounded-t"
                style={{ height: `${b.alturaPct}%` }}
                title={`${b.ano}: ${fmtBRL(b.total as number)}`}
                aria-label={`${b.ano}: ${fmtBRL(b.total as number)}`}
              />
            )}
          </div>
          <span className="text-[10px] text-muted-foreground mt-1 font-mono text-center">
            {b.ano}
          </span>
        </div>
      ))}
    </div>
  );
}
