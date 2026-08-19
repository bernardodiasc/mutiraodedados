import * as React from "react";
import { AnomaliaInvestigacaoView } from "@/components/AnomaliaInvestigacaoView";
import type { AnomaliaInput } from "@/lib/anomalia";
import type { AnomaliaActions, AnomaliaInvestigacaoCurl } from "@/lib/anomalia-investigacao/types";

export type AnomaliaInvestigacaoContainerProps = {
  anomalia: AnomaliaInput;
  actions?: AnomaliaActions;
  notaInicial?: string | null;
  modo?: "admin" | "publico";
  curls?: AnomaliaInvestigacaoCurl[];
  flush?: boolean;
};

/**
 * Container: estado (nota, busy, modal, resultados de curl) + execução de
 * server-fn. Renderiza apenas a View.
 */
export function AnomaliaInvestigacaoContainer({
  anomalia,
  actions,
  notaInicial,
  modo = "admin",
  curls,
  flush = false,
}: AnomaliaInvestigacaoContainerProps) {
  const [modalAberto, setModalAberto] = React.useState(false);
  const [nota, setNota] = React.useState(notaInicial ?? "");
  const [busy, setBusy] = React.useState<string | null>(null);

  // Quando a lista é refetchada (ex.: após re-checar), `notaInicial`
  // muda mas o `useState` acima já foi inicializado. Sem este efeito
  // o textarea de notas fica congelado e o admin precisa recarregar
  // a página pra ver a nota nova adicionada automaticamente.
  const notaInicialNormalizada = notaInicial ?? "";
  React.useEffect(() => {
    setNota(notaInicialNormalizada);
  }, [notaInicialNormalizada, anomalia.id]);

  const onRun = React.useCallback(async (key: string, fn?: () => Promise<void>) => {
    if (!fn) return;
    setBusy(key);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  }, []);

  return (
    <AnomaliaInvestigacaoView
      anomalia={anomalia}
      actions={actions}
      modo={modo}
      curls={curls}
      flush={flush}
      nota={nota}
      onNotaChange={setNota}
      busy={busy}
      onRun={onRun}
      modalAberto={modalAberto}
      onModalOpenChange={setModalAberto}
    />
  );
}

AnomaliaInvestigacaoContainer.displayName = "AnomaliaInvestigacaoContainer";
