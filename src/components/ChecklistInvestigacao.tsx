import { PainelInvestigarView } from "@/components/PainelInvestigarView";
import { passosParaAnomalia } from "@/lib/painel-investigar/logic";
import type { Anomalia } from "@/lib/data/types";

/**
 * Shim de compatibilidade: /anomalias segue chamando ChecklistInvestigacao;
 * o painel em si é o PainelInvestigar (padrão do site).
 */
export function ChecklistInvestigacao({ anomalia }: { anomalia: Anomalia }) {
  return (
    <PainelInvestigarView
      passos={passosParaAnomalia(anomalia)}
      rotuloGatilho="Investigar este caso"
    />
  );
}
