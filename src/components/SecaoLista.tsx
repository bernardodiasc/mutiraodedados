import * as React from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FiltroAbas, type FiltroAba } from "@/components/FiltroAbas";

export type SecaoListaProps = {
  /** Título da seção (ex.: "Itens"). */
  titulo: string;
  /** Abas de filtro. Omita (ou passe vazio) para uma lista sem filtro. */
  abas?: FiltroAba[];
  abaAtiva?: string;
  onAbaChange?: (chave: string) => void;
  onBaixarCsv: () => void;
  csvDesabilitado?: boolean;
  /** A lista em si (ListaOrdenavel, estados de carregando/vazio, etc.). */
  children: React.ReactNode;
};

/**
 * Cabeçalho padronizado das listas do admin: título + filtro por abas + botão
 * "Baixar CSV". O CSV baixa sempre o subconjunto filtrado. Compõe `FiltroAbas`.
 */
export function SecaoLista({
  titulo,
  abas,
  abaAtiva,
  onAbaChange,
  onBaixarCsv,
  csvDesabilitado,
  children,
}: SecaoListaProps) {
  const temFiltro = !!abas && abas.length > 0;
  return (
    <section className="space-y-2">
      <h2 className="font-display text-lg">{titulo}</h2>
      <div
        className={`flex flex-wrap items-center gap-2 ${temFiltro ? "justify-between" : "justify-end"}`}
      >
        {temFiltro && (
          <FiltroAbas abas={abas} ativa={abaAtiva ?? ""} onChange={(c) => onAbaChange?.(c)} />
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onBaixarCsv}
          disabled={csvDesabilitado}
        >
          <Download className="size-3.5 mr-1.5" /> Baixar CSV
        </Button>
      </div>
      {children}
    </section>
  );
}

SecaoLista.displayName = "SecaoLista";
