import { describe, it, expect } from "vitest";
import { FONTES_LIMPEZA, checkpointsALimpar } from "./limpeza";

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
  "convenios_cache",
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

/**
 * Chaves reais de checkpoint (lidas de `importacao_varredura` e
 * `cgu_varredura`) mais as dos formatos que o banco ainda não tinha. Limpar
 * uma fonte tem que zerar as dela — senão a janela continua "completa" sem
 * dados nem Histórico — e só as dela.
 */
const CHAVES_IMPORTACAO = [
  "pncp#2025-05-01#2025-05-31",
  "pncp#2026-01-01#2026-01-31",
  "transferegov#2025-12-01#2026-01-31",
  "transferegov#2026-02-01#2026-02-28#uf=SP",
  "convenios_origem#csv",
  "camara_vot#2025-08-01#2025-08-31",
  "camara_vot#2026-08-01#2026-08-31",
  "senado_vot#2026-01-01#2026-01-31",
  "camara_ceap#2025#12",
  "camara_ceap#2026#01#204554",
  "senado_ceaps#2026#02",
  "camara_props#2025#PEC",
  "senado_mat#2024#PL",
  "senado_mat#2026#PL",
  "ibge#municipios",
  "siconfi_varredura#ente#2025-2025#3550308",
  "siconfi_varredura#municipios#2023-2024#SP",
  "orgaos_siafi#nomes",
  "orgaos_siafi#atividade",
];
const CHAVES_CGU = [
  "20101",
  "26000#2025-01-01#2025-12-31",
  "licitacoes#20101#2026-01-20#2026-07-31",
  "emendas#2025",
  "emendas#2026",
  "convenios#geral#2026-01-01#2026-07-31",
];

const limpar = (id: string, periodo?: { anoIni: number; anoFim: number }) => ({
  importacao_varredura: checkpointsALimpar(id, "importacao_varredura", CHAVES_IMPORTACAO, periodo),
  cgu_varredura: checkpointsALimpar(id, "cgu_varredura", CHAVES_CGU, periodo),
});

describe("limpeza/checkpoints de varredura", () => {
  it("limpar votações da Câmara remove só os checkpoints delas", () => {
    expect(limpar("camara_vot")).toEqual({
      importacao_varredura: [
        "camara_vot#2025-08-01#2025-08-31",
        "camara_vot#2026-08-01#2026-08-31",
      ],
      cgu_varredura: [],
    });
  });

  it("limpar contratos da CGU remove só as chaves legadas por órgão, não as das outras varreduras CGU", () => {
    expect(limpar("cgu")).toEqual({
      importacao_varredura: [],
      cgu_varredura: ["20101", "26000#2025-01-01#2025-12-31"],
    });
  });

  it("limpar a tabela única de convênios remove os checkpoints dos dois ids e do CSV da origem", () => {
    expect(limpar("convenios")).toEqual({
      importacao_varredura: [
        "transferegov#2025-12-01#2026-01-31",
        "transferegov#2026-02-01#2026-02-28#uf=SP",
        "convenios_origem#csv",
      ],
      cgu_varredura: ["convenios#geral#2026-01-01#2026-07-31"],
    });
  });

  it.each([
    ["cgu_licitacoes", [], ["licitacoes#20101#2026-01-20#2026-07-31"]],
    ["cgu_emendas", [], ["emendas#2025", "emendas#2026"]],
    ["pncp", ["pncp#2025-05-01#2025-05-31", "pncp#2026-01-01#2026-01-31"], []],
    ["camara_ceap", ["camara_ceap#2025#12", "camara_ceap#2026#01#204554"], []],
    ["senado_ceaps", ["senado_ceaps#2026#02"], []],
    ["senado_vot", ["senado_vot#2026-01-01#2026-01-31"], []],
    ["camara_props", ["camara_props#2025#PEC"], []],
    ["senado_mat", ["senado_mat#2024#PL", "senado_mat#2026#PL"], []],
    ["ibge", ["ibge#municipios"], []],
    [
      "siconfi",
      ["siconfi_varredura#ente#2025-2025#3550308", "siconfi_varredura#municipios#2023-2024#SP"],
      [],
    ],
    ["orgaos", ["orgaos_siafi#nomes", "orgaos_siafi#atividade"], []],
    ["fornecedores", [], []],
    ["tse_candidatos", [], []],
  ])("limpar %s remove só os checkpoints da fonte", (id, importacao, cgu) => {
    expect(limpar(id)).toEqual({ importacao_varredura: importacao, cgu_varredura: cgu });
  });

  it("limpeza por ano remove só os checkpoints de janelas que tocam o período", () => {
    const p2026 = { anoIni: 2026, anoFim: 2026 };
    expect(limpar("pncp", p2026).importacao_varredura).toEqual(["pncp#2026-01-01#2026-01-31"]);
    expect(limpar("camara_ceap", p2026).importacao_varredura).toEqual([
      "camara_ceap#2026#01#204554",
    ]);
    expect(limpar("cgu_emendas", p2026).cgu_varredura).toEqual(["emendas#2026"]);
    expect(limpar("siconfi", { anoIni: 2024, anoFim: 2024 }).importacao_varredura).toEqual([
      "siconfi_varredura#municipios#2023-2024#SP",
    ]);
    // Janela que atravessa a virada do ano pertence aos dois anos.
    expect(limpar("convenios", { anoIni: 2025, anoFim: 2025 })).toEqual({
      importacao_varredura: ["transferegov#2025-12-01#2026-01-31", "convenios_origem#csv"],
      cgu_varredura: [],
    });
  });

  it("limpeza por ano apaga a chave sem período, que cobre todos os anos", () => {
    expect(limpar("cgu", { anoIni: 2025, anoFim: 2025 }).cgu_varredura).toEqual([
      "20101",
      "26000#2025-01-01#2025-12-31",
    ]);
    expect(limpar("cgu", { anoIni: 2026, anoFim: 2026 }).cgu_varredura).toEqual(["20101"]);
    expect(limpar("ibge", { anoIni: 2025, anoFim: 2025 }).importacao_varredura).toEqual([
      "ibge#municipios",
    ]);
  });
});
