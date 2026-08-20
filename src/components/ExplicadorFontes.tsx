import * as React from "react";
import { HelpCircle } from "lucide-react";

/**
 * Colapsível "de onde vêm estes dados?" para páginas-tema.
 *
 * As páginas com seletor de fonte/ângulo (contratos, convênios) carregam uma
 * relação entre sistemas que confunde até quem opera o site — sistema
 * operacional × portal de publicidade, espelho × publicação primária. A
 * explicação completa não cabe no parágrafo de abertura sem soterrar a
 * página; aqui ela fica a um clique, fechada por padrão, no mesmo padrão de
 * colapsível que /qualidade usa.
 */
export function ExplicadorFontes({
  resumo,
  children,
}: {
  /** Título da linha fechada — a pergunta que o visitante faria. */
  resumo: string;
  children: React.ReactNode;
}) {
  return (
    <details className="rounded-xl border border-border bg-muted/30 group">
      <summary className="cursor-pointer select-none px-4 py-2.5 text-sm flex items-center gap-2 text-muted-foreground hover:text-foreground">
        <HelpCircle className="size-3.5 shrink-0" />
        <span className="font-medium">{resumo}</span>
      </summary>
      <div className="px-4 pb-4 pt-1 text-sm text-muted-foreground leading-relaxed space-y-2 border-t border-border/60">
        {children}
      </div>
    </details>
  );
}
