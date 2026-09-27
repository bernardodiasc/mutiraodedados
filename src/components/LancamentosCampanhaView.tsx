import { ArrowDownToLine, ArrowUpFromLine, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fmtBRL, fmtNum } from "@/lib/fmt";
import { ancoraLancamento, type TipoLancamento } from "@/lib/contas-campanha/logic";
import type { LancamentoCampanha } from "@/lib/data/tse/queries.functions";
import { cn } from "@/lib/utils";

export type LancamentosCampanhaViewProps = {
  tipo: TipoLancamento;
  ano: number;
  carregando: boolean;
  /** Trocando de página (a lista anterior continua na tela). */
  atualizando: boolean;
  erro: boolean;
  pagina: number;
  porPagina: number;
  total: number;
  linhas: LancamentoCampanha[];
  /** Id do lançamento indicado pelo link: a linha fica destacada. */
  foco?: string;
  onPagina: (pagina: number) => void;
};

const TEXTO = {
  receitas: {
    titulo: "Receitas",
    Icone: ArrowDownToLine,
    quem: "Doador não informado",
  },
  despesas: {
    titulo: "Despesas contratadas",
    Icone: ArrowUpFromLine,
    quem: "Fornecedor não informado",
  },
} as const;

function fmtData(iso: string | null): string | null {
  if (!iso) return null;
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

/**
 * Lançamentos de campanha, um por linha, das maiores para as menores. Cada
 * linha tem âncora estável (`#receita-<id>`, `#despesa-<id>`), destino da
 * busca. Some quando a campanha não tem lançamentos desse tipo no acervo.
 */
export function LancamentosCampanhaView({
  tipo,
  ano,
  carregando,
  atualizando,
  erro,
  pagina,
  porPagina,
  total,
  linhas,
  foco,
  onPagina,
}: LancamentosCampanhaViewProps) {
  if (carregando || (!erro && total === 0)) return null;
  const { titulo, Icone, quem } = TEXTO[tipo];
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));
  const de = (pagina - 1) * porPagina + 1;
  const ate = Math.min(pagina * porPagina, total);

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="font-display text-lg flex items-center gap-2">
        <Icone className="size-4 text-accent" aria-hidden /> {titulo} · {ano}
      </h2>
      {erro ? (
        <p className="text-sm text-destructive mt-2">Não consegui carregar os lançamentos.</p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground mt-1">
            {fmtNum(total)} lançamento(s), dos maiores para os menores. Pessoa física aparece pelo
            nome, com o CPF mascarado como o TSE publica.
          </p>
          <ul className={cn("grid gap-1 mt-3 text-sm", atualizando && "opacity-60")}>
            {linhas.map((l) => (
              <li
                key={l.id}
                id={ancoraLancamento(tipo, l.id)}
                className={cn(
                  "flex justify-between gap-4 border-b border-border/60 py-1 scroll-mt-28 target:bg-accent/10",
                  l.id === foco && "bg-accent/10",
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate" title={l.nome ?? undefined}>
                    {l.nome ?? quem}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {[l.documento, l.tipo, l.detalhe, fmtData(l.data)].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="font-mono shrink-0">
                  {l.valor != null ? fmtBRL(l.valor) : "—"}
                </span>
              </li>
            ))}
          </ul>
          {totalPaginas > 1 && (
            <nav
              aria-label={`Paginação de ${titulo.toLowerCase()}`}
              className="flex items-center justify-between gap-2 mt-3 text-sm"
            >
              <span className="text-xs text-muted-foreground tabular-nums">
                {fmtNum(de)}–{fmtNum(ate)} de {fmtNum(total)}
              </span>
              <span className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagina <= 1 || atualizando}
                  onClick={() => onPagina(pagina - 1)}
                  aria-label="Página anterior"
                >
                  <ChevronLeft className="size-3.5" aria-hidden />
                </Button>
                <span className="text-xs tabular-nums px-1">
                  {pagina} / {totalPaginas}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagina >= totalPaginas || atualizando}
                  onClick={() => onPagina(pagina + 1)}
                  aria-label="Próxima página"
                >
                  <ChevronRight className="size-3.5" aria-hidden />
                </Button>
              </span>
            </nav>
          )}
        </>
      )}
    </section>
  );
}
LancamentosCampanhaView.displayName = "LancamentosCampanhaView";
