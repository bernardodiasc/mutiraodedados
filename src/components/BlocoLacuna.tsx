import { CircleDashed } from "lucide-react";
import { Link } from "@tanstack/react-router";

export type LacunaTipo =
  | "Transparência"
  | "Avaliação"
  | "Mensuração"
  | "Documental"
  | "Institucional"
  | "Metodológica";

/**
 * Bloco de lacuna — mostra, em qualquer página, "o que ainda não é público"
 * sobre o tema. Versão mock da Onda 1: conteúdo passado por prop.
 */
export function BlocoLacuna({
  tipo,
  titulo,
  descricao,
}: {
  tipo: LacunaTipo;
  titulo: string;
  descricao: string;
}) {
  return (
    <aside className="border border-dashed border-border rounded-xl p-4 bg-muted/30">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <CircleDashed className="size-3.5" />
        Informação que falta — <span className="text-accent">{tipo}</span>
      </div>
      <div className="font-semibold mt-1.5">{titulo}</div>
      <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{descricao}</p>
      <Link
        to="/lacunas"
        className="text-xs font-semibold text-accent mt-2 inline-block hover:underline underline-offset-4"
      >
        Ver outras lacunas →
      </Link>
    </aside>
  );
}