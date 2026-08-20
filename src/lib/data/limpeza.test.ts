import { describe, it, expect } from "vitest";
import { FONTES_LIMPEZA } from "./limpeza";

/**
 * Espelho estático de TODAS as tabelas `*_cache` do banco (fonte:
 * `src/integrations/supabase/types.ts`). Criou tabela de cache nova?
 * Este teste quebra até ela ganhar uma entrada (ou childTable) em
 * FONTES_LIMPEZA — sem controle de limpeza, dados importados viram
 * permanentes por acidente. Mesmo padrão do teste-guarda do catálogo
 * de sinais.
 */
const TABELAS_CACHE_DO_BANCO = [
  "camara_deputados_cache",
  "camara_despesas_cache",
  "camara_proposicoes_autores_cache",
  "camara_proposicoes_cache",
  "camara_votacoes_cache",
  "camara_votos_cache",
  "cgu_convenios_cache",
  "cgu_licitacoes_cache",
  "cgu_transferegov_emendas_cache",
  "contratos_cache",
  "fornecedores_cache",
  "ibge_municipios_cache",
  "orgaos_cache",
  "pncp_contratos_cache",
  "senado_despesas_cache",
  "senado_materias_autores_cache",
  "senado_materias_cache",
  "senado_senadores_cache",
  "senado_votacoes_cache",
  "senado_votos_cache",
  "siconfi_relatorios_cache",
  "transferegov_instrumentos_cache",
  "tse_bens_candidato_cache",
  "tse_candidatos_cache",
  "tse_despesas_campanha_cache",
  "tse_receitas_campanha_cache",
  "tse_resultados_cache",
] as const;

describe("limpeza/paridade com as tabelas de cache", () => {
  const cobertas = new Set<string>();
  for (const f of FONTES_LIMPEZA) {
    cobertas.add(f.table);
    if (f.childTable) cobertas.add(f.childTable);
  }

  it.each(TABELAS_CACHE_DO_BANCO)("%s tem controle de limpeza", (tabela) => {
    expect(cobertas.has(tabela)).toBe(true);
  });

  it("toda fonte de limpeza tem id e rótulo únicos", () => {
    const ids = FONTES_LIMPEZA.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    const labels = FONTES_LIMPEZA.map((f) => f.label);
    expect(new Set(labels).size).toBe(labels.length);
  });
});
