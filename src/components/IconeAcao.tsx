import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type IconeAcaoTone = "neutral" | "destructive" | "accent";

export type IconeAcaoProps = {
  icon: LucideIcon;
  /** Rótulo acessível — vira aria-label e title. */
  label: string;
  onClick?: () => void;
  tone?: IconeAcaoTone;
  disabled?: boolean;
  type?: "button" | "submit";
};

const TONE: Record<IconeAcaoTone, string> = {
  neutral: "text-muted-foreground hover:text-foreground",
  destructive: "text-muted-foreground hover:text-destructive",
  accent: "text-muted-foreground hover:text-accent",
};

/**
 * Botão de ação só com ícone para linhas de listas do admin. Padrão único:
 * ícone `size-4`, área de clique `p-1.5`, hover suave. É o padrão canônico —
 * substitui os botões ad-hoc espalhados pelas telas de curadoria.
 */
export function IconeAcao({
  icon: Icon,
  label,
  onClick,
  tone = "neutral",
  disabled,
  type = "button",
}: IconeAcaoProps) {
  return (
    <button
      type={type}
      data-flat
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center rounded-md p-1.5 transition-colors hover:bg-muted/60",
        TONE[tone],
        disabled && "opacity-40 cursor-not-allowed",
      )}
    >
      <Icon className="size-4" />
    </button>
  );
}

IconeAcao.displayName = "IconeAcao";
