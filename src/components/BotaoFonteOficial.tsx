import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

export type BotaoFonteOficialProps = {
  /** URL do registro na fonte oficial (ver src/lib/links-oficiais.ts). */
  href: string;
  rotulo?: string;
  className?: string;
};

/** Primitivo "Fonte oficial": link externo para o registro de origem. */
export function BotaoFonteOficial({
  href,
  rotulo = "Ver na fonte oficial",
  className,
}: BotaoFonteOficialProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-accent/10 hover:text-accent transition-colors",
        className,
      )}
    >
      <ExternalLink className="size-3.5" />
      <span>{rotulo}</span>
    </a>
  );
}
BotaoFonteOficial.displayName = "BotaoFonteOficial";
