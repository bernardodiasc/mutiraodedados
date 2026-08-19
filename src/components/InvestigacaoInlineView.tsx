import * as React from "react";
import { Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnomaliaInvestigacao } from "@/components/AnomaliaInvestigacao";
import type { AnomaliaInput } from "@/lib/anomalia";
import type { AnomaliaActions, AnomaliaInvestigacaoCurl } from "@/lib/anomalia-investigacao/types";

export type InvestigacaoInlineViewProps = {
  children: React.ReactNode;
  isLoading: boolean;
  finding: AnomaliaInput | null | undefined;
  promovendo: boolean;
  onPromover: () => void;
  curls?: AnomaliaInvestigacaoCurl[];
  actions?: AnomaliaActions;
  notaInicial?: string | null;
};

export function InvestigacaoInlineView({
  children,
  isLoading,
  finding,
  promovendo,
  onPromover,
  curls,
  actions,
  notaInicial,
}: InvestigacaoInlineViewProps) {
  return (
    <article className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="p-4">{children}</div>
      <div className="border-t border-border bg-muted/30">
        {isLoading || (!finding && promovendo) ? (
          <div className="p-3 text-xs text-muted-foreground inline-flex items-center gap-2">
            <Loader2 className="size-3.5 animate-spin" /> Abrindo investigação…
          </div>
        ) : !finding ? (
          <div className="p-3">
            <Button size="sm" variant="outline" disabled={promovendo} onClick={onPromover}>
              {promovendo ? (
                <Loader2 className="size-3.5 mr-1.5 animate-spin" />
              ) : (
                <Search className="size-3.5 mr-1.5" />
              )}
              Abrir investigação manualmente
            </Button>
          </div>
        ) : (
          <AnomaliaInvestigacao
            anomalia={finding}
            notaInicial={notaInicial ?? null}
            flush
            curls={curls}
            actions={actions}
          />
        )}
      </div>
    </article>
  );
}

InvestigacaoInlineView.displayName = "InvestigacaoInlineView";
