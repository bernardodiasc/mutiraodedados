import type { OpcaoOrdem } from "@/lib/listagem/logic";

export type SeletorOrdenacaoProps = {
  opcoes: ReadonlyArray<OpcaoOrdem>;
  valor: string;
  aoMudar: (valor: string) => void;
  className?: string;
};

/**
 * Select padrão de ordenação das listagens. As opções são pares
 * "campo-direcao" declarados por página (ex.: data-desc, valor-asc);
 * o padrão de toda lista é a data mais nova primeiro.
 */
export function SeletorOrdenacao({ opcoes, valor, aoMudar, className }: SeletorOrdenacaoProps) {
  return (
    <select
      value={valor}
      onChange={(e) => aoMudar(e.target.value)}
      aria-label="Ordenar por"
      className={`rounded-md border bg-background px-3 py-2 text-sm ${className ?? ""}`}
    >
      {opcoes.map((o) => (
        <option key={o.valor} value={o.valor}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
SeletorOrdenacao.displayName = "SeletorOrdenacao";
