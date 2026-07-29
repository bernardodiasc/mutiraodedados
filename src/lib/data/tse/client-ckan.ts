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

export const TSE_ANOS_ELEICAO = [2014, 2016, 2018, 2020, 2022, 2024] as const;

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
      if (ano === 2014) return `${CDN}/prestacao_contas/prestacao_final_2014.zip`;
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
      if (ano === 2014) return `receitas_candidatos_2014_${uf}.txt`;
      if (ano === 2016) return `receitas_candidatos_prestacao_contas_final_2016_${uf}.txt`;
      return `receitas_candidatos_${ano}_${uf}.csv`;
    case "despesas":
      if (ano === 2014) return `despesas_candidatos_2014_${uf}.txt`;
      if (ano === 2016) return `despesas_candidatos_prestacao_contas_final_2016_${uf}.txt`;
      // "Contratadas" = compromissos assumidos (nossa tabela de despesas).
      return `despesas_contratadas_candidatos_${ano}_${uf}.csv`;
  }
}

/** Chave de retomada em `tse_varredura` (análoga a `montarVarreduraKey` da CGU). */
export function montarChaveTse(tipo: TseTipoArquivo, ano: number, uf: string): string {
  return `${tipo}#${ano}#${uf}`;
}

/** Bens e resultados não existem para "BR" em eleições municipais etc. */
export function combinacaoValida(tipo: TseTipoArquivo, ano: number, uf: string): boolean {
  if (uf === "BR") {
    // "BR" só existe nas gerais (presidente) — e não em bens (bens são por UF do candidato? não: bens seguem a UE; presidente = BR existe).
    return !anoEleicaoMunicipal(ano);
  }
  return true;
}
