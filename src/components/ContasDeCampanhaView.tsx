import { Link } from "@tanstack/react-router";
import { HandCoins, Loader2 } from "lucide-react";
import { fmtBRL } from "@/lib/fmt";
import { vinculoDeCnpj } from "@/lib/secao-vinculos/logic";
import type { Estado } from "@/lib/contas-campanha/logic";

export type AgregadoContas = { documento: string; nome: string; total: number };

export type ContasDeCampanhaViewProps = {
  estado: Estado;
  ano: number;
  topDoadores: AgregadoContas[];
  topFornecedores: AgregadoContas[];
  totalReceitas: number;
  totalDespesas: number;
};

/**
 * Contas de campanha na ficha do candidato: de quem veio e para quem foi o
 * dinheiro. CNPJs viram link para a ficha de fornecedor — o cruzamento
 * doador↔fornecedor é tese central do projeto. Some quando não há contas.
 */
export function ContasDeCampanhaView({
  estado,
  ano,
  topDoadores,
  topFornecedores,
  totalReceitas,
  totalDespesas,
}: ContasDeCampanhaViewProps) {
  if (estado === "vazio") return null;

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="font-display text-2xl flex items-center gap-2">
        <HandCoins className="size-5 text-accent" aria-hidden /> Contas de campanha · {ano}
      </h2>

      {estado === "carregando" && (
        <p className="text-sm text-muted-foreground mt-3 flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Verificando receitas e despesas…
        </p>
      )}
      {estado === "erro" && (
        <p className="text-sm text-destructive mt-3">
          Não consegui carregar as contas desta campanha.
        </p>
      )}

      {estado === "pronto" && (
        <>
          <div className="grid gap-5 md:grid-cols-2 mt-4">
            <ColunaContas
              titulo="De quem veio (top doadores)"
              totalFmt={`total recebido: ${fmtBRL(totalReceitas)}`}
              itens={topDoadores}
            />
            <ColunaContas
              titulo="Para quem foi (top fornecedores)"
              totalFmt={`total gasto: ${fmtBRL(totalDespesas)}`}
              itens={topFornecedores}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Doar e prestar serviço a campanha é legal e registrado no TSE. Um CNPJ com link também
            aparece no acervo como fornecedor — coincidência que merece checagem, nunca acusação.
          </p>
        </>
      )}
    </section>
  );
}
ContasDeCampanhaView.displayName = "ContasDeCampanhaView";

function ColunaContas({
  titulo,
  totalFmt,
  itens,
}: {
  titulo: string;
  totalFmt: string;
  itens: AgregadoContas[];
}) {
  return (
    <div>
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
        {titulo}
      </h3>
      {itens.length === 0 ? (
        <p className="text-sm text-muted-foreground mt-2">Sem registros no acervo.</p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground mt-1 font-mono">{totalFmt}</p>
          <ul className="grid gap-1 mt-2 text-sm">
            {itens.map((i) => {
              const vinculo = vinculoDeCnpj(i.documento, i.nome);
              return (
                <li
                  key={i.documento}
                  className="flex justify-between gap-3 border-b border-border/60 py-1"
                >
                  {vinculo ? (
                    <Link
                      to="/fornecedores/$cnpj"
                      params={{ cnpj: vinculo.params!.cnpj }}
                      className="truncate hover:text-accent underline-offset-2 hover:underline"
                      title={`${i.nome} — ver ficha do fornecedor`}
                    >
                      {i.nome}
                    </Link>
                  ) : (
                    <span className="truncate" title={i.nome}>
                      {i.nome}
                    </span>
                  )}
                  <span className="font-mono shrink-0">{fmtBRL(i.total)}</span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
