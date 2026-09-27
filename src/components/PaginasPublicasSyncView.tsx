import { Button } from "@/components/ui/button";
import { emDia, type ResumoSincronizacao } from "@/lib/paginas-publicas/sincronizar";

export type PaginasPublicasSyncViewProps = {
  estado: "carregando" | "erro" | "pronto";
  resumo: ResumoSincronizacao | null;
  mensagemErro: string | null;
  onSincronizar: () => void;
  sincronizando: boolean;
  /** Resultado da última sincronização. */
  resultado: string | null;
};

const LISTAS = [
  { chave: "novas", rotulo: "novas" },
  { chave: "alteradas", rotulo: "alteradas" },
  { chave: "removidas", rotulo: "saíram da lista" },
] as const;

/**
 * Páginas estáticas na busca: a tabela `paginas_publicas` × a lista do
 * código, e o botão que sincroniza as duas.
 */
export function PaginasPublicasSyncView(p: PaginasPublicasSyncViewProps) {
  const r = p.resumo;
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <h3 className="font-display text-lg">Páginas do site na busca</h3>
      <p className="text-xs text-muted-foreground max-w-3xl">
        Ajuda, método, trilhas, referências e páginas de fonte entram na busca a partir de uma lista
        no código. Depois de um deploy que muda essa lista, sincronize: as entradas novas ou
        alteradas são gravadas e as que saíram são retiradas do índice.
      </p>
      {p.estado === "carregando" && (
        <p className="text-sm text-muted-foreground">Conferindo com o código…</p>
      )}
      {p.estado === "erro" && (
        <p role="alert" className="text-sm text-destructive">
          {p.mensagemErro}
        </p>
      )}
      {p.estado === "pronto" && r && (
        <div className="space-y-2 text-xs">
          {emDia(r) ? (
            <p>
              Em dia com o código: {r.iguais.toLocaleString("pt-BR")}{" "}
              {r.iguais === 1 ? "entrada" : "entradas"}.
            </p>
          ) : (
            <ul className="space-y-1">
              {LISTAS.map(({ chave, rotulo }) =>
                r[chave].length ? (
                  <li key={chave}>
                    <span className="font-medium">
                      {r[chave].length} {rotulo}:
                    </span>{" "}
                    <span className="font-mono text-muted-foreground">{r[chave].join(", ")}</span>
                  </li>
                ) : null,
              )}
            </ul>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={p.onSincronizar}
            disabled={p.sincronizando || emDia(r)}
          >
            {p.sincronizando ? "Sincronizando…" : "Sincronizar páginas"}
          </Button>
        </div>
      )}
      {p.resultado && (
        <p role="status" className="text-xs text-muted-foreground">
          {p.resultado}
        </p>
      )}
    </div>
  );
}
