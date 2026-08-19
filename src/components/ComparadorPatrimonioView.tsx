import { ArrowLeftRight, Loader2 } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { RotuloVariacao } from "@/components/HistoricoCandidaturasView";
import { fmtBRL } from "@/lib/fmt";
import { diffCategorias, variacaoEntre } from "@/lib/candidato-ficha/logic";
import type { CandidaturaHistorico } from "@/lib/candidato-ficha/logic";
import type { ComparacaoBens, LadoComparacao } from "@/lib/data/tse/queries.functions";

export type ComparadorPatrimonioViewProps = {
  /** Opções do seletor: as demais candidaturas da mesma pessoa. */
  opcoes: CandidaturaHistorico[];
  /** `sq` da candidatura escolhida para comparação. */
  sqSelecionado: string | null;
  onSelecionar: (sq: string) => void;
  carregando: boolean;
  erro: boolean;
  comparacao: ComparacaoBens | null;
};

export function ComparadorPatrimonioView({
  opcoes,
  sqSelecionado,
  onSelecionar,
  carregando,
  erro,
  comparacao,
}: ComparadorPatrimonioViewProps) {
  if (opcoes.length === 0) return null;

  return (
    <section className="border border-border rounded-xl p-5 bg-card">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <h2 className="font-display text-lg flex items-center gap-2">
          <ArrowLeftRight className="size-4 text-accent" /> Comparar patrimônio
        </h2>
        <label className="text-sm flex items-center gap-2">
          <span className="text-muted-foreground">Comparar com</span>
          <select
            className="rounded-md border border-input bg-background px-2 py-1"
            value={sqSelecionado ?? ""}
            onChange={(e) => onSelecionar(e.target.value)}
          >
            {opcoes.map((o) => (
              <option key={o.sq} value={o.sq}>
                {o.ano} — {o.cargo ?? "cargo não informado"}
              </option>
            ))}
          </select>
        </label>
      </div>

      {erro && <p className="text-destructive text-sm mt-3">Não consegui carregar a comparação.</p>}

      {carregando && !comparacao && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-8 justify-center">
          <Loader2 className="size-4 animate-spin" /> Carregando os bens das duas candidaturas…
        </div>
      )}

      {comparacao && <Corpo comparacao={comparacao} atenuado={carregando} />}

      <p className="text-xs text-muted-foreground mt-4 border-t border-border/60 pt-3">
        Valores nominais, como declarados ao TSE em cada eleição — sem correção monetária, então
        parte da variação é apenas a inflação do período. As duas listas ficam lado a lado de
        propósito: a descrição dos bens é texto livre, e parear item a item entre anos seria chute.
      </p>
    </section>
  );
}
ComparadorPatrimonioView.displayName = "ComparadorPatrimonioView";

function Corpo({ comparacao, atenuado }: { comparacao: ComparacaoBens; atenuado: boolean }) {
  // A é sempre a mais antiga: a variação lida da esquerda para a direita.
  const [antiga, recente] =
    comparacao.a.ano <= comparacao.b.ano
      ? [comparacao.a, comparacao.b]
      : [comparacao.b, comparacao.a];

  const semDados = (l: LadoComparacao) => l.totalDeclarado == null && l.quantidadeBens === 0;
  if (semDados(antiga) || semDados(recente)) {
    const faltante = semDados(antiga) ? antiga : recente;
    return (
      <div className="mt-4">
        <EmptyState
          title={`Sem declaração de bens em ${faltante.ano}`}
          hint="Ou a pessoa não declarou bens nessa eleição, ou o arquivo de bens desse ano ainda não foi importado. Sem os dois lados não dá para comparar."
        />
      </div>
    );
  }

  const totalAntiga = antiga.totalDeclarado ?? antiga.totalLinhas;
  const totalRecente = recente.totalDeclarado ?? recente.totalLinhas;
  const linhas = diffCategorias(antiga.categorias, recente.categorias);

  return (
    <div className={atenuado ? "opacity-60 transition-opacity" : "transition-opacity"}>
      <div className="grid gap-3 mt-4 sm:grid-cols-3 items-baseline">
        <Totalzinho lado={antiga} total={totalAntiga} />
        <div className="text-center">
          <RotuloVariacao variacao={variacaoEntre(totalAntiga, totalRecente)} />
        </div>
        <Totalzinho lado={recente} total={totalRecente} alinharDireita />
      </div>

      <h3 className="font-display text-base mt-6">Por categoria de bem</h3>
      <ul className="grid gap-1 mt-2 text-sm">
        {linhas.map((l) => (
          <li
            key={l.categoria}
            className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_auto_auto_auto] gap-x-4 border-b border-border/60 py-1 items-baseline"
          >
            <span className="text-muted-foreground">{l.rotulo}</span>
            <span className="font-mono hidden sm:inline">{fmtBRL(l.totalA)}</span>
            <span className="font-mono hidden sm:inline">{fmtBRL(l.totalB)}</span>
            <span className="text-xs text-right">
              <RotuloVariacao variacao={l.variacao} />
            </span>
          </li>
        ))}
      </ul>

      <div className="grid gap-6 mt-6 sm:grid-cols-2">
        <ColunaBens lado={antiga} />
        <ColunaBens lado={recente} />
      </div>
    </div>
  );
}

function Totalzinho({
  lado,
  total,
  alinharDireita,
}: {
  lado: LadoComparacao;
  total: number;
  alinharDireita?: boolean;
}) {
  return (
    <div className={alinharDireita ? "sm:text-right" : ""}>
      <p className="text-xs text-muted-foreground">
        {lado.ano} · {lado.cargo ?? "cargo não informado"}
      </p>
      <p className="font-mono text-xl">{fmtBRL(total)}</p>
    </div>
  );
}

function ColunaBens({ lado }: { lado: LadoComparacao }) {
  return (
    <div>
      <h4 className="text-sm font-medium">
        Bens em {lado.ano}{" "}
        <span className="text-muted-foreground font-normal">
          ({lado.quantidadeBens} {lado.quantidadeBens === 1 ? "item" : "itens"})
        </span>
      </h4>
      {lado.bens.length === 0 ? (
        <p className="text-sm text-muted-foreground mt-2">Nenhum bem declarado nesta eleição.</p>
      ) : (
        <>
          <ul className="grid gap-1 mt-2 text-sm">
            {lado.bens.map((b) => (
              <li key={b.ordem_bem} className="border-b border-border/60 py-1">
                <span className="text-muted-foreground">
                  {b.tipo_bem ?? "Bem"} — {b.descricao ?? "sem descrição"}
                </span>
                <span className="block font-mono">{b.valor != null ? fmtBRL(b.valor) : "—"}</span>
              </li>
            ))}
          </ul>
          {lado.bens.length < lado.quantidadeBens && (
            <p className="text-xs text-muted-foreground mt-2">
              Mostrando os {lado.bens.length} maiores de {lado.quantidadeBens}.
            </p>
          )}
          {lado.truncado && (
            <p className="text-xs text-muted-foreground mt-1">
              A declaração tem mais itens do que conseguimos ler de uma vez — os totais acima podem
              estar subestimados.
            </p>
          )}
        </>
      )}
    </div>
  );
}
