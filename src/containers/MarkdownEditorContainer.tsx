import * as React from "react";
import { GaleriaImagensDialog } from "@/components/GaleriaImagensDialog";
import { MarkdownEditorView } from "@/components/MarkdownEditorView";
import type { ImagemGaleria } from "@/lib/data/artigos-imagens.functions";
import { sanitizeNomeFluxo } from "@/lib/rich-text-editor/logic";
import {
  aplicarAcao,
  imagemMarkdown,
  inserirBloco,
  type AbaEditor,
  type AcaoToolbar,
  type ResultadoInsercao,
  type Selecao,
} from "@/lib/markdown-editor/logic";

export type MarkdownEditorContainerProps = {
  value: string;
  onChange: (markdown: string) => void;
  disabled?: boolean;
  placeholder?: string;
};

export function MarkdownEditorContainer({
  value,
  onChange,
  disabled,
  placeholder,
}: MarkdownEditorContainerProps) {
  const [aba, setAba] = React.useState<AbaEditor>("escrever");
  const [galeriaAberta, setGaleriaAberta] = React.useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const cursorPendente = React.useRef<number | null>(null);

  // Reposiciona o cursor após uma inserção da toolbar (o valor é controlado
  // pelo pai, então o cursor só pode ser restaurado depois do re-render).
  React.useLayoutEffect(() => {
    const el = textareaRef.current;
    if (el && cursorPendente.current != null) {
      el.focus();
      el.setSelectionRange(cursorPendente.current, cursorPendente.current);
      cursorPendente.current = null;
    }
  });

  const selecaoAtual = (): Selecao => {
    const el = textareaRef.current;
    if (!el) return { start: value.length, end: value.length };
    return { start: el.selectionStart, end: el.selectionEnd };
  };

  const aplicar = (resultado: ResultadoInsercao) => {
    cursorPendente.current = resultado.cursor;
    onChange(resultado.value);
  };

  const onAcao = (acao: AcaoToolbar) => {
    setAba("escrever");
    aplicar(aplicarAcao(acao, value, selecaoAtual()));
  };

  const onInserirFluxo = () => {
    const bruto = window.prompt("Nome do fluxo (ex.: contrato-pncp):");
    if (!bruto) return;
    const nome = sanitizeNomeFluxo(bruto);
    if (!nome) return;
    setAba("escrever");
    aplicar(aplicarAcao("fluxo", value, selecaoAtual(), { fluxo: nome }));
  };

  const inserirDaGaleria = (img: ImagemGaleria) => {
    const md = imagemMarkdown(img.url, img.legenda ?? img.nome_original);
    setAba("escrever");
    aplicar(inserirBloco(value, selecaoAtual(), `\n\n${md}\n\n`));
  };

  return (
    <MarkdownEditorView
      value={value}
      aba={aba}
      disabled={disabled}
      placeholder={placeholder}
      textareaRef={textareaRef}
      onAbaChange={setAba}
      onChange={onChange}
      onAcao={onAcao}
      onAbrirGaleria={() => setGaleriaAberta(true)}
      onInserirFluxo={onInserirFluxo}
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

MarkdownEditorContainer.displayName = "MarkdownEditorContainer";
