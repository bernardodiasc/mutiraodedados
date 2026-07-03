import { Link } from "@tanstack/react-router";
import { Layers } from "lucide-react";

/**
 * Indicador de "mesmo tipo de dado em várias fontes".
 *
 * Um tema (contratos, convênios, emendas…) frequentemente aparece em mais de uma
 * fonte oficial — ex.: contratos no Portal CGU **e** no PNCP; convênios no Portal
 * CGU **e** no Transferegov. Este banner torna isso explícito na página-tema,
 * ligando o eixo "Por tema" ao eixo "Por fonte".
 */
export type FonteRelacionada = {
  label: string;
  /** Rota interna (ex.: "/pncp") OU URL externa (começando com http). */
  to: string;
  /** Texto curto explicando a relação (tooltip). */
  nota?: string;
};

export function FontesDoTema({ fontes }: { fontes: FonteRelacionada[] }) {
  if (fontes.length === 0) return null;
  return (
    <div className="rounded-xl border border-border bg-muted/30 px-4 py-2.5 text-sm flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        <Layers className="size-3.5" /> Este tipo de dado também aparece em:
      </span>
      {fontes.map((f) =>
        f.to.startsWith("http") ? (
          <a
            key={f.to}
            href={f.to}
            target="_blank"
            rel="noreferrer"
            title={f.nota}
            className="text-accent underline"
          >
            {f.label}
          </a>
        ) : (
          <Link key={f.to} to={f.to} title={f.nota} className="text-accent underline">
            {f.label}
          </Link>
        ),
      )}
    </div>
  );
}
