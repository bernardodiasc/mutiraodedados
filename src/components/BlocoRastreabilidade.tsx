import { ExternalLink, Database } from "lucide-react";

export type Fonte = {
  label: string;
  href?: string;
  /** Ex.: "PNCP", "SICONFI", "Câmara dos Deputados". */
  origem?: string;
};

/**
 * Bloco de rastreabilidade — sempre que uma página afirma algo, mostra
 * quais fontes públicas sustentam a afirmação.
 */
export function BlocoRastreabilidade({
  fontes,
  observacao,
}: {
  fontes: Fonte[];
  observacao?: string;
}) {
  return (
    <section
      aria-label="Rastreabilidade das fontes"
      className="border border-border rounded-xl p-4 bg-card"
    >
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Database className="size-3.5" /> O que comprova esta página
      </div>
      <ul className="mt-2 space-y-1.5 text-sm">
        {fontes.map((f, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="text-muted-foreground">•</span>
            <div>
              {f.href ? (
                <a
                  href={f.href}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium hover:text-accent inline-flex items-center gap-1"
                >
                  {f.label} <ExternalLink className="size-3" />
                </a>
              ) : (
                <span className="font-medium">{f.label}</span>
              )}
              {f.origem && (
                <span className="text-xs text-muted-foreground ml-1.5">— {f.origem}</span>
              )}
            </div>
          </li>
        ))}
      </ul>
      {observacao && (
        <p className="text-xs text-muted-foreground mt-3 leading-relaxed">{observacao}</p>
      )}
    </section>
  );
}