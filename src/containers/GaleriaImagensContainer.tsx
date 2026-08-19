import * as React from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  listarImagensGaleria,
  registrarImagemGaleria,
  excluirImagemGaleria,
  LIMITES_GALERIA,
  type ImagemGaleria,
} from "@/lib/data/artigos-imagens.functions";
import { buildStoragePath, validarArquivo } from "@/lib/galeria-imagens/logic";
import { GaleriaImagensView } from "@/components/GaleriaImagensView";

const BUCKET = "artigos-imagens";

async function obterDimensoes(file: File): Promise<{ largura: number; altura: number } | null> {
  if (typeof window === "undefined") return null;
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const out = { largura: img.naturalWidth, altura: img.naturalHeight };
      URL.revokeObjectURL(url);
      resolve(out);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

export type GaleriaImagensContainerProps = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelect?: (imagem: ImagemGaleria) => void;
};

export function GaleriaImagensContainer({
  open,
  onOpenChange,
  onSelect,
}: GaleriaImagensContainerProps) {
  const qc = useQueryClient();
  const listar = useServerFn(listarImagensGaleria);
  const registrar = useServerFn(registrarImagemGaleria);
  const excluir = useServerFn(excluirImagemGaleria);

  const [busca, setBusca] = React.useState("");
  const [buscaDebounced, setBuscaDebounced] = React.useState("");
  const [enviando, setEnviando] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const t = setTimeout(() => setBuscaDebounced(busca), 300);
    return () => clearTimeout(t);
  }, [busca]);

  const { data: imagens = [], isLoading } = useQuery({
    queryKey: ["galeria-imagens", buscaDebounced],
    queryFn: () => listar({ data: { q: buscaDebounced || undefined, limit: 120, offset: 0 } }),
    enabled: open,
  });

  const invalidar = () => qc.invalidateQueries({ queryKey: ["galeria-imagens"] });

  const enviarArquivos = async (files: FileList | File[]) => {
    const arr = Array.from(files);
    if (arr.length === 0) return;
    const { data: sess } = await supabase.auth.getUser();
    const userId = sess.user?.id;
    if (!userId) {
      toast.error("Sessão expirada.");
      return;
    }
    setEnviando(true);
    try {
      for (const file of arr) {
        const valid = validarArquivo(file, LIMITES_GALERIA);
        if (!valid.ok) {
          toast.error(valid.mensagem);
          continue;
        }
        const dims = await obterDimensoes(file);
        const path = buildStoragePath(userId, crypto.randomUUID(), file.name);
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) {
          toast.error(`${file.name}: ${upErr.message}`);
          continue;
        }
        const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
        try {
          await registrar({
            data: {
              storage_path: path,
              url: pub.publicUrl,
              nome_original: file.name.slice(0, 255),
              mime: file.type as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
              tamanho_bytes: file.size,
              largura: dims?.largura ?? null,
              altura: dims?.altura ?? null,
            },
          });
        } catch (err) {
          toast.error(`${file.name}: falha ao registrar (${(err as Error).message}).`);
          await supabase.storage.from(BUCKET).remove([path]);
          continue;
        }
      }
      toast.success("Imagens enviadas.");
      await invalidar();
    } finally {
      setEnviando(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const apagar = async (img: ImagemGaleria) => {
    if (!confirm(`Excluir "${img.nome_original}"? Essa imagem pode estar em artigos.`)) return;
    try {
      await excluir({ data: { id: img.id } });
      toast.success("Imagem excluída.");
      await invalidar();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const copiar = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("URL copiada.");
    } catch {
      toast.error("Falha ao copiar.");
    }
  };

  return (
    <GaleriaImagensView
      open={open}
      onOpenChange={onOpenChange}
      busca={busca}
      onBuscaChange={setBusca}
      buscaAtiva={buscaDebounced}
      imagens={imagens}
      isLoading={isLoading}
      enviando={enviando}
      acceptMimes={LIMITES_GALERIA.MIMES_OK.join(",")}
      inputRef={inputRef}
      onFilesPicked={(files) => enviarArquivos(files)}
      onClickUpload={() => inputRef.current?.click()}
      onSelect={onSelect}
      onCopiar={copiar}
      onApagar={apagar}
    />
  );
}
