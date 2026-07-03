import { Link } from "@tanstack/react-router";
import { Check, Copy, ExternalLink, EyeOff, Loader2, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { IconeAcao } from "@/components/IconeAcao";
import { ListaOrdenavel } from "@/components/ListaOrdenavel";
import { SecaoLista } from "@/components/SecaoLista";
import type { Pergunta } from "@/lib/perguntas.functions";
import { perguntaEditValido, type PerguntaEditDraft } from "@/lib/admin-perguntas/logic";

export type AdminPerguntasPublicasViewProps = {
  isLoading: boolean;
  perguntas: Pergunta[];
  podeArrastar: boolean;
  onReordenar: (visiveisIds: string[]) => void;
  onBaixarCsv: () => void;
  // editar inline
  editandoId: string | null;
  editDraft: PerguntaEditDraft;
  setEditDraft: (d: PerguntaEditDraft) => void;
  onStartEdit: (p: Pergunta) => void;
  onCancelEdit: () => void;
  onEditSalvar: () => void;
  editSalvando: boolean;
  // ações
  onCopiar: (p: Pergunta) => void;
  onDespublicar: (p: Pergunta) => void;
};

export function AdminPerguntasPublicasView({
  isLoading,
  perguntas,
  podeArrastar,
  onReordenar,
  onBaixarCsv,
  editandoId,
  editDraft,
  setEditDraft,
  onStartEdit,
  onCancelEdit,
  onEditSalvar,
  editSalvando,
  onCopiar,
  onDespublicar,
}: AdminPerguntasPublicasViewProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground max-w-2xl">
        Perguntas atualmente publicadas. Edite título, descrição, contexto, tags ou slug.
        Despublicar volta a pergunta para o caderno do autor (status privada).
      </p>

      <SecaoLista titulo="Itens" onBaixarCsv={onBaixarCsv} csvDesabilitado={perguntas.length === 0}>
        {isLoading ? (
          <div className="text-muted-foreground flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" /> Carregando…
          </div>
        ) : perguntas.length === 0 ? (
          <div className="border border-dashed border-border rounded-xl p-5 bg-card text-sm text-muted-foreground">
            Nenhuma pergunta publicada ainda.
          </div>
        ) : (
          <ListaOrdenavel
            itens={perguntas}
            getId={(p) => p.id}
            onReordenar={onReordenar}
            desabilitado={!podeArrastar}
            renderItem={(p) =>
              editandoId === p.id ? (
                <div className="border border-accent rounded-xl p-5 bg-card space-y-3">
                  <CamposPublica draft={editDraft} setDraft={setEditDraft} prefixo={`ep-${p.id}`} />
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      disabled={editSalvando || !perguntaEditValido(editDraft)}
                      onClick={onEditSalvar}
                    >
                      {editSalvando ? (
                        <Loader2 className="size-3.5 mr-1 animate-spin" />
                      ) : (
                        <Check className="size-3.5 mr-1" />
                      )}
                      Salvar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={onCancelEdit}
                      disabled={editSalvando}
                    >
                      <X className="size-3.5 mr-1" /> Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="border border-border rounded-xl p-5 bg-card">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-display text-lg">{p.titulo}</h3>
                      {p.descricao && (
                        <p className="text-sm text-muted-foreground mt-1">{p.descricao}</p>
                      )}
                      {p.contexto && (
                        <p className="text-sm mt-2 whitespace-pre-wrap">{p.contexto}</p>
                      )}
                      <div className="text-[10px] uppercase mt-2 text-muted-foreground">
                        Slug: <code>{p.slug ?? "—"}</code> · publicada em{" "}
                        {p.publicada_em
                          ? new Date(p.publicada_em).toLocaleDateString("pt-BR")
                          : "—"}
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <IconeAcao
                        icon={Copy}
                        label="Copiar texto da pergunta"
                        onClick={() => onCopiar(p)}
                      />
                      <IconeAcao icon={Pencil} label="Editar" onClick={() => onStartEdit(p)} />
                      <IconeAcao
                        icon={EyeOff}
                        label="Despublicar"
                        onClick={() => onDespublicar(p)}
                      />
                      {p.slug && (
                        <Link
                          to="/perguntas/$slug"
                          params={{ slug: p.slug }}
                          target="_blank"
                          aria-label="Ver página pública"
                          title="Ver página pública"
                          className="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/60"
                        >
                          <ExternalLink className="size-4" />
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              )
            }
          />
        )}
      </SecaoLista>
    </div>
  );
}

AdminPerguntasPublicasView.displayName = "AdminPerguntasPublicasView";

function CamposPublica({
  draft,
  setDraft,
  prefixo,
}: {
  draft: PerguntaEditDraft;
  setDraft: (d: PerguntaEditDraft) => void;
  prefixo: string;
}) {
  return (
    <>
      <div className="space-y-1">
        <Label htmlFor={`${prefixo}-tit`}>Título</Label>
        <Input
          id={`${prefixo}-tit`}
          value={draft.titulo}
          onChange={(e) => setDraft({ ...draft, titulo: e.target.value })}
          maxLength={240}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${prefixo}-desc`}>Descrição</Label>
        <Textarea
          id={`${prefixo}-desc`}
          rows={2}
          value={draft.descricao}
          onChange={(e) => setDraft({ ...draft, descricao: e.target.value })}
          maxLength={4000}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${prefixo}-ctx`}>Contexto</Label>
        <Textarea
          id={`${prefixo}-ctx`}
          rows={4}
          value={draft.contexto}
          onChange={(e) => setDraft({ ...draft, contexto: e.target.value })}
          maxLength={4000}
        />
      </div>
      <div className="space-y-1 max-w-md">
        <Label htmlFor={`${prefixo}-slug`}>Slug</Label>
        <Input
          id={`${prefixo}-slug`}
          value={draft.slug}
          onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
          maxLength={160}
          pattern="[a-z0-9-]+"
        />
        <p className="text-[10px] text-muted-foreground">
          Apenas letras minúsculas, números e hífen.
        </p>
      </div>
    </>
  );
}
