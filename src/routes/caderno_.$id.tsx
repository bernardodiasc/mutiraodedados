import { createFileRoute, Link, useNavigate, notFound } from "@tanstack/react-router";
import * as React from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Lock,
  Loader2,
  Globe,
  Archive,
  Send,
  ArchiveRestore,
  CheckCircle2,
  Trash2,
  ExternalLink,
  Plus,
  Link2,
  StickyNote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import {
  obterPergunta,
  solicitarPublicacao,
  arquivarPergunta,
  reabrirPergunta,
  encerrarPergunta,
  excluirPergunta,
} from "@/lib/perguntas.functions";
import {
  listarItensDaPergunta,
  removerItem,
  adicionarItem,
} from "@/lib/pergunta-itens.functions";
import { formatarStatusPergunta, formatarDataPt } from "@/lib/caderno-perguntas/logic";

export const Route = createFileRoute("/caderno_/$id")({
  component: CadernoDetalhePage,
  head: () => ({
    meta: [{ title: "Pergunta — Meu caderno" }],
  }),
  notFoundComponent: () => (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      Pergunta não encontrada no seu caderno.
    </div>
  ),
});

function CadernoDetalhePage() {
  const { id } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const obter = useServerFn(obterPergunta);
  const listarItens = useServerFn(listarItensDaPergunta);
  const solicitar = useServerFn(solicitarPublicacao);
  const arquivar = useServerFn(arquivarPergunta);
  const reabrir = useServerFn(reabrirPergunta);
  const encerrar = useServerFn(encerrarPergunta);
  const excluir = useServerFn(excluirPergunta);
  const removerItemFn = useServerFn(removerItem);
  const adicionarFn = useServerFn(adicionarItem);

  const [formAberto, setFormAberto] = React.useState<null | "link" | "anotacao">(null);
  const [fTitulo, setFTitulo] = React.useState("");
  const [fUrl, setFUrl] = React.useState("");
  const [fNota, setFNota] = React.useState("");

  const { data: pergunta, isLoading, error } = useQuery({
    queryKey: ["perguntas", "obter", id],
    queryFn: () => obter({ data: { id } }),
    enabled: !!user,
  });
  const { data: itens } = useQuery({
    queryKey: ["pergunta-itens", id],
    queryFn: () => listarItens({ data: { pergunta_id: id } }),
    enabled: !!user,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["perguntas", "obter", id] });
    queryClient.invalidateQueries({ queryKey: ["perguntas", "minhas"] });
  };

  const acaoSolicitar = useMutation({
    mutationFn: async () => solicitar({ data: { id } }),
    onSuccess: () => { toast.success("Solicitação enviada para revisão"); invalidate(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });
  const acaoArquivar = useMutation({
    mutationFn: async () => arquivar({ data: { id } }),
    onSuccess: () => { toast.success("Arquivada"); invalidate(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });
  const acaoReabrir = useMutation({
    mutationFn: async () => reabrir({ data: { id } }),
    onSuccess: () => { toast.success("Reaberta"); invalidate(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });
  const acaoEncerrar = useMutation({
    mutationFn: async () => encerrar({ data: { id } }),
    onSuccess: () => { toast.success("Investigação encerrada"); invalidate(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });
  const acaoExcluir = useMutation({
    mutationFn: async () => excluir({ data: { id } }),
    onSuccess: () => { toast.success("Excluída"); navigate({ to: "/caderno" }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });
  const acaoRemoverItem = useMutation({
    mutationFn: async (itemId: string) => removerItemFn({ data: { id: itemId } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pergunta-itens", id] }),
  });
  const acaoAdicionar = useMutation({
    mutationFn: async () => {
      if (!formAberto) throw new Error("");
      return adicionarFn({
        data: {
          pergunta_id: id,
          tipo: formAberto,
          titulo: fTitulo.trim() || (formAberto === "link" ? fUrl.trim() : "Nota"),
          url: formAberto === "link" ? fUrl.trim() || null : null,
          nota: fNota.trim() || null,
        },
      });
    },
    onSuccess: () => {
      toast.success(formAberto === "link" ? "Link adicionado" : "Nota adicionada");
      setFormAberto(null);
      setFTitulo(""); setFUrl(""); setFNota("");
      queryClient.invalidateQueries({ queryKey: ["pergunta-itens", id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  if (loading || isLoading) {
    return <div className="mx-auto max-w-3xl px-4 py-16 text-muted-foreground flex items-center gap-2"><Loader2 className="size-4 animate-spin" /> Carregando…</div>;
  }
  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <Lock className="size-8 text-muted-foreground mx-auto" />
        <h1 className="font-display text-2xl mt-3">Entre para abrir esta pergunta</h1>
        <Link to="/login" search={{ redirect: `/caderno/${id}` }} className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-md bg-foreground text-background">Entrar</Link>
      </div>
    );
  }
  if (error) {
    throw notFound();
  }
  if (!pergunta) return null;

  const podeSolicitar = pergunta.status === "privada";
  const podeArquivar = pergunta.status === "privada";
  const podeReabrir = pergunta.status === "arquivada";
  const podeEncerrar = pergunta.status === "publicada";

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <Link to="/caderno" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
        <ArrowLeft className="size-3.5" /> Voltar ao caderno
      </Link>
      <div className="mt-3 flex items-baseline gap-2 flex-wrap">
        <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-muted text-muted-foreground">
          {formatarStatusPergunta(pergunta.status)}
        </span>
        {pergunta.visibilidade_publica && (
          <span className="text-[11px] font-semibold inline-flex items-center gap-1 text-accent">
            <Globe className="size-3" /> Visível publicamente
          </span>
        )}
      </div>
      <h1 className="font-display text-3xl mt-2 leading-tight">{pergunta.titulo}</h1>
      {pergunta.contexto && (
        <p className="mt-3 text-muted-foreground leading-relaxed whitespace-pre-wrap">{pergunta.contexto}</p>
      )}
      <div className="mt-2 text-[11px] text-muted-foreground">
        Criada em {formatarDataPt(pergunta.created_at)} · Atualizada em {formatarDataPt(pergunta.updated_at)}
      </div>
      {pergunta.motivo_rejeicao && (
        <div className="mt-4 border border-destructive/30 bg-destructive/5 rounded-md p-3 text-sm">
          <strong>Publicação rejeitada:</strong> {pergunta.motivo_rejeicao}
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        {podeSolicitar && (
          <Button size="sm" onClick={() => acaoSolicitar.mutate()} disabled={acaoSolicitar.isPending}>
            <Send className="size-3.5 mr-1" /> Solicitar publicação
          </Button>
        )}
        {podeEncerrar && (
          <Button size="sm" variant="outline" onClick={() => acaoEncerrar.mutate()} disabled={acaoEncerrar.isPending}>
            <CheckCircle2 className="size-3.5 mr-1" /> Encerrar investigação
          </Button>
        )}
        {podeArquivar && (
          <Button size="sm" variant="outline" onClick={() => acaoArquivar.mutate()} disabled={acaoArquivar.isPending}>
            <Archive className="size-3.5 mr-1" /> Arquivar
          </Button>
        )}
        {podeReabrir && (
          <Button size="sm" variant="outline" onClick={() => acaoReabrir.mutate()} disabled={acaoReabrir.isPending}>
            <ArchiveRestore className="size-3.5 mr-1" /> Reabrir
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => { if (confirm("Excluir esta pergunta e tudo dentro dela?")) acaoExcluir.mutate(); }}
          disabled={acaoExcluir.isPending}
          className="text-muted-foreground hover:text-destructive ml-auto"
        >
          <Trash2 className="size-3.5 mr-1" /> Excluir
        </Button>
      </div>

      <section className="mt-10">
        <h2 className="font-display text-xl">Itens desta pasta</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Contratos, órgãos, fornecedores, lacunas, links e notas que você juntou aqui.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setFormAberto(formAberto === "link" ? null : "link")}>
            <Link2 className="size-3.5 mr-1" /> Adicionar link
          </Button>
          <Button size="sm" variant="outline" onClick={() => setFormAberto(formAberto === "anotacao" ? null : "anotacao")}>
            <StickyNote className="size-3.5 mr-1" /> Adicionar nota
          </Button>
          <span className="text-xs text-muted-foreground self-center">
            Para salvar contratos, fornecedores, parlamentares etc., use <strong>Salvar no caderno</strong> na página do item.
          </span>
        </div>
        {formAberto && (
          <div className="mt-3 border border-border rounded-xl p-4 bg-card space-y-3">
            <div className="text-sm font-semibold">
              {formAberto === "link" ? "Novo link" : "Nova nota"}
            </div>
            <Input
              placeholder={formAberto === "link" ? "Título do link" : "Título da nota"}
              value={fTitulo}
              onChange={(e) => setFTitulo(e.target.value)}
            />
            {formAberto === "link" && (
              <Input
                type="url"
                placeholder="https://…"
                value={fUrl}
                onChange={(e) => setFUrl(e.target.value)}
              />
            )}
            <Textarea
              placeholder={formAberto === "link" ? "Anotação opcional sobre este link" : "Escreva a nota"}
              value={fNota}
              onChange={(e) => setFNota(e.target.value)}
              rows={formAberto === "anotacao" ? 5 : 3}
            />
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="ghost" onClick={() => { setFormAberto(null); setFTitulo(""); setFUrl(""); setFNota(""); }}>
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={() => acaoAdicionar.mutate()}
                disabled={
                  acaoAdicionar.isPending ||
                  (formAberto === "link" ? !fUrl.trim() : !fNota.trim())
                }
              >
                <Plus className="size-3.5 mr-1" /> Adicionar
              </Button>
            </div>
          </div>
        )}
        {!itens || itens.length === 0 ? (
          <div className="mt-4 border border-dashed border-border rounded-xl p-5 bg-card text-sm text-muted-foreground">
            Sem itens ainda. Quando você usar <strong>Salvar no caderno</strong> em outras
            páginas, escolha esta pasta para que o item apareça aqui. (Em breve um seletor de
            pasta no botão de salvar.)
          </div>
        ) : (
          <ul className="mt-4 grid gap-2">
            {itens.map((it) => (
              <li key={it.id} className="border border-border rounded-xl p-4 bg-card flex items-center gap-3">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold px-2 py-0.5 rounded bg-muted">
                  {it.tipo}
                </span>
                <div className="flex-1 min-w-0">
                  {it.url ? (
                    <a href={it.url} className="text-sm font-semibold hover:text-accent inline-flex items-center gap-1">
                      {it.titulo} <ExternalLink className="size-3" />
                    </a>
                  ) : (
                    <div className="text-sm font-semibold">{it.titulo}</div>
                  )}
                  {it.nota && <p className="text-xs text-muted-foreground mt-1">{it.nota}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => acaoRemoverItem.mutate(it.id)}
                  aria-label="Remover item"
                  className="text-muted-foreground hover:text-destructive p-1.5 rounded-md hover:bg-muted"
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}