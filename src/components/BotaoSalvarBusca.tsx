import { BotaoSalvarItem } from "@/components/BotaoSalvarItem";
import { chaveDaBusca, resumoDaBusca } from "@/lib/salvar-busca/logic";

export type BotaoSalvarBuscaProps = {
  /** Path da lista (ex.: "/emendas"). */
  path: string;
  /** Search params atuais da rota (só os ativos entram na chave). */
  search: Record<string, unknown>;
  /** Nome da lista (ex.: "Emendas parlamentares"). */
  titulo: string;
  /** Pares [rótulo, valor] dos filtros, para o título legível do item. */
  filtros: Array<[rotulo: string, valor: unknown]>;
  className?: string;
};

/**
 * Salva a lista com os filtros ativos como link dinâmico no caderno
 * (tipo "busca") — a lista re-roda pela URL, sem snapshot dos dados.
 */
export function BotaoSalvarBusca({ path, search, titulo, filtros, className }: BotaoSalvarBuscaProps) {
  const chave = chaveDaBusca(path, search);
  const resumo = resumoDaBusca(filtros);
  return (
    <BotaoSalvarItem
      entidadeTipo="busca"
      entidadeId={chave.slice(0, 200)}
      titulo={resumo ? `${titulo} — ${resumo}` : titulo}
      url={chave}
      className={className}
    />
  );
}
BotaoSalvarBusca.displayName = "BotaoSalvarBusca";
