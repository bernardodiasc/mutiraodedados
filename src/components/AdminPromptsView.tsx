import * as React from "react";
import { Check, Copy, Eye, EyeOff, Link2, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AdminHeader } from "@/components/AdminHeader";
import { FormColapsavel } from "@/components/FormColapsavel";
import { IconeAcao } from "@/components/IconeAcao";
import { ListaOrdenavel } from "@/components/ListaOrdenavel";
import { SecaoLista } from "@/components/SecaoLista";
import type { Artigo } from "@/lib/data/artigos.functions";
import type { MapaPromptVinculo, PromptModelo } from "@/lib/prompt-modelos.functions";
import {
  comVariavelAdicionada,
  comVariavelAtualizada,
  comVariavelRemovida,
  formPromptValido,
  variavelDoBanco,
  type AbaPrompt,
  type FormPrompt,
} from "@/lib/admin-prompts/logic";

export type AdminPromptsViewProps = {
  isLoading: boolean;
  // lista + filtro
  filtro: AbaPrompt;
  onFiltroChange: (a: AbaPrompt) => void;
  contagens: { tudo: number; ativos: number; inativos: number };
  promptsFiltrados: PromptModelo[];
  podeArrastar: boolean;
  onReordenar: (visiveisIds: string[]) => void;
  onBaixarCsv: () => void;
  // criar
  criarAberto: boolean;
  onCriarAbertoChange: (v: boolean) => void;
  criarForm: FormPrompt;
  setCriarForm: (f: FormPrompt) => void;
  onCriar: () => void;
  criarPendente: boolean;
  // editar inline
  editandoId: string | null;
  editForm: FormPrompt;
  setEditForm: (f: FormPrompt) => void;
  onStartEdit: (p: PromptModelo) => void;
  onCancelEdit: () => void;
  onEditSalvar: () => void;
  editSalvando: boolean;
  // ações de item
  onToggleAtivo: (p: PromptModelo) => void;
  onCopiar: (p: PromptModelo) => void;
  onExcluir: (p: PromptModelo) => void;
  // vínculos com mapas
  mapas: Artigo[];
  mapaPorId: Map<string, Artigo>;
  vinculosPorPrompt: Map<string, string[]>;
  onVincular: (promptId: string, artigoId: string, ordem: number) => void;
  onDesvincular: (promptId: string, artigoId: string) => void;
  // ordem dos prompts por mapa
  vinculos: MapaPromptVinculo[];
  promptPorId: Map<string, PromptModelo>;
  onReordenarMapa: (artigoId: string, promptIds: string[]) => void;
};

const ABAS: AbaPrompt[] = ["tudo", "ativos", "inativos"];
const ABA_LABEL: Record<AbaPrompt, string> = {
  tudo: "Tudo",
  ativos: "Ativos",
  inativos: "Inativos",
};

export function AdminPromptsView({
  isLoading,
  filtro,
  onFiltroChange,
  contagens,
  promptsFiltrados,
  podeArrastar,
  onReordenar,
  onBaixarCsv,
  criarAberto,
  onCriarAbertoChange,
  criarForm,
  setCriarForm,
  onCriar,
  criarPendente,
  editandoId,
  editForm,
  setEditForm,
  onStartEdit,
  onCancelEdit,
  onEditSalvar,
  editSalvando,
  onToggleAtivo,
  onCopiar,
  onExcluir,
  mapas,
  mapaPorId,
  vinculosPorPrompt,
  onVincular,
  onDesvincular,
  vinculos,
  promptPorId,
  onReordenarMapa,
}: AdminPromptsViewProps) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 space-y-8">
      <AdminHeader titulo="Prompts">
        Prompts do <strong>Kit de investigação</strong>: modelos que o cidadão copia para a IA dele,
        vinculados N:N aos mapas. Só aparecem no site quando <strong>ativos</strong> e vinculados a
        um mapa público.
      </AdminHeader>

      <FormColapsavel
        titulo="Novo prompt"
        aberto={criarAberto}
        onAbertoChange={onCriarAbertoChange}
      >
        <div className="space-y-3">
          <FormCampos form={criarForm} setForm={setCriarForm} prefixo="novo" />
          <Button
            size="sm"
            onClick={onCriar}
            disabled={!formPromptValido(criarForm) || criarPendente}
          >
            {criarPendente ? (
              <Loader2 className="size-3.5 mr-1 animate-spin" />
            ) : (
              <Plus className="size-3.5 mr-1" />
            )}
            Criar prompt
          </Button>
        </div>
      </FormColapsavel>

      <SecaoLista
        titulo="Itens"
        abas={ABAS.map((a) => ({ chave: a, label: ABA_LABEL[a], qtd: contagens[a] }))}
        abaAtiva={filtro}
        onAbaChange={(c) => onFiltroChange(c as AbaPrompt)}
        onBaixarCsv={onBaixarCsv}
        csvDesabilitado={promptsFiltrados.length === 0}
      >
        {isLoading ? (
          <div className="text-muted-foreground flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" /> Carregando…
          </div>
        ) : promptsFiltrados.length === 0 ? (
          <div className="border border-dashed border-border rounded-xl p-5 bg-card text-sm text-muted-foreground">
            Nenhum prompt nesta lista.
          </div>
        ) : (
          <ListaOrdenavel
            itens={promptsFiltrados}
            getId={(p) => p.id}
            onReordenar={onReordenar}
            desabilitado={!podeArrastar}
            renderItem={(p) =>
              editandoId === p.id ? (
                <div className="border border-accent rounded-xl p-5 bg-card space-y-3">
                  <FormCampos form={editForm} setForm={setEditForm} prefixo={`ed-${p.id}`} />
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      disabled={editSalvando || !formPromptValido(editForm)}
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
                <div className="border border-border rounded-xl p-4 bg-card">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-display text-base">{p.titulo}</div>
                      {p.descricao && (
                        <p className="text-xs text-muted-foreground mt-1">{p.descricao}</p>
                      )}
                      {p.variaveis.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {p.variaveis.map((raw, i) => {
                            const v = variavelDoBanco(raw);
                            return (
                              <code
                                key={v.nome || i}
                                title={[v.dica, v.href].filter(Boolean).join(" · ")}
                                className="text-[10px] px-1 py-0.5 rounded bg-muted text-muted-foreground"
                              >
                                {`{{${v.nome}}}`}
                                {v.href ? " ↗" : ""}
                              </code>
                            );
                          })}
                        </div>
                      )}
                      <details className="mt-2">
                        <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                          Ver template
                        </summary>
                        <pre className="mt-2 text-xs bg-muted rounded-md p-3 whitespace-pre-wrap max-h-64 overflow-auto">
                          {p.prompt_template}
                        </pre>
                      </details>
                      <div className="text-[10px] uppercase mt-2 text-muted-foreground">
                        Ordem: {p.ordem} · {p.ativo ? "Ativo" : "Inativo"}
                        {p.tags.length > 0 ? ` · ${p.tags.join(", ")}` : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <IconeAcao
                        icon={Copy}
                        label="Copiar texto do prompt"
                        onClick={() => onCopiar(p)}
                      />
                      <IconeAcao
                        icon={p.ativo ? Eye : EyeOff}
                        label={p.ativo ? "Desativar" : "Ativar"}
                        onClick={() => onToggleAtivo(p)}
                      />
                      <IconeAcao icon={Pencil} label="Editar" onClick={() => onStartEdit(p)} />
                      <IconeAcao
                        icon={Trash2}
                        label="Excluir"
                        tone="destructive"
                        onClick={() => onExcluir(p)}
                      />
                    </div>
                  </div>

                  <VinculosDoPrompt
                    prompt={p}
                    mapasVinculados={(vinculosPorPrompt.get(p.id) ?? [])
                      .map((id) => mapaPorId.get(id))
                      .filter((m): m is Artigo => Boolean(m))}
                    mapasDisponiveis={mapas.filter(
                      (m) => !(vinculosPorPrompt.get(p.id) ?? []).includes(m.id),
                    )}
                    onVincular={(artigoId) => onVincular(p.id, artigoId, p.ordem)}
                    onDesvincular={(artigoId) => onDesvincular(p.id, artigoId)}
                  />
                </div>
              )
            }
          />
        )}
      </SecaoLista>

      <PainelOrdemPorMapa
        mapas={mapas}
        vinculos={vinculos}
        promptPorId={promptPorId}
        onReordenar={onReordenarMapa}
      />
    </div>
  );
}

AdminPromptsView.displayName = "AdminPromptsView";

/**
 * Reordena, por mapa, os prompts que aparecem no Kit público — a ordem real que
 * o cidadão vê. Escolha um mapa e arraste os prompts vinculados a ele.
 */
function PainelOrdemPorMapa({
  mapas,
  vinculos,
  promptPorId,
  onReordenar,
}: {
  mapas: Artigo[];
  vinculos: MapaPromptVinculo[];
  promptPorId: Map<string, PromptModelo>;
  onReordenar: (artigoId: string, promptIds: string[]) => void;
}) {
  const [mapaId, setMapaId] = React.useState("");
  const promptsDoMapa = React.useMemo(() => {
    return vinculos
      .filter((v) => v.artigo_id === mapaId)
      .sort((a, b) => a.ordem - b.ordem)
      .map((v) => promptPorId.get(v.prompt_modelo_id))
      .filter((p): p is PromptModelo => Boolean(p));
  }, [vinculos, mapaId, promptPorId]);

  return (
    <div className="border border-border rounded-xl p-5 bg-card space-y-3">
      <div>
        <h2 className="font-display text-lg">Ordem dos prompts por mapa</h2>
        <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
          Esta é a ordem que aparece no <strong>Kit</strong> de cada mapa público. Escolha um mapa e
          arraste para reordenar.
        </p>
      </div>
      <select
        value={mapaId}
        onChange={(e) => setMapaId(e.target.value)}
        className="rounded-md border bg-background px-2 py-1.5 text-sm max-w-md"
        aria-label="Escolher mapa para ordenar prompts"
      >
        <option value="">Escolher mapa…</option>
        {mapas.map((m) => (
          <option key={m.id} value={m.id}>
            {m.titulo}
            {m.publico ? "" : " (rascunho)"}
          </option>
        ))}
      </select>
      {mapaId &&
        (promptsDoMapa.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum prompt vinculado a este mapa.</p>
        ) : (
          <ListaOrdenavel
            itens={promptsDoMapa}
            getId={(p) => p.id}
            onReordenar={(ids) => onReordenar(mapaId, ids)}
            renderItem={(p) => (
              <div className="border border-border rounded-lg px-3 py-2 bg-background text-sm">
                {p.titulo}
                {!p.ativo && (
                  <span className="ml-2 text-[10px] text-muted-foreground">(inativo)</span>
                )}
              </div>
            )}
          />
        ))}
    </div>
  );
}

function VinculosDoPrompt({
  prompt,
  mapasVinculados,
  mapasDisponiveis,
  onVincular,
  onDesvincular,
}: {
  prompt: PromptModelo;
  mapasVinculados: Artigo[];
  mapasDisponiveis: Artigo[];
  onVincular: (artigoId: string) => void;
  onDesvincular: (artigoId: string) => void;
}) {
  const [selecionado, setSelecionado] = React.useState("");
  return (
    <div className="mt-3 pt-3 border-t border-border">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
        Mapas vinculados
      </div>
      {mapasVinculados.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Nenhum — o prompt não aparece no site até ser vinculado a um mapa público.
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {mapasVinculados.map((m) => (
            <span
              key={m.id}
              className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-accent/10 text-accent"
            >
              {m.titulo}
              {!m.publico && <span className="text-muted-foreground">(rascunho)</span>}
              <button
                type="button"
                aria-label={`Desvincular de ${m.titulo}`}
                onClick={() => onDesvincular(m.id)}
                className="hover:text-destructive"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      {mapasDisponiveis.length > 0 && (
        <div className="mt-2 flex items-center gap-2">
          <select
            value={selecionado}
            onChange={(e) => setSelecionado(e.target.value)}
            className="rounded-md border bg-background px-2 py-1.5 text-xs max-w-xs"
            aria-label={`Vincular ${prompt.titulo} a um mapa`}
          >
            <option value="">Escolher mapa…</option>
            {mapasDisponiveis.map((m) => (
              <option key={m.id} value={m.id}>
                {m.titulo}
                {m.publico ? "" : " (rascunho)"}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            variant="outline"
            disabled={!selecionado}
            onClick={() => {
              onVincular(selecionado);
              setSelecionado("");
            }}
          >
            <Link2 className="size-3.5 mr-1" /> Vincular
          </Button>
        </div>
      )}
    </div>
  );
}

function FormCampos({
  form,
  setForm,
  prefixo,
}: {
  form: FormPrompt;
  setForm: (f: FormPrompt) => void;
  prefixo: string;
}) {
  return (
    <>
      <div className="space-y-1">
        <Label htmlFor={`${prefixo}-titulo`}>Título</Label>
        <Input
          id={`${prefixo}-titulo`}
          value={form.titulo}
          onChange={(e) => setForm({ ...form, titulo: e.target.value })}
          maxLength={240}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${prefixo}-desc`}>Descrição (aparece no Kit)</Label>
        <Input
          id={`${prefixo}-desc`}
          value={form.descricao}
          onChange={(e) => setForm({ ...form, descricao: e.target.value })}
          maxLength={2000}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${prefixo}-template`}>Template do prompt</Label>
        <Textarea
          id={`${prefixo}-template`}
          rows={10}
          value={form.prompt_template}
          onChange={(e) => setForm({ ...form, prompt_template: e.target.value })}
          maxLength={8000}
          placeholder={
            "Você vai analisar… use {{variaveis}} para o que o cidadão preenche.\n\nDados (CSV):\n{{cole_o_csv}}"
          }
          className="font-mono text-xs"
        />
      </div>
      <div className="space-y-2">
        <Label>Variáveis do prompt</Label>
        <p className="text-[11px] text-muted-foreground">
          Cada <code>{"{{variável}}"}</code> do template. A <strong>dica</strong> e o{" "}
          <strong>link interno</strong> (onde colher o dado) aparecem no Kit — o link deve apontar
          para a página que os passos deste mapa indicam (ex.: <code>/emendas</code>).
        </p>
        {form.variaveis.length === 0 && (
          <p className="text-xs text-muted-foreground">Nenhuma variável.</p>
        )}
        <div className="space-y-2">
          {form.variaveis.map((v, i) => (
            <div key={i} className="grid sm:grid-cols-[1fr_1.5fr_1fr_1fr_auto] gap-2 items-start">
              <Input
                aria-label="Nome da variável"
                value={v.nome}
                onChange={(e) => setForm(comVariavelAtualizada(form, i, { nome: e.target.value }))}
                placeholder="cole_o_csv"
                maxLength={60}
              />
              <Input
                aria-label="Dica de preenchimento"
                value={v.dica}
                onChange={(e) => setForm(comVariavelAtualizada(form, i, { dica: e.target.value }))}
                placeholder="Exporte o CSV em Emendas."
                maxLength={300}
              />
              <Input
                aria-label="Link interno"
                value={v.href}
                onChange={(e) => setForm(comVariavelAtualizada(form, i, { href: e.target.value }))}
                placeholder="/emendas"
                maxLength={200}
              />
              <Input
                aria-label="Rótulo do link"
                value={v.hrefLabel}
                onChange={(e) =>
                  setForm(comVariavelAtualizada(form, i, { hrefLabel: e.target.value }))
                }
                placeholder="Emendas"
                maxLength={60}
              />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                aria-label="Remover variável"
                onClick={() => setForm(comVariavelRemovida(form, i))}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setForm(comVariavelAdicionada(form))}
        >
          <Plus className="size-3.5 mr-1" /> Adicionar variável
        </Button>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor={`${prefixo}-tags`}>Tags (vírgula)</Label>
          <Input
            id={`${prefixo}-tags`}
            value={form.tags}
            onChange={(e) => setForm({ ...form, tags: e.target.value })}
            placeholder="emendas, rp9"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${prefixo}-ordem`}>Ordem</Label>
          <Input
            id={`${prefixo}-ordem`}
            type="number"
            value={form.ordem}
            onChange={(e) => setForm({ ...form, ordem: Number(e.target.value) || 0 })}
          />
        </div>
      </div>
    </>
  );
}
