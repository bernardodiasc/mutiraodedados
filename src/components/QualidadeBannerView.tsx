import { Link } from "@tanstack/react-router";
import { AlertTriangle, Loader2 } from "lucide-react";
import { obterRotuloStatus, type QualidadeBannerViewProps } from "@/lib/qualidade-banner/logic";

export function QualidadeBannerView({
  findingsCount,
  principalFinding,
  isLoading,
}: QualidadeBannerViewProps) {
  if (isLoading) {
    return (
      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Verificando qualidade...
      </div>
    );
  }

  if (findingsCount === 0 || !principalFinding) return null;

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 flex items-start gap-3">
      <AlertTriangle className="size-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
      <div className="text-sm">
        <div className="font-medium text-foreground">
          Inconsistência sinalizada nesta página
          {findingsCount > 1 ? ` (${findingsCount})` : ""}.
        </div>
        <p className="text-muted-foreground mt-1">
          {obterRotuloStatus(principalFinding.status)} — regra{" "}
          <code className="text-xs">{principalFinding.regra}</code>.{" "}
          <Link
            to="/qualidade/$id"
            params={{ id: principalFinding.id }}
            className="text-accent underline"
          >
            Ver registro público
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
QualidadeBannerView.displayName = "QualidadeBannerView";
