export type Estado = "carregando" | "erro" | "vazio" | "pronto";

/**
 * Estado da seção "Contas de campanha" da ficha do candidato — some quando a
 * campanha não tem receitas nem despesas no acervo (seção vazia seria ruído).
 */
export function deriveEstado(input: {
  carregando: boolean;
  temErro: boolean;
  temDados: boolean;
}): Estado {
  if (input.carregando) return "carregando";
  if (input.temErro) return "erro";
  return input.temDados ? "pronto" : "vazio";
}

/** Lançamentos (receitas ou despesas) por página na ficha. */
export const POR_PAGINA_LANCAMENTOS = 20;

/** Id de receita/despesa do TSE: `<ano>-<SQ>` (2018+) ou `<ano>-<hash hex>` (2014/2016). */
export const ID_LANCAMENTO_RE = /^\d{4}-[0-9a-z]+$/i;

export type TipoLancamento = "receitas" | "despesas";

/**
 * Âncora da linha do lançamento na ficha — o destino da busca aponta para ela
 * (`#receita-<id>`, `#despesa-<id>`).
 */
export function ancoraLancamento(tipo: TipoLancamento, id: string): string {
  return `${tipo === "receitas" ? "receita" : "despesa"}-${id}`;
}

/**
 * Documento como pode ser exibido: CNPJ formatado; CPF completo vira mascarado
 * (***.456.789-**); CPF que já veio mascarado do TSE fica como veio; qualquer
 * outra coisa vira null. Mesma regra de `busca_documento_publico` no banco.
 */
export function documentoPublico(doc: string | null): string | null {
  if (!doc) return null;
  const d = doc.replace(/\D/g, "");
  if (d.length === 14) {
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  }
  if (d.length === 11) return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
  return doc.includes("*") ? doc : null;
}
