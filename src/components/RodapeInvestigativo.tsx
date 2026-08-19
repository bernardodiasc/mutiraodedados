import { Link } from "@tanstack/react-router";
import { BookOpen, HelpCircle, Bookmark } from "lucide-react";

/**
 * Rodapé das páginas de detalhe (órgão, contrato, anomalia, etc.).
 * Reforça os três modos do produto: aprender, perguntar, investigar.
 */
export function RodapeInvestigativo({
  tema,
  linkAprender,
}: {
  tema?: string;
  linkAprender?: { to: string; label: string };
}) {
  return (
    <section
      aria-label="Próximos passos"
      className="mt-12 border-t border-border pt-8 grid sm:grid-cols-3 gap-4"
    >
      <Link
        to={linkAprender?.to ?? "/aprender"}
        className="group border border-border rounded-xl p-5 bg-card hover:border-accent transition-colors"
      >
        <BookOpen className="size-5 text-accent" />
        <div className="font-semibold mt-3">Aprender sobre isto</div>
        <p className="text-sm text-muted-foreground mt-1">
          {linkAprender?.label ?? "Contexto, vocabulário e leis pertinentes."}
        </p>
      </Link>
      <Link
        to="/perguntas"
        className="group border border-border rounded-xl p-5 bg-card hover:border-accent transition-colors"
      >
        <HelpCircle className="size-5 text-accent" />
        <div className="font-semibold mt-3">Fazer uma pergunta</div>
        <p className="text-sm text-muted-foreground mt-1">
          {tema
            ? `Veja perguntas abertas relacionadas a ${tema}.`
            : "Veja perguntas abertas sobre o funcionamento do Estado."}
        </p>
      </Link>
      <Link
        to="/caderno"
        className="group border border-border rounded-xl p-5 bg-card hover:border-accent transition-colors"
      >
        <Bookmark className="size-5 text-accent" />
        <div className="font-semibold mt-3">Salvar no meu caderno</div>
        <p className="text-sm text-muted-foreground mt-1">
          Reúna perguntas e itens para revisar depois. Privado por padrão.
        </p>
      </Link>
    </section>
  );
}
