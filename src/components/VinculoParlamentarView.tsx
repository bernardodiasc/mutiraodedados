import { Link } from "@tanstack/react-router";
import { ArrowRight, BadgeCheck, TriangleAlert } from "lucide-react";
import type { ParlamentarVinculado } from "@/lib/data/tse/queries.functions";

export type VinculoParlamentarViewProps = {
  parlamentares: ParlamentarVinculado[];
};

/**
 * Ponte da candidatura para o mandato — a volta do que a ficha do parlamentar
 * já fazia na ida.
 *
 * Some quando não há vínculo: a esmagadora maioria das candidaturas não elegeu
 * ninguém, e uma seção vazia dizendo "sem mandato" seria ruído em toda ficha.
 */
export function VinculoParlamentarView({ parlamentares }: VinculoParlamentarViewProps) {
  if (parlamentares.length === 0) return null;

  return (
    <section className="border border-border rounded-xl p-5 bg-card">
      <h2 className="font-display text-lg flex items-center gap-2">
        <BadgeCheck className="size-4 text-accent" /> Mandato no Mutirão de Dados
      </h2>
      <p className="text-sm text-muted-foreground mt-2">
        {parlamentares.length === 1
          ? "Esta pessoa também tem ficha como parlamentar em exercício — com gastos de cota, votações e proposições."
          : "Esta pessoa tem mais de uma ficha de parlamentar em exercício no site."}
      </p>

      <ul className="grid gap-2 mt-3">
        {parlamentares.map((p) => (
          <li key={`${p.tipo}-${p.id}`}>
            {p.tipo === "deputado" ? (
              <Link
                to="/camara/deputados/$id"
                params={{ id: p.id }}
                className="flex items-center justify-between gap-3 border border-border rounded-lg px-3 py-2 hover:border-accent hover:text-accent"
              >
                <Rotulo p={p} casa="Deputado federal · Câmara" />
                <ArrowRight className="size-4 shrink-0" />
              </Link>
            ) : (
              <Link
                to="/senado/senadores/$id"
                params={{ id: p.id }}
                className="flex items-center justify-between gap-3 border border-border rounded-lg px-3 py-2 hover:border-accent hover:text-accent"
              >
                <Rotulo p={p} casa="Senador · Senado" />
                <ArrowRight className="size-4 shrink-0" />
              </Link>
            )}
            {p.matchMetodo !== "cpf" && (
              <p className="text-xs text-muted-foreground mt-1 flex items-start gap-1.5">
                <TriangleAlert className="size-3.5 shrink-0 mt-0.5" />
                Vínculo deduzido por nome, UF e partido — o TSE não divulgou o CPF nessa
                candidatura. Homônimo pode gerar ligação errada; confira antes de citar.
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
VinculoParlamentarView.displayName = "VinculoParlamentarView";

function Rotulo({ p, casa }: { p: ParlamentarVinculado; casa: string }) {
  const detalhe = [p.partido, p.uf].filter(Boolean).join(" · ");
  return (
    <span className="min-w-0">
      <span className="block font-medium truncate">{p.nome}</span>
      <span className="block text-xs text-muted-foreground">
        {casa}
        {detalhe && ` · ${detalhe}`} ·{" "}
        {p.origemEhAtual
          ? "vínculo por esta candidatura"
          : `vínculo pela candidatura de ${p.anoOrigem}`}
      </span>
    </span>
  );
}
