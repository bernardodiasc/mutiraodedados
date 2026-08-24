import * as React from "react";
import { ITENS_OPCOES, ITENS_OPCOES_AMPLIADAS, ITENS_PADRAO } from "@/lib/listagem/logic";

export type SeletorItensPorPaginaProps = {
  valor: number;
  aoMudar: (itens: number) => void;
  className?: string;
};

/**
 * Itens por página das listagens: 25/50/100 por padrão; o checkbox
 * "mais por página" libera 250/500 (limite duro — acima disso a resposta
 * certa é exportar CSV).
 */
export function SeletorItensPorPagina({ valor, aoMudar, className }: SeletorItensPorPaginaProps) {
  const [ampliado, setAmpliado] = React.useState(valor > ITENS_OPCOES[ITENS_OPCOES.length - 1]);
  const opcoes = ampliado ? [...ITENS_OPCOES, ...ITENS_OPCOES_AMPLIADAS] : [...ITENS_OPCOES];

  return (
    <div className={`flex flex-wrap items-center gap-2 text-xs ${className ?? ""}`}>
      <label className="flex items-center gap-1.5 text-muted-foreground">
        <span>Itens por página</span>
        <select
          value={valor}
          onChange={(e) => aoMudar(Number(e.target.value))}
          aria-label="Itens por página"
          className="rounded-md border bg-background px-2 py-1.5 text-xs"
        >
          {opcoes.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-1.5 text-muted-foreground cursor-pointer">
        <input
          type="checkbox"
          checked={ampliado}
          onChange={(e) => {
            const marcado = e.target.checked;
            setAmpliado(marcado);
            if (!marcado && valor > ITENS_OPCOES[ITENS_OPCOES.length - 1]) {
              aoMudar(ITENS_PADRAO);
            }
          }}
        />
        mais por página
      </label>
    </div>
  );
}
SeletorItensPorPagina.displayName = "SeletorItensPorPagina";
