import { Copy, ExternalLink, Loader2 } from "lucide-react";
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
import type { CanalReporte } from "@/lib/data/qa-canais";

export type ReporteOficialModalViewProps = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  anomalia: AnomaliaInput;
  canal: CanalReporte | null;
  assunto: string;
  onAssuntoChange: (v: string) => void;
  corpo: string;
  onCorpoChange: (v: string) => void;
  protocolo: string;
  onProtocoloChange: (v: string) => void;
  identificacao: string;
  busy: boolean;
  onSubmit: () => void;
  onCopiar: (texto: string, label: string) => void;
};

export function ReporteOficialModalView({
  open,
  onOpenChange,
  anomalia,
  canal,
  assunto,
  onAssuntoChange,
  corpo,
  onCorpoChange,
  protocolo,
  onProtocoloChange,
  identificacao,
  busy,
  onSubmit,
  onCopiar,
}: ReporteOficialModalViewProps) {
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
            <Input value={assunto} onChange={(e) => onAssuntoChange(e.target.value)} maxLength={200} />
          </div>

          <div>
            <Label className="text-xs">Texto do reporte</Label>
            <Textarea
              value={corpo}
              onChange={(e) => onCorpoChange(e.target.value)}
              rows={14}
              className="font-mono text-xs"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onCopiar(`${assunto}\n\n${corpo}`, "Texto")}>
              <Copy className="size-3.5 mr-1.5" /> Copiar texto
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => onCopiar(identificacao, "Identificação")}>
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
              onChange={(e) => onProtocoloChange(e.target.value)}
              placeholder="Ex.: 03006.001234/2026-99"
              maxLength={120}
            />
            <Button type="button" size="sm" onClick={onSubmit} disabled={busy}>
              {busy ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : null}
              Marcar como reportado
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

ReporteOficialModalView.displayName = "ReporteOficialModalView";