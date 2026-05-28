import * as React from "react";
import { Copy, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { AnomaliaInput } from "@/lib/anomalia";
import { canalParaFonte } from "@/lib/data/qa-canais";
import { gerarTextoReporte } from "@/lib/data/qa-template";

export type ReporteOficialModalProps = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  anomalia: AnomaliaInput;
  onConfirmar: (canal: string, protocolo: string) => Promise<void>;
};

export function ReporteOficialModal({ open, onOpenChange, anomalia, onConfirmar }: ReporteOficialModalProps) {
  const canal = canalParaFonte(anomalia.fonte);
  const origin = typeof window !== "undefined" ? window.location.origin : "https://auditoriacidada.ia.br";
  const inicial = React.useMemo(() => gerarTextoReporte(anomalia, origin), [anomalia, origin]);

  const [assunto, setAssunto] = React.useState(inicial.assunto);
  const [corpo, setCorpo] = React.useState(inicial.corpo);
  const [protocolo, setProtocolo] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    setAssunto(inicial.assunto);
    setCorpo(inicial.corpo);
  }, [inicial]);

  const copiar = async (texto: string, label: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success(`${label} copiado.`);
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  const submit = async () => {
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
  };

  if (!canal) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Canal de reporte não catalogado</DialogTitle>
            <DialogDescription>
              A fonte <code>{anomalia.fonte}</code> não tem canal mapeado em qa-canais.ts.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  const identificacao = [
    `Tipo: ${anomalia.entidade.tipo}`,
    `ID: ${anomalia.entidade.id}`,
    anomalia.entidade.url_oficial && `URL: ${anomalia.entidade.url_oficial}`,
    `Caso documentado: ${origin}/qualidade/${anomalia.id}`,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Reportar ao órgão oficial</DialogTitle>
          <DialogDescription>
            {canal.orgao} — canal: {canal.canalPrimario}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="rounded-md border border-border bg-muted/30 p-3 text-xs">
            {canal.instrucoes}
          </div>

          <div>
            <Label className="text-xs">Assunto</Label>
            <Input value={assunto} onChange={(e) => setAssunto(e.target.value)} maxLength={200} />
          </div>

          <div>
            <Label className="text-xs">Texto do reporte</Label>
            <Textarea
              value={corpo}
              onChange={(e) => setCorpo(e.target.value)}
              rows={14}
              className="font-mono text-xs"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => copiar(`${assunto}\n\n${corpo}`, "Texto")}>
              <Copy className="size-3.5 mr-1.5" /> Copiar texto
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => copiar(identificacao, "Identificação")}>
              <Copy className="size-3.5 mr-1.5" /> Copiar identificação
            </Button>
            <Button type="button" variant="outline" size="sm" asChild>
              <a href={canal.urlReporte} target="_blank" rel="noreferrer noopener">
                <ExternalLink className="size-3.5 mr-1.5" /> Abrir {canal.canalPrimario}
              </a>
            </Button>
            {canal.emailSecundario && (
              <Button type="button" variant="ghost" size="sm" asChild>
                <a href={`mailto:${canal.emailSecundario}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`}>
                  Email: {canal.emailSecundario}
                </a>
              </Button>
            )}
          </div>

          <div className="border-t border-border pt-3 space-y-2">
            <Label className="text-xs">Protocolo gerado pelo órgão (após envio)</Label>
            <Input
              value={protocolo}
              onChange={(e) => setProtocolo(e.target.value)}
              placeholder="Ex.: 03006.001234/2026-99"
              maxLength={120}
            />
            <Button type="button" size="sm" onClick={submit} disabled={busy}>
              {busy ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : null}
              Marcar como reportado
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}