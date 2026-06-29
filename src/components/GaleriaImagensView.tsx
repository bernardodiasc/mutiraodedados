import * as React from "react";
import { Copy, Loader2, Trash2, Upload } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { ImagemGaleria } from "@/lib/data/artigos-imagens.functions";

export type GaleriaImagensViewProps = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  busca: string;
  onBuscaChange: (v: string) => void;
  buscaAtiva: string;
  imagens: ImagemGaleria[];
  isLoading: boolean;
  enviando: boolean;
  acceptMimes: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onFilesPicked: (files: FileList) => void;
  onClickUpload: () => void;
  onSelect?: (imagem: ImagemGaleria) => void;
  onCopiar: (url: string) => void;
  onApagar: (img: ImagemGaleria) => void;
};

export function GaleriaImagensView(props: GaleriaImagensViewProps) {
  const {
    open,
    onOpenChange,
    busca,
    onBuscaChange,
    buscaAtiva,
    imagens,
    isLoading,
    enviando,
    acceptMimes,
    inputRef,
    onFilesPicked,
    onClickUpload,
    onSelect,
    onCopiar,
    onApagar,
  } = props;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Galeria de imagens</DialogTitle>
          <DialogDescription>
            Imagens compartilhadas entre artigos. JPG/PNG/WebP/GIF até 5 MB.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={busca}
            onChange={(e) => onBuscaChange(e.target.value)}
            placeholder="Buscar por nome ou legenda…"
            className="flex-1 min-w-[200px]"
          />
          <input
            ref={inputRef}
            type="file"
            accept={acceptMimes}
            multiple
            hidden
            onChange={(e) => e.target.files && onFilesPicked(e.target.files)}
          />
          <Button type="button" onClick={onClickUpload} disabled={enviando} size="sm">
            {enviando ? (
              <Loader2 className="size-4 mr-2 animate-spin" />
            ) : (
              <Upload className="size-4 mr-2" />
            )}
            Enviar imagens
          </Button>
        </div>

        <div className="max-h-[60vh] overflow-auto rounded-lg border border-border bg-background p-2">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="size-4 animate-spin" /> Carregando…
            </div>
          ) : imagens.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Nenhuma imagem {buscaAtiva ? "encontrada" : "ainda — envie a primeira."}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {imagens.map((img) => (
                <div
                  key={img.id}
                  className="group relative aspect-square rounded-md overflow-hidden border border-border bg-muted"
                >
                  <img
                    src={img.url}
                    alt={img.legenda ?? img.nome_original}
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/60 transition-colors flex flex-col items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                    {onSelect && (
                      <Button
                        size="sm"
                        type="button"
                        onClick={() => {
                          onSelect(img);
                          onOpenChange(false);
                        }}
                      >
                        Inserir
                      </Button>
                    )}
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="secondary"
                        type="button"
                        onClick={() => onCopiar(img.url)}
                      >
                        <Copy className="size-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        type="button"
                        onClick={() => onApagar(img)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-1.5 text-[10px] text-white truncate">
                    {img.nome_original}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}