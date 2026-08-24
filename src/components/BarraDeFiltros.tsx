import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Faixa padronizada de filtros das listagens.
 *
 * Convenção única de controles (não misturar estilos para a mesma coisa):
 * - `FiltroAbas` só para recortes mutuamente exclusivos com poucas opções
 *   (fonte, ângulo de leitura);
 * - `<select>` para enums (UF, ano, modalidade);
 * - combobox para entidade (padrão `IbgeCombobox`);
 * - `<input>` texto para busca livre.
 * Todo filtro vive nos search params da URL — nunca em `useState`.
 */
export function BarraDeFiltros({
  children,
  acoes,
  className,
}: {
  children: React.ReactNode;
  /** Linha inferior opcional: ordenação, itens por página, salvar busca, CSV. */
  acoes?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-2xl border border-border bg-card p-4 space-y-3", className)}>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">{children}</div>
      {acoes && <div className="flex flex-wrap items-center justify-between gap-2">{acoes}</div>}
    </section>
  );
}
BarraDeFiltros.displayName = "BarraDeFiltros";
