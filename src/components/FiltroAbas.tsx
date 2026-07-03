export type FiltroAba = { chave: string; label: string; qtd: number };

export type FiltroAbasProps = {
  abas: FiltroAba[];
  ativa: string;
  onChange: (chave: string) => void;
};

/**
 * Navegação de filtro por abas com contadores — o padrão único das listas do
 * admin (Tudo / categorias / status, cada uma com a contagem em pílula).
 */
export function FiltroAbas({ abas, ativa, onChange }: FiltroAbasProps) {
  return (
    <nav className="inline-flex flex-wrap rounded-lg border border-border bg-card/50 p-1 text-xs">
      {abas.map((a) => (
        <button
          data-flat
          key={a.chave}
          onClick={() => onChange(a.chave)}
          className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
            ativa === a.chave
              ? "bg-accent/15 text-accent"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {a.label}
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded-full ${
              ativa === a.chave ? "bg-accent/20 text-accent" : "bg-muted text-muted-foreground"
            }`}
          >
            {a.qtd}
          </span>
        </button>
      ))}
    </nav>
  );
}

FiltroAbas.displayName = "FiltroAbas";
