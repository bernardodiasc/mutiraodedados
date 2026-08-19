/**
 * Mapeamento dos datasets do TSE sobre a camada CKAN genérica
 * (`src/lib/data/ckan/client.ts`). Nomes de zip e de entrada CONFIRMADOS por
 * inspeção ao vivo do CDN (2026-07-06) — detalhes em docs/fontes/tse.ia.md.
 *
 * Regra de ouro da fonte: dados só entram no cache pelo CKAN (carga em massa);
 * a API DivulgaCandContas (client-api.ts) é só revalidação pontual.
 */

export const TSE_CKAN_BASE = "https://dadosabertos.tse.jus.br";
const CDN = "https://cdn.tse.jus.br/estatistica/sead/odsele";

export type TseTipoArquivo = "candidatos" | "bens" | "resultados" | "receitas" | "despesas";

/**
 * Eleições cobertas. O piso NÃO é o mesmo para todo tipo de arquivo — ver
 * `origemDisponivel`, que é quem sabe o que existe em cada (tipo, ano).
 *
 * O antigo piso de 2014 era conservador, não técnico: em 2026-08-08 baixamos
 * os cabeçalhos de 1998/2006/2012 do CDN e todos vêm no layout moderno, com as
 * 20 colunas que `mapearCandidato` lê e com CPF e título preenchidos. O TSE
 * republicou a série histórica inteira, não só de 2014 em diante.
 */
export const TSE_ANOS_ELEICAO = [
  1998, 2000, 2002, 2004, 2006, 2008, 2010, 2012, 2014, 2016, 2018, 2020, 2022, 2024, 2026,
] as const;

/** UFs + BR (cargos nacionais: presidente aparece como "BR"). */
export const TSE_UFS = [
  "AC",
  "AL",
  "AM",
  "AP",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MG",
  "MS",
  "MT",
  "PA",
  "PB",
  "PE",
  "PI",
  "PR",
  "RJ",
  "RN",
  "RO",
  "RR",
  "RS",
  "SC",
  "SE",
  "SP",
  "TO",
  "BR",
] as const;

/** Anos de eleições municipais (sem cargos federais/estaduais e sem "BR"). */
export function anoEleicaoMunicipal(ano: number): boolean {
  return ano % 4 === 0;
}

/** URL do zip no CDN do TSE para (tipo de arquivo, ano). */
export function urlZipTse(tipo: TseTipoArquivo, ano: number): string {
  switch (tipo) {
    case "candidatos":
      return `${CDN}/consulta_cand/consulta_cand_${ano}.zip`;
    case "bens":
      return `${CDN}/bem_candidato/bem_candidato_${ano}.zip`;
    case "resultados":
      return `${CDN}/votacao_candidato_munzona/votacao_candidato_munzona_${ano}.zip`;
    case "receitas":
    case "despesas":
      // 2012 e 2014 dividem o mesmo padrão legado (verificado no CDN).
      if (ano <= 2014) return `${CDN}/prestacao_contas/prestacao_final_${ano}.zip`;
      if (ano === 2016) return `${CDN}/prestacao_contas/prestacao_contas_final_2016.zip`;
      return `${CDN}/prestacao_contas/prestacao_de_contas_eleitorais_candidatos_${ano}.zip`;
  }
}

/**
 * Nome (trecho único) da entrada dentro do zip para (tipo, ano, uf).
 * 2014/2016 usam .txt e nomes legados; 2018+ usam .csv no padrão moderno.
 */
export function nomeEntradaTse(tipo: TseTipoArquivo, ano: number, uf: string): string {
  switch (tipo) {
    case "candidatos":
      return `consulta_cand_${ano}_${uf}.csv`;
    case "bens":
      return `bem_candidato_${ano}_${uf}.csv`;
    case "resultados":
      return `votacao_candidato_munzona_${ano}_${uf}.csv`;
    case "receitas":
      // 2012 e 2014: `receitas_candidatos_<ano>_<UF>.txt`, mesmo layout legado
      // de cabeçalhos humanos ("Sequencial Candidato", "Valor receita").
      if (ano <= 2014) return `receitas_candidatos_${ano}_${uf}.txt`;
      if (ano === 2016) return `receitas_candidatos_prestacao_contas_final_2016_${uf}.txt`;
      return `receitas_candidatos_${ano}_${uf}.csv`;
    case "despesas":
      if (ano <= 2014) return `despesas_candidatos_${ano}_${uf}.txt`;
      if (ano === 2016) return `despesas_candidatos_prestacao_contas_final_2016_${uf}.txt`;
      // "Contratadas" = compromissos assumidos (nossa tabela de despesas).
      return `despesas_contratadas_candidatos_${ano}_${uf}.csv`;
  }
}

/** Chave de retomada em `tse_varredura` (análoga a `montarVarreduraKey` da CGU). */
export function montarChaveTse(tipo: TseTipoArquivo, ano: number, uf: string): string {
  return `${tipo}#${ano}#${uf}`;
}

/**
 * Primeiro ano em que o TSE publica cada tipo de arquivo.
 *
 * Sondado no CDN em 2026-08-08, ano a ano. Não é o mesmo piso para todos: a
 * declaração de bens só passa a ser publicada em 2006, e a prestação de contas
 * em 2012. Candidatos e votação existem desde 1994 — paramos em 1998 porque é
 * o que a cobertura editorial declara; baixar para 1994 é mudar estes números.
 */
const ANO_INICIO_POR_TIPO: Record<TseTipoArquivo, number> = {
  candidatos: 1998, // existe desde 1994
  resultados: 1998, // existe desde 1994
  bens: 2006, // 1994–2004 dão 404 no CDN
  receitas: 2012, // prestacao_final_2012.zip é o mais antigo
  despesas: 2012,
};

/**
 * O TSE já publicou este (tipo, ano)?
 *
 * Duas bordas, e as duas dão 404 se ignoradas. Embaixo, o tipo pode ser mais
 * novo que a eleição (bens antes de 2006 não existem). Em cima, numa eleição
 * em curso os arquivos saem em etapas: candidatos e bens junto com o registro
 * das candidaturas, votação só depois da apuração, contas só na prestação
 * final.
 */
export function origemDisponivel(tipo: TseTipoArquivo, ano: number): boolean {
  if (ano < ANO_INICIO_POR_TIPO[tipo]) return false;
  if (ano < 2026) return true;
  // 2026 (verificado em 08/08/2026): candidatos e bens no ar e crescendo a cada
  // dia; votação existe mas só com cabeçalho (pleito em outubro); contas 404.
  return tipo === "candidatos" || tipo === "bens";
}

/** Primeiro ano publicado de um tipo — para explicar a indisponibilidade. */
export function anoInicioTipo(tipo: TseTipoArquivo): number {
  return ANO_INICIO_POR_TIPO[tipo];
}

/** Bens e resultados não existem para "BR" em eleições municipais etc. */
export function combinacaoValida(tipo: TseTipoArquivo, ano: number, uf: string): boolean {
  if (!origemDisponivel(tipo, ano)) return false;
  if (uf === "BR") {
    // "BR" só existe nas gerais (presidente) — e não em bens (bens são por UF do candidato? não: bens seguem a UE; presidente = BR existe).
    return !anoEleicaoMunicipal(ano);
  }
  return true;
}
