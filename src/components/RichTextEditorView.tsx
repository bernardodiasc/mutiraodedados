import * as React from "react";
import type { Editor } from "@tiptap/react";
import { EditorContent } from "@tiptap/react";
import {
  Bold,
  Italic,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Code,
  Code2,
  Link as LinkIcon,
  Image as ImageIcon,
  Undo,
  Redo,
  Workflow,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ToolbarBtnProps = {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
};

function TBtn({ onClick, active, disabled, title, children }: ToolbarBtnProps) {
  return (
    <button
      type="button"
      data-flat
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "size-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors",
        active && "bg-accent/15 text-accent",
        disabled && "opacity-40 cursor-not-allowed",
      )}
    >
      {children}
    </button>
  );
}

export type RichTextToolbarProps = {
  editor: Editor;
  onInserirLink: () => void;
  onOpenGaleria: () => void;
  onInserirFluxo: () => void;
};

export function RichTextToolbar({
  editor,
  onInserirLink,
  onOpenGaleria,
  onInserirFluxo,
}: RichTextToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/30 px-1.5 py-1">
      <TBtn
        title="Negrito"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="size-4" />
      </TBtn>
      <TBtn
        title="Itálico"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="size-4" />
      </TBtn>
      <div className="mx-1 h-5 w-px bg-border" />
      <TBtn
        title="Título 2"
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 className="size-4" />
      </TBtn>
      <TBtn
        title="Título 3"
        active={editor.isActive("heading", { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        <Heading3 className="size-4" />
      </TBtn>
      <div className="mx-1 h-5 w-px bg-border" />
      <TBtn
        title="Lista"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="size-4" />
      </TBtn>
      <TBtn
        title="Lista numerada"
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="size-4" />
      </TBtn>
      <TBtn
        title="Citação"
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Quote className="size-4" />
      </TBtn>
      <TBtn
        title="Código inline"
        active={editor.isActive("code")}
        onClick={() => editor.chain().focus().toggleCode().run()}
      >
        <Code className="size-4" />
      </TBtn>
      <TBtn
        title="Bloco de código"
        active={editor.isActive("codeBlock")}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      >
        <Code2 className="size-4" />
      </TBtn>
      <div className="mx-1 h-5 w-px bg-border" />
      <TBtn title="Link" active={editor.isActive("link")} onClick={onInserirLink}>
        <LinkIcon className="size-4" />
      </TBtn>
      <TBtn title="Imagem da galeria" onClick={onOpenGaleria}>
        <ImageIcon className="size-4" />
      </TBtn>
      <TBtn title="Inserir fluxo embutido" onClick={onInserirFluxo}>
        <Workflow className="size-4" />
      </TBtn>
      <div className="ml-auto flex items-center gap-0.5">
        <TBtn
          title="Desfazer"
          disabled={!editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo className="size-4" />
        </TBtn>
        <TBtn
          title="Refazer"
          disabled={!editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo className="size-4" />
        </TBtn>
      </div>
    </div>
  );
}

export type RichTextEditorViewProps = {
  editor: Editor | null;
  placeholder?: string;
  onInserirLink: () => void;
  onOpenGaleria: () => void;
  onInserirFluxo: () => void;
  galeriaSlot?: React.ReactNode;
};

export function RichTextEditorView({
  editor,
  placeholder,
  onInserirLink,
  onOpenGaleria,
  onInserirFluxo,
  galeriaSlot,
}: RichTextEditorViewProps) {
  return (
    <div className="rounded-md border border-input bg-background overflow-hidden">
      {editor && (
        <RichTextToolbar
          editor={editor}
          onInserirLink={onInserirLink}
          onOpenGaleria={onOpenGaleria}
          onInserirFluxo={onInserirFluxo}
        />
      )}
      <EditorContent editor={editor} />
      {!editor && placeholder && (
        <div className="px-4 py-3 text-xs text-muted-foreground">{placeholder}</div>
      )}
      {galeriaSlot}
    </div>
  );
}
