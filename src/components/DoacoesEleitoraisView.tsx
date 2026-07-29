import { Link } from "@tanstack/react-router";
import { HandCoins, Loader2 } from "lucide-react";
import { AvisoMetodologico } from "@/components/AvisoMetodologico";
import { fmtBRL } from "@/lib/fmt";
import type { DoacaoItem, Estado } from "@/lib/doacoes-eleitorais/logic";

export type DoacoesEleitoraisViewProps = {
  estado: Estado;
  itens: DoacaoItem[];
  total: number;
};

/**
 * Seção "Doações eleitorais" da ficha do fornecedor: campanhas que receberam
 * dinheiro deste CNPJ (fonte TSE). Some quando não há doações — a maioria dos
 * fornecedores nunca doou.
 */
export function DoacoesEleitoraisView({ estado, itens, total }: DoacoesEleitoraisViewProps) {
  if (estado === "vazio") return null;
  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-3">
      <h2 className="font-display text-2xl flex items-center gap-2">
        <HandCoins className="size-5 text-accent" /> Doações eleitorais
      </h2>
      {estado === "carregando" && (
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" /> Verificando doações de campanha…
        </p>
      )}
      {estado === "erro" && (
        <p className="text-sm text-destructive">Não consegui verificar as doações eleitorais.</p>
      )}
      {estado === "pronto" && (
        <>
          <p className="text-sm text-muted-foreground">
            Este CNPJ aparece como <strong>doador de campanha</strong> nas prestações de contas do
            TSE — <span className="font-mono">{fmtBRL(total)}</span> no total listado abaixo.
          </p>
          <AvisoMetodologico compacto />
          <ul className="grid gap-1 text-sm">
            {itens.map((d, i) => (
              <li key={i} className="flex justify-between gap-3 border-b border-border/60 py-1.5">
                <span className="min-w-0">
                  <Link
                    to="/eleicoes/candidatos/$sq"
                    params={{ sq: d.sq }}
                    search={{ ano: d.ano }}
                    className="hover:text-accent font-medium"
                  >
                    {d.candidato}
                  </Link>
                  <span className="text-muted-foreground">
                    {" "}
                    — {d.detalhe} · {d.ano}
                  </span>
                </span>
                <span className="font-mono shrink-0">{fmtBRL(d.valor)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
DoacoesEleitoraisView.displayName = "DoacoesEleitoraisView";
