import { ShieldAlert } from "lucide-react";
import { Link } from "@tanstack/react-router";

/**
 * Bloco padronizado de aviso metodológico. Aparece no topo de páginas que
 * apresentam sinais investigativos automatizados (anomalias, radares, etc.).
 * Objetivo: deixar inequívoca a diferença entre padrão estatístico e
 * conclusão técnica ou jurídica.
 */
export function AvisoMetodologico({ compacto = false }: { compacto?: boolean }) {
  return (
    <aside
      role="note"
      className="border border-border bg-muted/40 rounded-md p-4 text-sm flex items-start gap-3"
    >
      <ShieldAlert className="size-4 shrink-0 mt-0.5 text-muted-foreground" />
      <div className="text-muted-foreground leading-relaxed">
        {compacto ? (
          <>
            Sinais investigativos são padrões estatísticos. Não constituem acusação nem comprovam
            irregularidade.{" "}
            <Link to="/metodologia" className="text-accent underline">
              Metodologia
            </Link>
            .
          </>
        ) : (
          <>
            <strong className="text-foreground">Sinais investigativos, não acusações.</strong> Os
            indicadores apresentados são padrões estatísticos extraídos automaticamente de dados
            públicos. Não constituem indício jurídico, parecer técnico ou conclusão sobre conduta.
            Servem como ponto de partida para checagem cidadã, jornalística ou institucional.
            Anomalias podem ter explicação legítima — uma demanda nova, uma emergência real, uma
            particularidade do mercado.{" "}
            <Link to="/metodologia" className="text-accent underline">
              Leia a metodologia
            </Link>{" "}
            ou{" "}
            <Link to="/contestar" className="text-accent underline">
              conteste uma análise
            </Link>
            .
          </>
        )}
      </div>
    </aside>
  );
}
