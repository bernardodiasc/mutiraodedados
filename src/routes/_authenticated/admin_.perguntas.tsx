import { createFileRoute, Link } from "@tanstack/react-router";
import * as React from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Loader2, Check, X, Eye, EyeOff, Pencil, Trash2, ArrowLeft, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AdminNav } from "@/components/AdminNav";
import { ensureAdminBeforeLoad } from "@/lib/admin-guard";
import {
  listarTodosModelos,
  criarModelo,
  atualizarModelo,
  excluirModelo,
} from "@/lib/pergunta-modelos.functions";
import {
  listarPerguntasEmRevisao,
  aprovarPergunta,
  rejeitarPergunta,
  listarPerguntasPublicasAdmin,
  editarPerguntaAdmin,
  despublicarPergunta,
  type Pergunta,
} from "@/lib/perguntas.functions";

export const Route = createFileRoute("/_authenticated/admin_/perguntas")({
  beforeLoad: ensureAdminBeforeLoad,
  component: AdminPerguntasPage,
  head: () => ({ meta: [{ title: "Perguntas — Admin" }] }),
});

function AdminPerguntasPage() {
  const [aba, setAba] = React.useState<"modelos" | "moderacao" | "publicas">("modelos");
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 space-y-6">
      <Link to="/admin" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
        <ArrowLeft className="size-3.5" /> voltar
      </Link>
      <header>
        <h1 className="font-display text-4xl">Perguntas</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Curadoria de <strong>modelos</strong> (pontos de partida exibidos em /perguntas) e
          <strong> moderação</strong> de investigações que cidadãos solicitaram publicar.
        </p>
      </header>
      <AdminNav />
      <div className="mt-4 flex gap-1 border-b border-border">
        {(["modelos", "moderacao", "publicas"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setAba(t)}
            className={`px-3 py-2 text-sm font-semibold border-b-2 -mb-px ${aba === t ? "border-accent text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {t === "modelos" ? "Modelos" : t === "moderacao" ? "Moderação" : "Publicadas"}
          </button>
        ))}
      </div>
      <div className="mt-6">
        {aba === "modelos" ? <ModelosTab /> : aba === "moderacao" ? <ModeracaoTab /> : <PublicasTab />}
      </div>
    </div>
  );
}

function ModelosTab() {
  const listar = useServerFn(listarTodosModelos);
  const criar = useServerFn(criarModelo);
  const atualizar = useServerFn(atualizarModelo);
  const excluir = useServerFn(excluirModelo);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "pergunta-modelos"],
    queryFn: () => listar(),
  });

  const [novo, setNovo] = React.useState({ titulo: "", contexto: "", ordem: 0 });
  const acaoCriar = useMutation({
    mutationFn: async () => criar({ data: { titulo: novo.titulo.trim(), contexto: novo.contexto.trim() || null, ordem: novo.ordem } }),
    onSuccess: () => { toast.success("Modelo criado"); setNovo({ titulo: "", contexto: "", ordem: 0 }); qc.invalidateQueries({ queryKey: ["admin","pergunta-modelos"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const acaoToggle = useMutation({
    mutationFn: async (m: { id: string; ativo: boolean }) => atualizar({ data: { id: m.id, ativo: !m.ativo } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin","pergunta-modelos"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const acaoExcluir = useMutation({
    mutationFn: async (id: string) => excluir({ data: { id } }),
    onSuccess: () => { toast.success("Modelo excluído"); qc.invalidateQueries({ queryKey: ["admin","pergunta-modelos"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  return (
    <div>
      <div className="border border-border rounded-xl p-5 bg-card space-y-3">
        <h2 className="font-display text-lg">Novo modelo</h2>
        <div className="space-y-1">
          <Label htmlFor="m-titulo">Pergunta</Label>
          <Input id="m-titulo" value={novo.titulo} onChange={(e) => setNovo({ ...novo, titulo: e.target.value })} maxLength={240} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="m-ctx">Contexto</Label>
          <Textarea id="m-ctx" rows={3} value={novo.contexto} onChange={(e) => setNovo({ ...novo, contexto: e.target.value })} />
        </div>
        <div className="space-y-1 max-w-[160px]">
          <Label htmlFor="m-ordem">Ordem</Label>
          <Input id="m-ordem" type="number" value={novo.ordem} onChange={(e) => setNovo({ ...novo, ordem: Number(e.target.value) || 0 })} />
        </div>
        <Button size="sm" onClick={() => acaoCriar.mutate()} disabled={novo.titulo.trim().length < 5 || acaoCriar.isPending}>
          <Plus className="size-3.5 mr-1" /> Criar modelo
        </Button>
      </div>

      <h2 className="font-display text-lg mt-8">Modelos existentes</h2>
      {isLoading ? (
        <div className="mt-3 text-muted-foreground flex items-center gap-2"><Loader2 className="size-4 animate-spin" /> Carregando…</div>
      ) : (
        <ul className="mt-3 grid gap-2">
          {(data ?? []).map((m) => (
            <li key={m.id} className="border border-border rounded-xl p-4 bg-card flex items-start gap-3">
              <div className="flex-1">
                <div className="font-display text-base">{m.titulo}</div>
                {m.contexto && <p className="text-xs text-muted-foreground mt-1">{m.contexto}</p>}
                <div className="text-[10px] uppercase mt-1 text-muted-foreground">Ordem: {m.ordem} · {m.ativo ? "Ativo" : "Inativo"}</div>
              </div>
              <button type="button" aria-label="Ativar/desativar" onClick={() => acaoToggle.mutate({ id: m.id, ativo: m.ativo })} className="p-1.5 hover:bg-muted rounded">
                {m.ativo ? <Eye className="size-4" /> : <EyeOff className="size-4 text-muted-foreground" />}
              </button>
              <button type="button" aria-label="Excluir" onClick={() => { if (confirm("Excluir modelo?")) acaoExcluir.mutate(m.id); }} className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-destructive">
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ModeracaoTab() {
  const listar = useServerFn(listarPerguntasEmRevisao);
  const aprovar = useServerFn(aprovarPergunta);
  const rejeitar = useServerFn(rejeitarPergunta);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "perguntas", "revisao"],
    queryFn: () => listar(),
  });

  const acaoAprovar = useMutation({
    mutationFn: async (id: string) => aprovar({ data: { id } }),
    onSuccess: () => { toast.success("Pergunta aprovada e publicada"); qc.invalidateQueries({ queryKey: ["admin","perguntas","revisao"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });
  const acaoRejeitar = useMutation({
    mutationFn: async (m: { id: string; motivo: string }) => rejeitar({ data: m }),
    onSuccess: () => { toast.success("Pergunta devolvida ao autor"); qc.invalidateQueries({ queryKey: ["admin","perguntas","revisao"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  return (
    <div>
      <p className="text-sm text-muted-foreground">
        Perguntas aguardando revisão para virar investigação pública. O autor nunca é exposto
        no site público — você o vê aqui apenas para contexto.
      </p>
      {isLoading ? (
        <div className="mt-4 text-muted-foreground flex items-center gap-2"><Loader2 className="size-4 animate-spin" /> Carregando…</div>
      ) : (data ?? []).length === 0 ? (
        <div className="mt-4 border border-dashed border-border rounded-xl p-5 bg-card text-sm text-muted-foreground">
          Nada pendente.
        </div>
      ) : (
        <ul className="mt-4 grid gap-3">
          {(data ?? []).map((p) => (
            <ItemRevisao
              key={p.id}
              pergunta={p}
              onAprovar={() => acaoAprovar.mutate(p.id)}
              onRejeitar={(motivo) => acaoRejeitar.mutate({ id: p.id, motivo })}
            />
          ))}
        </ul>
      )}
      <div className="mt-10 text-xs text-muted-foreground">
        Para editar ou despublicar perguntas já publicadas, use a aba <strong>Publicadas</strong>.
      </div>
    </div>
  );
}

function PublicasTab() {
  const listar = useServerFn(listarPerguntasPublicasAdmin);
  const editar = useServerFn(editarPerguntaAdmin);
  const despublicar = useServerFn(despublicarPergunta);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "perguntas", "publicas"],
    queryFn: () => listar(),
  });

  const [editandoId, setEditandoId] = React.useState<string | null>(null);

  const acaoDespublicar = useMutation({
    mutationFn: async (id: string) => despublicar({ data: { id } }),
    onSuccess: () => {
      toast.success("Pergunta despublicada");
      qc.invalidateQueries({ queryKey: ["admin", "perguntas", "publicas"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  return (
    <div>
      <p className="text-sm text-muted-foreground">
        Perguntas atualmente publicadas. Edite título, descrição, contexto, tags ou slug.
        Despublicar volta a pergunta para o caderno do autor (status privada).
      </p>
      {isLoading ? (
        <div className="mt-4 text-muted-foreground flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" /> Carregando…
        </div>
      ) : (data ?? []).length === 0 ? (
        <div className="mt-4 border border-dashed border-border rounded-xl p-5 bg-card text-sm text-muted-foreground">
          Nenhuma pergunta publicada ainda.
        </div>
      ) : (
        <ul className="mt-4 grid gap-3">
          {(data ?? []).map((p) =>
            editandoId === p.id ? (
              <FormEditarPublica
                key={p.id}
                pergunta={p}
                onCancelar={() => setEditandoId(null)}
                onSalvar={async (patch) => {
                  try {
                    await editar({ data: { id: p.id, ...patch } });
                    toast.success("Pergunta atualizada");
                    setEditandoId(null);
                    qc.invalidateQueries({ queryKey: ["admin", "perguntas", "publicas"] });
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Erro");
                  }
                }}
              />
            ) : (
              <li key={p.id} className="border border-border rounded-xl p-5 bg-card">
                <h3 className="font-display text-lg">{p.titulo}</h3>
                {p.descricao && (
                  <p className="text-sm text-muted-foreground mt-1">{p.descricao}</p>
                )}
                {p.contexto && (
                  <p className="text-sm mt-2 whitespace-pre-wrap">{p.contexto}</p>
                )}
                <div className="text-[10px] uppercase mt-2 text-muted-foreground">
                  Slug: <code>{p.slug ?? "—"}</code> · publicada em{" "}
                  {p.publicada_em ? new Date(p.publicada_em).toLocaleDateString("pt-BR") : "—"}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditandoId(p.id)}>
                    <Pencil className="size-3.5 mr-1" /> Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (confirm("Despublicar esta pergunta? Ela volta para o caderno do autor."))
                        acaoDespublicar.mutate(p.id);
                    }}
                  >
                    <EyeOff className="size-3.5 mr-1" /> Despublicar
                  </Button>
                  {p.slug && (
                    <Link
                      to="/perguntas/$slug"
                      params={{ slug: p.slug }}
                      target="_blank"
                      className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 px-2 py-1.5"
                    >
                      <ExternalLink className="size-3.5" /> Ver página pública
                    </Link>
                  )}
                </div>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}

function FormEditarPublica({
  pergunta,
  onCancelar,
  onSalvar,
}: {
  pergunta: Pergunta;
  onCancelar: () => void;
  onSalvar: (patch: {
    titulo?: string;
    descricao?: string | null;
    contexto?: string | null;
    slug?: string;
  }) => Promise<void>;
}) {
  const [titulo, setTitulo] = React.useState(pergunta.titulo);
  const [descricao, setDescricao] = React.useState(pergunta.descricao ?? "");
  const [contexto, setContexto] = React.useState(pergunta.contexto ?? "");
  const [slug, setSlug] = React.useState(pergunta.slug ?? "");
  const [salvando, setSalvando] = React.useState(false);

  return (
    <li className="border border-accent rounded-xl p-5 bg-card space-y-3">
      <div className="space-y-1">
        <Label htmlFor={`ep-tit-${pergunta.id}`}>Título</Label>
        <Input
          id={`ep-tit-${pergunta.id}`}
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          maxLength={240}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`ep-desc-${pergunta.id}`}>Descrição</Label>
        <Textarea
          id={`ep-desc-${pergunta.id}`}
          rows={2}
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          maxLength={4000}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`ep-ctx-${pergunta.id}`}>Contexto</Label>
        <Textarea
          id={`ep-ctx-${pergunta.id}`}
          rows={4}
          value={contexto}
          onChange={(e) => setContexto(e.target.value)}
          maxLength={4000}
        />
      </div>
      <div className="space-y-1 max-w-md">
        <Label htmlFor={`ep-slug-${pergunta.id}`}>Slug</Label>
        <Input
          id={`ep-slug-${pergunta.id}`}
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          maxLength={160}
          pattern="[a-z0-9-]+"
        />
        <p className="text-[10px] text-muted-foreground">Apenas letras minúsculas, números e hífen.</p>
      </div>
      <div className="flex gap-2 pt-1">
        <Button
          size="sm"
          disabled={salvando || titulo.trim().length < 5}
          onClick={async () => {
            setSalvando(true);
            try {
              const patch: {
                titulo?: string;
                descricao?: string | null;
                contexto?: string | null;
                slug?: string;
              } = {};
              if (titulo.trim() !== pergunta.titulo) patch.titulo = titulo.trim();
              if ((descricao.trim() || null) !== pergunta.descricao)
                patch.descricao = descricao.trim() || null;
              if ((contexto.trim() || null) !== pergunta.contexto)
                patch.contexto = contexto.trim() || null;
              if (slug.trim() && slug.trim() !== pergunta.slug) patch.slug = slug.trim();
              await onSalvar(patch);
            } finally {
              setSalvando(false);
            }
          }}
        >
          {salvando ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Check className="size-3.5 mr-1" />}
          Salvar
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancelar} disabled={salvando}>
          <X className="size-3.5 mr-1" /> Cancelar
        </Button>
      </div>
    </li>
  );
}

function ItemRevisao({
  pergunta,
  onAprovar,
  onRejeitar,
}: {
  pergunta: { id: string; titulo: string; descricao: string | null; contexto: string | null; solicitada_publicacao_em: string | null };
  onAprovar: () => void;
  onRejeitar: (motivo: string) => void;
}) {
  const [motivo, setMotivo] = React.useState("");
  const [mostrarMotivo, setMostrarMotivo] = React.useState(false);
  return (
    <li className="border border-border rounded-xl p-5 bg-card">
      <h3 className="font-display text-lg">{pergunta.titulo}</h3>
      {pergunta.descricao && <p className="text-sm text-muted-foreground mt-1">{pergunta.descricao}</p>}
      {pergunta.contexto && <p className="text-sm mt-2 whitespace-pre-wrap">{pergunta.contexto}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={onAprovar}><Check className="size-3.5 mr-1" /> Aprovar e publicar</Button>
        <Button size="sm" variant="outline" onClick={() => setMostrarMotivo((v) => !v)}><X className="size-3.5 mr-1" /> Rejeitar</Button>
        <Link to="/caderno/$id" params={{ id: pergunta.id }} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 px-2 py-1.5">
          <Pencil className="size-3.5" /> Abrir
        </Link>
      </div>
      {mostrarMotivo && (
        <div className="mt-3 space-y-2">
          <Textarea rows={2} placeholder="Motivo da rejeição (será mostrado ao autor)" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          <Button size="sm" variant="destructive" onClick={() => { if (motivo.trim().length >= 5) onRejeitar(motivo.trim()); }}>
            Confirmar rejeição
          </Button>
        </div>
      )}
    </li>
  );
}