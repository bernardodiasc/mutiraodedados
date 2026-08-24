import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Cartão padrão do site — o idiom `border border-border rounded-xl p-5 bg-card`
 * que as rotas repetiam à mão (e as `function Card` locais que cada detalhe
 * redefinia). Novas páginas usam estes componentes; as antigas migram conforme
 * forem tocadas.
 *
 * Nota: a regra global de styles.css dá sombra + lift automático a `a[href]`
 * com `rounded`+`border`. Um `<Link>` que envolva um Cartao herda esse efeito;
 * quando não quiser, ponha `data-flat` no elemento clicável.
 */
export function Cartao({
  titulo,
  icone: Icone,
  className,
  children,
}: {
  titulo?: string;
  icone?: LucideIcon;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("border border-border rounded-xl p-5 bg-card", className)}>
      {titulo && (
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
          {Icone && <Icone className="size-3.5" aria-hidden />}
          {titulo}
        </div>
      )}
      {children}
    </section>
  );
}
Cartao.displayName = "Cartao";

/** Número de destaque com rótulo — o idiom "Stat" dos cabeçalhos de detalhe. */
export function Estatistica({
  rotulo,
  valor,
  detalhe,
  className,
}: {
  rotulo: string;
  valor: React.ReactNode;
  detalhe?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("border border-border rounded-xl p-5 bg-card", className)}>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{rotulo}</div>
      <div className="font-display text-3xl mt-1">{valor}</div>
      {detalhe && <div className="text-xs text-muted-foreground mt-1">{detalhe}</div>}
    </div>
  );
}
Estatistica.displayName = "Estatistica";

/** Par rótulo/valor — o idiom "Field" das fichas de detalhe. */
export function CampoDado({
  rotulo,
  children,
  className,
}: {
  rotulo: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{rotulo}</div>
      <div className="text-sm mt-0.5">{children}</div>
    </div>
  );
}
CampoDado.displayName = "CampoDado";
