import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  calcularTotalPaginas,
  intervaloExibido,
  montarIntervaloPaginas,
} from "@/lib/listagem/logic";

export type ControlePaginacaoProps = {
  pagina: number;
  itens: number;
  total: number;
  /** Rota da listagem (ex.: "/licitacoes"). */
  to: string;
  /**
   * Monta o objeto search completo de uma página — preservando filtros,
   * ordenação e o corte `ate`, para que cada link seja compartilhável e
   * mostre sempre os mesmos registros.
   */
  montarSearch: (pagina: number) => Record<string, unknown>;
  className?: string;
};

/**
 * Navegação numérica padrão das listagens — renderizada acima E abaixo da
 * lista. Links reais (abrem em nova aba, URL compartilhável), nunca botão
 * com estado fora da URL.
 */
export function ControlePaginacao({
  pagina,
  itens,
  total,
  to,
  montarSearch,
  className,
}: ControlePaginacaoProps) {
  const totalPaginas = calcularTotalPaginas(total, itens);
  const { de, ate } = intervaloExibido(pagina, itens, total);

  return (
    <nav
      aria-label="Paginação"
      className={cn("flex flex-wrap items-center justify-between gap-2 text-sm", className)}
    >
      <span className="text-xs text-muted-foreground tabular-nums">
        {total > 0
          ? `${de.toLocaleString("pt-BR")}–${ate.toLocaleString("pt-BR")} de ${total.toLocaleString("pt-BR")}`
          : "0 registros"}
      </span>
      {totalPaginas > 1 && (
        <div className="flex flex-wrap items-center gap-1">
          <LinkPagina
            to={to}
            search={montarSearch(pagina - 1)}
            desabilitado={pagina <= 1}
            rotulo="Página anterior"
          >
            <ChevronLeft className="size-3.5" aria-hidden />
          </LinkPagina>
          {montarIntervaloPaginas(pagina, totalPaginas).map((p, i) =>
            p === "…" ? (
              <span key={`e-${i}`} className="px-1 text-muted-foreground" aria-hidden>
                …
              </span>
            ) : (
              <LinkPagina
                key={p}
                to={to}
                search={montarSearch(p)}
                atual={p === pagina}
                rotulo={`Página ${p}`}
              >
                {p}
              </LinkPagina>
            ),
          )}
          <LinkPagina
            to={to}
            search={montarSearch(pagina + 1)}
            desabilitado={pagina >= totalPaginas}
            rotulo="Próxima página"
          >
            <ChevronRight className="size-3.5" aria-hidden />
          </LinkPagina>
        </div>
      )}
    </nav>
  );
}
ControlePaginacao.displayName = "ControlePaginacao";

function LinkPagina({
  to,
  search,
  atual = false,
  desabilitado = false,
  rotulo,
  children,
}: {
  to: string;
  search: Record<string, unknown>;
  atual?: boolean;
  desabilitado?: boolean;
  rotulo: string;
  children: React.ReactNode;
}) {
  const classe = cn(
    "inline-flex items-center justify-center min-w-8 h-8 px-2 rounded-md border text-xs tabular-nums",
    atual
      ? "border-accent bg-accent/15 text-accent font-semibold"
      : "border-border bg-background text-muted-foreground hover:border-accent/50 hover:text-foreground",
    desabilitado && "opacity-40 pointer-events-none",
  );
  if (desabilitado) {
    return (
      <span className={classe} aria-disabled>
        {children}
      </span>
    );
  }
  return (
    // data-flat: sem o lift automático de a[href] com rounded+border — são
    // botões pequenos de navegação, não cards. Cast: componente genérico
    // orientado a dados; os chamadores passam rotas existentes.
    <Link
      to={to as never}
      search={search as never}
      data-flat
      aria-label={rotulo}
      aria-current={atual ? "page" : undefined}
      className={classe}
      resetScroll={false}
    >
      {children}
    </Link>
  );
}
