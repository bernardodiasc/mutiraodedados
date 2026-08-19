import { Link } from "@tanstack/react-router";
import { HardHat, X } from "lucide-react";
import { useState } from "react";

export function ConstrucaoBanner() {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;

  return (
    <div className="sticky top-16 z-30 border-b border-amber-500/30 bg-amber-50 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100">
      <div className="mx-auto max-w-7xl px-4 py-1.5 flex items-center gap-2 text-xs sm:text-sm">
        <HardHat className="size-4 shrink-0" aria-hidden />
        <p className="flex-1 truncate">
          <span className="font-semibold">Site em construção:</span>{" "}
          <span className="hidden sm:inline">
            dados reais de fontes oficiais, mas ainda incompletos — acompanhe o{" "}
          </span>
          <span className="sm:hidden">veja </span>
          <Link to="/roadmap" className="underline underline-offset-2 hover:text-accent">
            roadmap
          </Link>{" "}
          e a{" "}
          <Link to="/cobertura" className="underline underline-offset-2 hover:text-accent">
            cobertura
          </Link>
          .
        </p>
        <button
          onClick={() => setVisible(false)}
          aria-label="Fechar aviso"
          className="shrink-0 p-1 rounded hover:bg-amber-500/20 transition-colors"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
