import * as React from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown, HelpCircle, ShieldAlert, type LucideIcon } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export type PainelExplicarProps = {
  /** Título da linha fechada — a pergunta que o visitante faria. */
  titulo: string;
  icone?: LucideIcon;
  abertoInicial?: boolean;
  /**
   * Rodapé "sinais investigativos, não acusações" — usar SOMENTE em páginas
   * que exibem sinais (anomalias, qualidade, lacunas, radar de risco).
   */
  avisoSinais?: boolean;
  children: React.ReactNode;
};

/**
 * Painel "Explicar" — o colapsável padrão do site para explicação que não
 * cabe no parágrafo de abertura sem soterrar a página. Fica no fluxo, fechado
 * por padrão; a tela mostra os dados e a explicação fica a um clique.
 *
 * Divisão de papéis: micro-explicação pontual ao lado de um número específico
 * é `MetodologiaPopover`; instrução de investigação (passo a passo, prompts)
 * é `PainelInvestigar` (Sheet lateral).
 */
export function PainelExplicar({
  titulo,
  icone: Icone = HelpCircle,
  abertoInicial = false,
  avisoSinais = false,
  children,
}: PainelExplicarProps) {
  const [aberto, setAberto] = React.useState(abertoInicial);
  return (
    <Collapsible
      open={aberto}
      onOpenChange={setAberto}
      className="rounded-lg border border-border bg-card/50 text-sm"
    >
      <CollapsibleTrigger className="w-full cursor-pointer px-4 py-3 font-medium flex items-center gap-2 text-muted-foreground hover:text-foreground text-left">
        <Icone className="size-4 shrink-0 text-accent" aria-hidden />
        <span className="flex-1">{titulo}</span>
        <ChevronDown
          className={`size-4 shrink-0 transition-transform ${aberto ? "rotate-180" : ""}`}
          aria-hidden
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-4 pb-4 pt-1 space-y-3 text-muted-foreground leading-relaxed">
          {children}
          {avisoSinais && (
            <p className="flex items-start gap-2 border-t border-border/60 pt-3 text-xs leading-relaxed">
              <ShieldAlert className="size-3.5 shrink-0 mt-0.5" aria-hidden />
              <span>
                <strong className="text-foreground">Sinais investigativos, não acusações.</strong>{" "}
                Os indicadores desta página são padrões estatísticos extraídos automaticamente de
                dados públicos — não constituem indício jurídico nem conclusão sobre conduta, e
                podem ter explicação legítima.{" "}
                <Link to="/metodologia" className="text-accent underline">
                  Leia a metodologia
                </Link>{" "}
                ou{" "}
                <Link to="/contestar" className="text-accent underline">
                  conteste uma análise
                </Link>
                .
              </span>
            </p>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
PainelExplicar.displayName = "PainelExplicar";
