import { createFileRoute, Link } from "@tanstack/react-router";
import { Bookmark, HelpCircle, Loader2, Lock, Plus } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { AnotacoesCaderno } from "@/components/AnotacoesCaderno";
import { CadernoPerguntasSalvasContainer } from "@/containers/CadernoPerguntasSalvasContainer";
import { CadernoItensSalvosContainer } from "@/containers/CadernoItensSalvosContainer";

export const Route = createFileRoute("/caderno")({
  component: CadernoPage,
  head: () => ({
    meta: [
      { title: "Meu caderno — Mutirão de Dados" },
      {
        name: "description",
        content:
          "Caderno pessoal de investigação cidadã: perguntas e itens salvos, privados por padrão.",
      },
      { property: "og:title", content: "Meu caderno — Mutirão de Dados" },
      {
        property: "og:description",
        content:
          "Salve perguntas, contratos, anomalias e órgãos. Privado por padrão. Você decide quando compartilhar.",
      },
    ],
    links: [{ rel: "canonical", href: "https://mutiraodedados.com.br/caderno" }],
  }),
});

function CadernoPage() {
  const { user, loading } = useAuth();

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <header className="max-w-3xl">
        <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-accent">
          <Bookmark className="size-4" /> Modo investigar
        </div>
        <h1 className="font-display text-4xl sm:text-5xl mt-3 leading-tight">Meu caderno.</h1>
        <p className="text-muted-foreground mt-4 text-lg">
          Suas pastas de investigação. Cada pergunta nasce privada e pode reunir contratos, órgãos,
          sinais, lacunas, links e anotações. Você decide se e quando publicar.
        </p>
        {user && (
          <div className="mt-5">
            <Link
              to="/caderno/nova"
              className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-md bg-foreground text-background hover:opacity-90"
            >
              <Plus className="size-3.5" /> Nova pergunta
            </Link>
          </div>
        )}
      </header>

      <section className="mt-10">
        {loading ? (
          <div className="border border-border rounded-xl p-8 bg-card flex items-center gap-3 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Carregando seu caderno…
          </div>
        ) : !user ? (
          <NaoAutenticado />
        ) : (
          <>
            <CadernoPerguntasSalvasContainer />
            <div className="mt-12">
              <CadernoItensSalvosContainer />
            </div>
            <div className="mt-12">
              <AnotacoesCaderno />
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function NaoAutenticado() {
  return (
    <div className="border border-dashed border-border rounded-xl p-8 bg-card text-center">
      <Lock className="size-8 text-muted-foreground mx-auto" />
      <h2 className="font-display text-xl mt-3">Entre para abrir seu caderno.</h2>
      <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
        O caderno é seu — privado por padrão. Crie uma conta gratuita para salvar perguntas, órgãos
        e sinais ao longo da sua investigação.
      </p>
      <div className="mt-5 flex flex-wrap gap-2 justify-center">
        <Link
          to="/login"
          search={{ redirect: "/caderno" }}
          className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-md bg-foreground text-background hover:opacity-90"
        >
          Entrar ou criar conta
        </Link>
        <Link
          to="/perguntas"
          className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-md border border-border hover:bg-muted"
        >
          <HelpCircle className="size-3.5" /> Ver perguntas
        </Link>
      </div>
    </div>
  );
}
