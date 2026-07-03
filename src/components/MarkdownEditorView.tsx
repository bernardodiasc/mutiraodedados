import * as React from "react";
import {
  Bold,
  Italic,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Code,
  Link as LinkIcon,
  Table as TableIcon,
  Image as ImageIcon,
  Workflow,
  Pencil,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ArtigoRenderer } from "@/components/ArtigoRenderer";
import type { AbaEditor, AcaoToolbar } from "@/lib/markdown-editor/logic";

type TBtnProps = {
  onClick: () => void;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
};

function TBtn({ onClick, disabled, title, children }: TBtnProps) {
  return (
    <button
      type="button"
      data-flat
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "size-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors",
        disabled && "opacity-40 cursor-not-allowed",
      )}
    >
      {children}
    </button>
  );
}

const ACOES: { acao: AcaoToolbar; title: string; icon: React.ReactNode }[] = [
  { acao: "negrito", title: "Negrito", icon: <Bold className="size-4" /> },
  { acao: "italico", title: "Itálico", icon: <Italic className="size-4" /> },
  { acao: "titulo2", title: "Título 2", icon: <Heading2 className="size-4" /> },
  { acao: "titulo3", title: "Título 3", icon: <Heading3 className="size-4" /> },
  { acao: "lista", title: "Lista", icon: <List className="size-4" /> },
  { acao: "listaNumerada", title: "Lista numerada", icon: <ListOrdered className="size-4" /> },
  { acao: "citacao", title: "Citação", icon: <Quote className="size-4" /> },
  { acao: "codigo", title: "Código", icon: <Code className="size-4" /> },
  { acao: "link", title: "Link", icon: <LinkIcon className="size-4" /> },
  { acao: "tabela", title: "Tabela", icon: <TableIcon className="size-4" /> },
];

export type MarkdownEditorViewProps = {
  value: string;
  aba: AbaEditor;
  disabled?: boolean;
  placeholder?: string;
  textareaRef?: React.Ref<HTMLTextAreaElement>;
  onAbaChange: (aba: AbaEditor) => void;
  onChange: (value: string) => void;
  onAcao: (acao: AcaoToolbar) => void;
  onAbrirGaleria: () => void;
  onInserirFluxo: () => void;
  galeriaSlot?: React.ReactNode;
};

export function MarkdownEditorView({
  value,
  aba,
  disabled,
  placeholder,
  textareaRef,
  onAbaChange,
  onChange,
  onAcao,
  onAbrirGaleria,
  onInserirFluxo,
  galeriaSlot,
}: MarkdownEditorViewProps) {
  return (
    <div className="rounded-md border border-input bg-background overflow-hidden">
      <div className="flex items-center gap-1 border-b border-border bg-muted/30 px-1.5 py-1">
        <button
          type="button"
          data-flat
          onClick={() => onAbaChange("escrever")}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            aba === "escrever"
              ? "bg-accent/15 text-accent"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Pencil className="size-3.5" /> Escrever
        </button>
        <button
          type="button"
          data-flat
          onClick={() => onAbaChange("visualizar")}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            aba === "visualizar"
              ? "bg-accent/15 text-accent"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Eye className="size-3.5" /> Visualizar
        </button>
      </div>

      {aba === "escrever" ? (
        <>
          <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/20 px-1.5 py-1">
            {ACOES.map((a) => (
              <TBtn key={a.acao} title={a.title} disabled={disabled} onClick={() => onAcao(a.acao)}>
                {a.icon}
              </TBtn>
            ))}
            <div className="mx-1 h-5 w-px bg-border" />
            <TBtn title="Imagem da galeria" disabled={disabled} onClick={onAbrirGaleria}>
              <ImageIcon className="size-4" />
            </TBtn>
            <TBtn title="Inserir fluxo embutido" disabled={disabled} onClick={onInserirFluxo}>
              <Workflow className="size-4" />
            </TBtn>
          </div>
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            placeholder={placeholder}
            spellCheck
            className="block w-full min-h-[320px] resize-y bg-background px-4 py-3 font-mono text-xs leading-relaxed text-foreground focus:outline-none disabled:opacity-60"
          />
        </>
      ) : (
        <div className="min-h-[320px] px-4 py-3">
          <ArtigoRenderer conteudo={value.trim() || "_Sem conteúdo._"} />
        </div>
      )}

      {galeriaSlot}
    </div>
  );
}

MarkdownEditorView.displayName = "MarkdownEditorView";
