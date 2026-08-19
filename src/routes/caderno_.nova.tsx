import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import * as React from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Loader2, ArrowLeft, Lock } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { criarPergunta } from "@/lib/perguntas.functions";
import { obterModelo } from "@/lib/pergunta-modelos.functions";

const searchSchema = z.object({ modelo: z.string().uuid().optional() });

export const Route = createFileRoute("/caderno_/nova")({
  component: NovaPerguntaPage,
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Nova pergunta — Meu caderno" },
      {
        name: "description",
        content: "Crie uma pergunta no seu caderno — em branco ou a partir de um modelo.",
      },
    ],
  }),
});

function NovaPerguntaPage() {
  const { user, loading } = useAuth();
  const { modelo: modeloId } = Route.useSearch();
  const navigate = useNavigate();

  const obter = useServerFn(obterModelo);
  const criar = useServerFn(criarPergunta);

  const { data: modelo } = useQuery({
    queryKey: ["pergunta-modelos", "obter", modeloId],
    queryFn: () => obter({ data: { id: modeloId! } }),
    enabled: !!modeloId,
  });

  const [titulo, setTitulo] = React.useState("");
  const [contexto, setContexto] = React.useState("");

  React.useEffect(() => {
    if (modelo) {
      setTitulo(modelo.titulo);
      setContexto(modelo.contexto ?? "");
    }
  }, [modelo]);

  const mutation = useMutation({
    mutationFn: async () =>
      criar({
        data: {
          titulo: titulo.trim(),
          contexto: contexto.trim() || null,
          modelo_id: modeloId ?? null,
        },
      }),
    onSuccess: (p) => {
      toast.success("Pergunta criada no seu caderno");
      navigate({ to: "/caderno/$id", params: { id: p.id } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao criar"),
  });

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-muted-foreground flex items-center gap-2">
        <Loader2 className="size-4 animate-spin" /> Carregando…
      </div>
    );
  }
  if (!user) {
    const redirect = `/caderno/nova${modeloId ? `?modelo=${modeloId}` : ""}`;
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <Lock className="size-8 text-muted-foreground mx-auto" />
        <h1 className="font-display text-2xl mt-3">Entre para criar uma pergunta</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Toda pergunta nasce no seu caderno, privada.
        </p>
        <Link
          to="/login"
          search={{ redirect }}
          className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-md bg-foreground text-background"
        >
          Entrar
        </Link>
      </div>
    );
  }

  const pode = titulo.trim().length >= 5;

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <Link
        to="/caderno"
        className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
      >
        <ArrowLeft className="size-3.5" /> Voltar ao caderno
      </Link>
      <h1 className="font-display text-3xl mt-3">
        {modeloId ? "Nova pergunta a partir de um modelo" : "Nova pergunta"}
      </h1>
      <p className="text-sm text-muted-foreground mt-2">
        Vai nascer privada no seu caderno. Você pode editar, adicionar itens e solicitar publicação
        depois.
      </p>
      <form
        className="mt-8 space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (pode) mutation.mutate();
        }}
      >
        <div className="space-y-1">
          <Label htmlFor="titulo">Pergunta</Label>
          <Input
            id="titulo"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ex: Por que esta obra atrasou?"
            maxLength={240}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="contexto">Contexto (opcional)</Label>
          <Textarea
            id="contexto"
            value={contexto}
            onChange={(e) => setContexto(e.target.value)}
            placeholder="O que motivou esta pergunta? Que pistas você já tem?"
            rows={5}
            maxLength={4000}
          />
        </div>
        <Button type="submit" disabled={!pode || mutation.isPending}>
          {mutation.isPending && <Loader2 className="size-3.5 mr-1 animate-spin" />}
          <Plus className="size-3.5 mr-1" /> Criar no meu caderno
        </Button>
      </form>
    </div>
  );
}
