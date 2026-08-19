import * as React from "react";
import { toast } from "sonner";
import type { AnomaliaInput } from "@/lib/anomalia";
import { canalParaFonte } from "@/lib/data/qa-canais";
import { gerarTextoReporte } from "@/lib/data/qa-template";
import { buildIdentificacao, safeOrigin } from "@/lib/reporte-oficial/logic";
import { ReporteOficialModalView } from "@/components/ReporteOficialModalView";

export type ReporteOficialModalProps = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  anomalia: AnomaliaInput;
  onConfirmar: (canal: string, protocolo: string) => Promise<void>;
};

export function ReporteOficialModalContainer({
  open,
  onOpenChange,
  anomalia,
  onConfirmar,
}: ReporteOficialModalProps) {
  const canal = canalParaFonte(anomalia.fonte);
  const origin = safeOrigin();
  const inicial = React.useMemo(() => gerarTextoReporte(anomalia, origin), [anomalia, origin]);

  const [assunto, setAssunto] = React.useState(inicial.assunto);
  const [corpo, setCorpo] = React.useState(inicial.corpo);
  const [protocolo, setProtocolo] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    setAssunto(inicial.assunto);
    setCorpo(inicial.corpo);
  }, [inicial]);

  const onCopiar = React.useCallback(async (texto: string, label: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success(`${label} copiado.`);
    } catch {
      toast.error("Não foi possível copiar.");
    }
  }, []);

  const onSubmit = React.useCallback(async () => {
    if (!canal) return;
    setBusy(true);
    try {
      await onConfirmar(canal.canalPrimario, protocolo.trim());
      toast.success("Reporte registrado.");
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [canal, protocolo, onConfirmar, onOpenChange]);

  const identificacao = buildIdentificacao(anomalia, origin);

  return (
    <ReporteOficialModalView
      open={open}
      onOpenChange={onOpenChange}
      anomalia={anomalia}
      canal={canal}
      assunto={assunto}
      onAssuntoChange={setAssunto}
      corpo={corpo}
      onCorpoChange={setCorpo}
      protocolo={protocolo}
      onProtocoloChange={setProtocolo}
      identificacao={identificacao}
      busy={busy}
      onSubmit={onSubmit}
      onCopiar={onCopiar}
    />
  );
}

ReporteOficialModalContainer.displayName = "ReporteOficialModalContainer";
