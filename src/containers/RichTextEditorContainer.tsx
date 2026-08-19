import * as React from "react";
import { useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import { Markdown } from "tiptap-markdown";
import { GaleriaImagensDialog } from "@/components/GaleriaImagensDialog";
import { RichTextEditorView } from "@/components/RichTextEditorView";
import type { ImagemGaleria } from "@/lib/data/artigos-imagens.functions";
import { buildFluxoSnippet, interpretarPromptLink } from "@/lib/rich-text-editor/logic";

export type RichTextEditorContainerProps = {
  value: string;
  onChange: (markdown: string) => void;
  disabled?: boolean;
  placeholder?: string;
  onInserirFluxo?: () => void;
};

export function RichTextEditorContainer({
  value,
  onChange,
  disabled,
  placeholder,
  onInserirFluxo,
}: RichTextEditorContainerProps) {
  const [galeriaAberta, setGaleriaAberta] = React.useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: { HTMLAttributes: { class: "rounded bg-muted p-2 text-xs" } },
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: "noopener noreferrer" },
      }),
      Image.configure({
        inline: false,
        allowBase64: false,
        HTMLAttributes: { class: "rounded-lg my-3 max-w-full h-auto" },
      }),
      Markdown.configure({ html: false, breaks: true, linkify: true, transformPastedText: true }),
    ],
    content: value || "",
    editable: !disabled,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "prose prose-sm dark:prose-invert max-w-none min-h-[320px] px-4 py-3 focus:outline-none",
      },
    },
    onUpdate: ({ editor }) => {
      const storage = editor.storage as unknown as { markdown?: { getMarkdown?: () => string } };
      const md = storage.markdown?.getMarkdown?.() ?? "";
      onChange(md);
    },
  });

  React.useEffect(() => {
    if (!editor) return;
    const storage = editor.storage as unknown as { markdown?: { getMarkdown?: () => string } };
    const atual = storage.markdown?.getMarkdown?.() ?? "";
    if (value !== atual) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
  }, [editor, value]);

  React.useEffect(() => {
    if (editor) editor.setEditable(!disabled);
  }, [editor, disabled]);

  const inserirLink = React.useCallback(() => {
    if (!editor) return;
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL do link:", prev ?? "https://");
    const acao = interpretarPromptLink(url);
    if (acao.tipo === "cancelar") return;
    if (acao.tipo === "remover") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: acao.href }).run();
  }, [editor]);

  const inserirDaGaleria = (img: ImagemGaleria) => {
    if (!editor) return;
    editor
      .chain()
      .focus()
      .setImage({
        src: img.url,
        alt: img.legenda ?? img.nome_original,
        title: img.legenda ?? undefined,
      })
      .run();
  };

  const inserirFluxoHandler = () => {
    if (onInserirFluxo) {
      onInserirFluxo();
      return;
    }
    const nome = window.prompt("Nome do fluxo (ex.: contrato-pncp):");
    if (!nome) return;
    editor?.chain().focus().insertContent(buildFluxoSnippet(nome)).run();
  };

  return (
    <RichTextEditorView
      editor={editor}
      placeholder={placeholder}
      onInserirLink={inserirLink}
      onOpenGaleria={() => setGaleriaAberta(true)}
      onInserirFluxo={inserirFluxoHandler}
      galeriaSlot={
        <GaleriaImagensDialog
          open={galeriaAberta}
          onOpenChange={setGaleriaAberta}
          onSelect={inserirDaGaleria}
        />
      }
    />
  );
}
