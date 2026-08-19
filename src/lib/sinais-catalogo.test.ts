import { describe, expect, it } from "vitest";
import {
  FONTES_QA_CATALOGO,
  REGRA_LABEL_MEMORIA,
  REGRAS_PERSISTIDAS,
  SINAIS_CATALOGO,
  labelDaRegra,
  sinaisPorFonte,
  sinaisPorTipo,
} from "@/lib/sinais-catalogo";

// Espelho estático de todas as regras que o CÓDIGO emite hoje (qa.ts,
// tse/{qualidade,lacunas,investigativos}.ts, ponte/revalidação, anomalias.ts).
// Se você criar uma regra nova e este teste falhar, adicione a entrada no
// catálogo — é assim que os boxes públicos ficam completos.
const REGRAS_EMITIDAS_PELO_CODIGO = [
  // qa.ts
  "valor_corrigido_listagem",
  "fornecedor_ausente",
  "discrepancia_extrema_inicial_final",
  "valor_muito_baixo",
  "licitacao_sem_desfecho",
  "data_abertura_ausente",
  "ano_invalido",
  "valor_negativo",
  "valor_truncado_suspeito",
  "pago_maior_empenhado",
  "liquidado_maior_empenhado",
  "liberado_maior_global",
  "repasse_maior_global",
  "valor_global_menor_inicial",
  "valor_global_zerado",
  "liquido_maior_documento",
  "valor_negativo_em_conta_positiva",
  // tse/qualidade.ts + ponte + revalidação
  "duplicata_importacao",
  "encoding_suspeito",
  "sentinela_nao_tratada",
  "valor_invalido",
  "data_impossivel",
  "cpf_cnpj_invalido",
  "ponte_baixa_confianca",
  "divergencia_api_csv",
  // tse/lacunas.ts
  "eleito_sem_prestacao_contas",
  "candidato_sem_bens",
  "serie_historica_incompleta",
  "parlamentar_sem_match",
  // tse/investigativos.ts
  "doador_virou_fornecedor",
  "evolucao_patrimonial_atipica",
  "fornecedor_campanha_concentrado",
  // anomalias.ts (em memória)
  "crescimento_abrupto",
  "fracionamento",
  "concentracao",
  "outlier_valor",
  "fornecedor_recente_alto",
  "descricao_generica",
  "dispensa_recorrente",
  "crescimento_orgao",
  "transparencia_baixa",
];

describe("SINAIS_CATALOGO — invariantes", () => {
  it("toda regra emitida pelo código tem entrada ativa no catálogo", () => {
    const slugsAtivos = new Set(SINAIS_CATALOGO.filter((s) => s.ativa).map((s) => s.slug));
    for (const slug of REGRAS_EMITIDAS_PELO_CODIGO) {
      expect(slugsAtivos, `regra sem entrada no catálogo: ${slug}`).toContain(slug);
    }
  });

  it("não há entradas duplicadas (slug + fontes)", () => {
    const chaves = SINAIS_CATALOGO.map((s) => `${s.slug}|${s.fontes.join(",")}`);
    expect(new Set(chaves).size).toBe(chaves.length);
  });

  it("todo sinal tem tipo válido e pelo menos uma fonte", () => {
    for (const s of SINAIS_CATALOGO) {
      expect(["qualidade", "lacuna", "investigativo"]).toContain(s.tipo);
      expect(s.fontes.length).toBeGreaterThan(0);
      expect(s.oQueDetecta.length).toBeGreaterThan(10);
      expect(s.limiares.length).toBeGreaterThan(0);
    }
  });

  it("as 9 regras em memória de /anomalias estão presentes (incl. transparencia_baixa)", () => {
    expect(Object.keys(REGRA_LABEL_MEMORIA)).toHaveLength(9);
    expect(REGRA_LABEL_MEMORIA.transparencia_baixa).toBeTruthy();
  });

  it("os 3 investigativos persistidos do TSE estão presentes", () => {
    const tseCruz = sinaisPorFonte("tse-cruzamento").map((s) => s.slug);
    expect(tseCruz.sort()).toEqual([
      "doador_virou_fornecedor",
      "evolucao_patrimonial_atipica",
      "fornecedor_campanha_concentrado",
    ]);
  });

  it("as 4 lacunas do TSE estão presentes", () => {
    const lacunas = sinaisPorTipo("lacuna").map((s) => s.slug);
    expect(lacunas.sort()).toEqual([
      "candidato_sem_bens",
      "eleito_sem_prestacao_contas",
      "parlamentar_sem_match",
      "serie_historica_incompleta",
    ]);
  });

  it("FONTES_QA_CATALOGO cobre todas as fontes persistidas, incluindo TSE", () => {
    for (const f of ["cgu", "cgu_licitacoes", "cgu_emendas", "cgu_convenios", "tse", "tse-cruzamento"]) {
      expect(FONTES_QA_CATALOGO).toContain(f);
    }
    // Regras em memória não entram no filtro de fontes persistidas.
    expect(FONTES_QA_CATALOGO).not.toContain("contratos");
  });

  it("REGRAS_PERSISTIDAS inclui as aposentadas (podem existir no banco)", () => {
    expect(REGRAS_PERSISTIDAS).toContain("possivel_ponto_fixo");
    expect(REGRAS_PERSISTIDAS).toContain("valor_corrigido_listagem");
    expect(REGRAS_PERSISTIDAS).not.toContain("fracionamento"); // memória
  });

  it("labelDaRegra cai no slug quando desconhecida", () => {
    expect(labelDaRegra("doador_virou_fornecedor")).toBe("Doador que virou fornecedor");
    expect(labelDaRegra("inexistente_xyz")).toBe("inexistente_xyz");
  });
});
