import { NotebookPen, Plus, Trash2, Pencil, Loader2, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RichTextEditor } from "@/components/RichTextEditor";
import type { Anotacao } from "@/lib/anotacoes.functions";
import {
  type AnotacaoDraft,
  podeSalvar,
  previewConteudo,
  formatarDataPt,
} from "@/lib/anotacoes-caderno/logic";

export type AnotacoesCadernoViewProps = {
  anotacoes: Anotacao[];
  isLoading: boolean;
  errorMsg: string | null;
  draft: AnotacaoDraft | null;
  isSaving: boolean;
  removingId: string | null;
  onComecarNova: () => void;
  onComecarEditar: (a: Anotacao) => void;
  onCancelar: () => void;
  onAlterarDraft: (patch: Partial<AnotacaoDraft>) => void;
  onSalvarDraft: () => void;
  onRemover: (id: string) => void;
};

export function AnotacoesCadernoView({
  anotacoes,
  isLoading,
  errorMsg,
  draft,
  isSaving,
  removingId,
  onComecarNova,
  onComecarEditar,
  onCancelar,
  onAlterarDraft,
  onSalvarDraft,
  onRemover,
}: AnotacoesCadernoViewProps) {
  if (isLoading) {
    return (
      <div className="border border-border rounded-xl p-6 bg-card flex items-center gap-3 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Carregando anotações…
      </div>
    );
  }
  if (errorMsg) {
    return (
      <div className="border border-destructive/30 bg-destructive/5 rounded-xl p-6 text-sm text-destructive">
        Não foi possível carregar suas anotações. {errorMsg}
      </div>
    );
  }

  const editandoNova = draft?.id === "new";

  return (
    <div>
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="font-display text-2xl inline-flex items-center gap-2">
          <NotebookPen className="size-5 text-accent" />
          Anotações{" "}
          <span className="text-muted-foreground font-sans text-base font-normal">
            ({anotacoes.length})
          </span>
        </h2>
        {!editandoNova && (
          <Button size="sm" variant="outline" onClick={onComecarNova}>
            <Plus className="size-3.5 mr-1" /> Nova anotação
          </Button>
        )}
      </div>

      {editandoNova && draft && (
        <EditorView
          draft={draft}
          isSaving={isSaving}
          onAlterar={onAlterarDraft}
          onSalvar={onSalvarDraft}
          onCancelar={onCancelar}
        />
      )}

      {anotacoes.length === 0 && !editandoNova ? (
        <div className="border border-dashed border-border rounded-xl p-6 bg-card mt-4">
          <p className="text-sm text-muted-foreground">
            Nenhuma anotação ainda. Use o caderno para escrever em texto livre o que você está
            pensando enquanto investiga — privado por padrão.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3 mt-4">
          {anotacoes.map((a) =>
            draft?.id === a.id ? (
              <li key={a.id}>
                <EditorView
                  draft={draft}
                  isSaving={isSaving}
                  onAlterar={onAlterarDraft}
                  onSalvar={onSalvarDraft}
                  onCancelar={onCancelar}
                />
              </li>
            ) : (
              <li key={a.id} className="border border-border rounded-xl p-5 bg-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {a.titulo && <h3 className="font-display text-lg leading-snug">{a.titulo}</h3>}
                    <div className="text-sm text-muted-foreground mt-1 leading-relaxed prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2 prose-a:text-accent prose-strong:text-foreground line-clamp-4">
                      <ReactMarkdown>{previewConteudo(a.conteudo_md, 400)}</ReactMarkdown>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => onComecarEditar(a)}
                      aria-label="Editar anotação"
                      className="text-muted-foreground hover:text-foreground p-1.5 rounded-md hover:bg-muted"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemover(a.id)}
                      disabled={removingId === a.id}
                      aria-label="Remover anotação"
                      className="text-muted-foreground hover:text-destructive p-1.5 rounded-md hover:bg-muted disabled:opacity-50"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
                <div className="text-[11px] text-muted-foreground mt-3">
                  Atualizada em {formatarDataPt(a.updated_at)}
                </div>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}

AnotacoesCadernoView.displayName = "AnotacoesCadernoView";

function EditorView({
  draft,
  isSaving,
  onAlterar,
  onSalvar,
  onCancelar,
}: {
  draft: AnotacaoDraft;
  isSaving: boolean;
  onAlterar: (p: Partial<AnotacaoDraft>) => void;
  onSalvar: () => void;
  onCancelar: () => void;
}) {
  return (
    <div className="border border-border rounded-xl p-5 bg-card space-y-3">
      <Input
        value={draft.titulo}
        onChange={(e) => onAlterar({ titulo: e.target.value })}
        placeholder="Título (opcional)"
        maxLength={200}
      />
      <RichTextEditor
        value={draft.conteudo_md}
        onChange={(v) => onAlterar({ conteudo_md: v })}
        placeholder="O que você está pensando? Anote aqui — só você vê."
      />
      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="ghost" onClick={onCancelar} disabled={isSaving}>
          <X className="size-3.5 mr-1" /> Cancelar
        </Button>
        <Button size="sm" onClick={onSalvar} disabled={isSaving || !podeSalvar(draft)}>
          {isSaving && <Loader2 className="size-3.5 mr-1 animate-spin" />}
          Salvar
        </Button>
      </div>
    </div>
  );
}
