/**
 * Normalização das variáveis dos prompts do Kit.
 *
 * Cada `{{var}}` do template é definida em `prompt_modelos.variaveis` (jsonb),
 * carregando os próprios metadados — dica de preenchimento e link INTERNO para
 * onde colher o dado. NÃO há catálogo hardcoded aqui: quem edita dica/link é o
 * admin em /admin/prompts, por prompt. Assim o Kit acompanha os passos de cada
 * mapa (existentes e futuros) sem mudança de código.
 *
 * Esta camada só preenche defaults de exibição (rótulo humanizado, dica padrão)
 * e tolera o formato legado (array de strings) por segurança.
 */

/** Como a variável é definida no banco (jsonb) e editada no admin. */
export type VariavelDef = {
  nome: string;
  dica?: string | null;
  href?: string | null;
  hrefLabel?: string | null;
};

/** Como a variável chega pronta para a View (defaults preenchidos). */
export type VariavelInfo = {
  nome: string;
  rotulo: string;
  dica: string;
  href?: string;
  hrefLabel?: string;
};

function humanizar(nome: string): string {
  const s = nome.replace(/_/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Aceita string (legado) ou objeto; só links internos ("/rota") são mantidos. */
export function normalizarVariavel(v: VariavelDef | string): VariavelInfo {
  const def: VariavelDef = typeof v === "string" ? { nome: v } : v;
  const href = def.href?.trim();
  const hrefInterno = href && href.startsWith("/") ? href : undefined;
  return {
    nome: def.nome,
    rotulo: humanizar(def.nome),
    dica: def.dica?.trim() || "Preencha com a informação correspondente.",
    href: hrefInterno,
    hrefLabel: hrefInterno ? def.hrefLabel?.trim() || "Abrir" : undefined,
  };
}

export function descreverVariaveis(
  vars: ReadonlyArray<VariavelDef | string> | null | undefined,
): VariavelInfo[] {
  return (vars ?? []).map(normalizarVariavel);
}
