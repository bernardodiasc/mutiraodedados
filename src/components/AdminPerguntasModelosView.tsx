import { Check, Copy, Eye, EyeOff, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FormColapsavel } from "@/components/FormColapsavel";
import { IconeAcao } from "@/components/IconeAcao";
import { ListaOrdenavel } from "@/components/ListaOrdenavel";
import { SecaoLista } from "@/components/SecaoLista";
import type { PerguntaModelo } from "@/lib/pergunta-modelos.functions";
import { modeloDraftValido, type AbaModelo, type ModeloDraft } from "@/lib/admin-perguntas/logic";

export type AdminPerguntasModelosViewProps = {
  isLoading: boolean;
  filtro: AbaModelo;
  onFiltroChange: (a: AbaModelo) => void;
  contagens: { tudo: number; ativos: number; inativos: number };
  filtrados: PerguntaModelo[];
  podeArrastar: boolean;
  onReordenar: (visiveisIds: string[]) => void;
  onBaixarCsv: () => void;
  // criar
  criarAberto: boolean;
  onCriarAbertoChange: (v: boolean) => void;
  criarDraft: ModeloDraft;
  setCriarDraft: (d: ModeloDraft) => void;
  onCriar: () => void;
  criarPendente: boolean;
  // editar inline
  editandoId: string | null;
  editDraft: ModeloDraft;
  setEditDraft: (d: ModeloDraft) => void;
  onStartEdit: (m: PerguntaModelo) => void;
  onCancelEdit: () => void;
  onEditSalvar: () => void;
  editSalvando: boolean;
  // ações
  onToggleAtivo: (m: PerguntaModelo) => void;
  onCopiar: (m: PerguntaModelo) => void;
  onExcluir: (m: PerguntaModelo) => void;
};

const ABAS: AbaModelo[] = ["tudo", "ativos", "inativos"];
const ABA_LABEL: Record<AbaModelo, string> = {
  tudo: "Tudo",
  ativos: "Ativos",
  inativos: "Inativos",
};

export function AdminPerguntasModelosView({
  isLoading,
  filtro,
  onFiltroChange,
  contagens,
  filtrados,
  podeArrastar,
  onReordenar,
  onBaixarCsv,
  criarAberto,
  onCriarAbertoChange,
  criarDraft,
  setCriarDraft,
  onCriar,
  criarPendente,
  editandoId,
  editDraft,
  setEditDraft,
  onStartEdit,
  onCancelEdit,
  onEditSalvar,
  editSalvando,
  onToggleAtivo,
  onCopiar,
  onExcluir,
}: AdminPerguntasModelosViewProps) {
  return (
    <div className="space-y-8">
      <FormColapsavel
        titulo="Novo modelo"
        aberto={criarAberto}
        onAbertoChange={onCriarAbertoChange}
      >
        <div className="space-y-3">
          <CamposModelo draft={criarDraft} setDraft={setCriarDraft} prefixo="novo" />
          <Button
            size="sm"
            onClick={onCriar}
            disabled={!modeloDraftValido(criarDraft) || criarPendente}
          >
            {criarPendente ? (
              <Loader2 className="size-3.5 mr-1 animate-spin" />
            ) : (
              <Plus className="size-3.5 mr-1" />
            )}
            Criar modelo
          </Button>
        </div>
      </FormColapsavel>

      <SecaoLista
        titulo="Itens"
        abas={ABAS.map((a) => ({ chave: a, label: ABA_LABEL[a], qtd: contagens[a] }))}
        abaAtiva={filtro}
        onAbaChange={(c) => onFiltroChange(c as AbaModelo)}
        onBaixarCsv={onBaixarCsv}
        csvDesabilitado={filtrados.length === 0}
      >
        {isLoading ? (
          <div className="text-muted-foreground flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" /> Carregando…
          </div>
        ) : filtrados.length === 0 ? (
          <div className="border border-dashed border-border rounded-xl p-5 bg-card text-sm text-muted-foreground">
            Nenhum modelo nesta lista.
          </div>
        ) : (
          <ListaOrdenavel
            itens={filtrados}
            getId={(m) => m.id}
            onReordenar={onReordenar}
            desabilitado={!podeArrastar}
            renderItem={(m) =>
              editandoId === m.id ? (
                <div className="border border-accent rounded-xl p-5 bg-card space-y-3">
                  <CamposModelo draft={editDraft} setDraft={setEditDraft} prefixo={`ed-${m.id}`} />
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      disabled={editSalvando || !modeloDraftValido(editDraft)}
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
                <div className="border border-border rounded-xl p-4 bg-card flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-display text-base">{m.titulo}</div>
                    {m.contexto && (
                      <p className="text-xs text-muted-foreground mt-1">{m.contexto}</p>
                    )}
                    <div className="text-[10px] uppercase mt-1 text-muted-foreground">
                      Ordem: {m.ordem} · {m.ativo ? "Ativo" : "Inativo"}
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <IconeAcao
                      icon={Copy}
                      label="Copiar texto do modelo"
                      onClick={() => onCopiar(m)}
                    />
                    <IconeAcao
                      icon={m.ativo ? Eye : EyeOff}
                      label={m.ativo ? "Desativar" : "Ativar"}
                      onClick={() => onToggleAtivo(m)}
                    />
                    <IconeAcao icon={Pencil} label="Editar" onClick={() => onStartEdit(m)} />
                    <IconeAcao
                      icon={Trash2}
                      label="Excluir"
                      tone="destructive"
                      onClick={() => onExcluir(m)}
                    />
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

AdminPerguntasModelosView.displayName = "AdminPerguntasModelosView";

function CamposModelo({
  draft,
  setDraft,
  prefixo,
}: {
  draft: ModeloDraft;
  setDraft: (d: ModeloDraft) => void;
  prefixo: string;
}) {
  return (
    <>
      <div className="space-y-1">
        <Label htmlFor={`${prefixo}-titulo`}>Pergunta</Label>
        <Input
          id={`${prefixo}-titulo`}
          value={draft.titulo}
          onChange={(e) => setDraft({ ...draft, titulo: e.target.value })}
          maxLength={240}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${prefixo}-ctx`}>Contexto</Label>
        <Textarea
          id={`${prefixo}-ctx`}
          rows={3}
          value={draft.contexto}
          onChange={(e) => setDraft({ ...draft, contexto: e.target.value })}
        />
      </div>
      <div className="space-y-1 max-w-[160px]">
        <Label htmlFor={`${prefixo}-ordem`}>Ordem</Label>
        <Input
          id={`${prefixo}-ordem`}
          type="number"
          value={draft.ordem}
          onChange={(e) => setDraft({ ...draft, ordem: Number(e.target.value) || 0 })}
        />
      </div>
    </>
  );
}
