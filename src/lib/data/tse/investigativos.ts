/**
 * Sinais INVESTIGATIVOS da fonte TSE — padrões detectáveis por CRUZAMENTO de
 * dados (taxonomia em docs/qualidade-dados.md). Os dados estão corretos e
 * completos; o cruzamento aponta um padrão que merece verificação humana.
 * NUNCA é acusação — a exposição pública exige AvisoMetodologico.
 *
 * Este arquivo é PURO (constrói findings a partir de linhas já cruzadas);
 * as consultas/RPCs ficam em sinais.server.ts. Regras aqui saem SEMPRE com
 * tipo='investigativo' e fonte='tse-cruzamento' (teste automatizado garante).
 */
import type { QaFinding } from "@/lib/data/qa";

export const LIMIARES_INVESTIGATIVOS = {
  /** Doação mínima para gerar sinal doador_virou_fornecedor (corta ruído simbólico). */
  doacaoMinima: 1000,
  /** Multiplicador de crescimento patrimonial entre eleições. */
  evolucaoMultiplo: 10,
  /** Patrimônio final mínimo para o sinal de evolução (relevância absoluta). */
  evolucaoMinimoFinal: 500_000,
  /** Nº mínimo de candidatos atendidos pelo mesmo fornecedor no grupo partido×UF. */
  concentradoMinCandidatos: 10,
  /** Fração mínima do gasto do grupo concentrada no fornecedor. */
  concentradoFracaoMinima: 0.4,
} as const;

const BASE = {
  fonte: "tse-cruzamento",
  tipo: "investigativo",
  severidade: "aviso",
} as const;

export type DoacaoFornecedorCruzada = {
  cnpj: string;
  cnpjFormatado: string;
  nomeDoador: string | null;
  nomeFornecedor: string | null;
  sqCandidato: string;
  anoEleicao: number;
  valorDoado: number;
  dataDoacao: string | null;
  parlamentarTipo: string;
  parlamentarId: string;
  /** Contratos do mesmo CNPJ no cache de contratos. */
  contratos: Array<{ id: string; valor: number; dataAssinatura: string | null }>;
};

/** Meses entre a doação e a assinatura do contrato (negativo = contrato antes).
 * Extrai ano/mês direto do ISO para não depender de fuso horário. */
export function gapTemporalMeses(
  dataDoacao: string | null,
  dataContrato: string | null,
): number | null {
  const d = dataDoacao?.match(/^(\d{4})-(\d{2})/);
  const c = dataContrato?.match(/^(\d{4})-(\d{2})/);
  if (!d || !c) return null;
  return (Number(c[1]) - Number(d[1])) * 12 + (Number(c[2]) - Number(d[2]));
}

/**
 * doador_virou_fornecedor: CNPJ que doou para a campanha de um parlamentar
 * (via ponte) E aparece como fornecedor de contrato público. Um finding por
 * (cnpj, sq_candidato, ano) — os contratos vão nos detalhes.
 */
export function sinaisDoadorVirouFornecedor(cruzadas: DoacaoFornecedorCruzada[]): QaFinding[] {
  const out: QaFinding[] = [];
  const vistos = new Set<string>();
  for (const c of cruzadas) {
    if (c.valorDoado < LIMIARES_INVESTIGATIVOS.doacaoMinima) continue;
    if (c.contratos.length === 0) continue;
    const chave = `${c.cnpj}|${c.sqCandidato}|${c.anoEleicao}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    const maiorContrato = c.contratos.reduce((a, b) => (b.valor > a.valor ? b : a));
    out.push({
      ...BASE,
      entidade_tipo: "cruzamento_doador_fornecedor",
      entidade_id: chave.replace(/\|/g, "-"),
      regra: "doador_virou_fornecedor",
      detalhes: {
        cnpj: c.cnpj,
        cnpj_formatado: c.cnpjFormatado,
        nome_doador: c.nomeDoador,
        nome_fornecedor: c.nomeFornecedor,
        sq_candidato: c.sqCandidato,
        ano_eleicao: c.anoEleicao,
        valor_doado: c.valorDoado,
        valor_contrato: maiorContrato.valor,
        contrato_id: maiorContrato.id,
        contratos_total: c.contratos.length,
        gap_temporal_meses: gapTemporalMeses(c.dataDoacao, maiorContrato.dataAssinatura),
        parlamentar_tipo: c.parlamentarTipo,
        parlamentar_id: c.parlamentarId,
        motivo:
          "doação legal + contrato legítimo não é irregularidade por si só; o sinal aponta um padrão que merece verificação humana",
      },
    });
  }
  return out;
}

export type EvolucaoPatrimonial = {
  cpf: string;
  sqAnterior: string;
  anoAnterior: number;
  bensAnterior: number;
  sqRecente: string;
  anoRecente: number;
  bensRecente: number;
  nomeUrna: string | null;
  uf: string | null;
};

/** evolucao_patrimonial_atipica: crescimento de bens além do múltiplo configurado. */
export function sinaisEvolucaoPatrimonial(linhas: EvolucaoPatrimonial[]): QaFinding[] {
  return linhas.map((l) => ({
    ...BASE,
    entidade_tipo: "candidato",
    entidade_id: `${l.sqRecente}-${l.anoRecente}`,
    regra: "evolucao_patrimonial_atipica",
    valor_armazenado: l.bensRecente,
    valor_esperado: l.bensAnterior,
    detalhes: {
      cpf_mascarado: `***${l.cpf.slice(3, 9)}***`,
      nome_urna: l.nomeUrna,
      uf: l.uf,
      ano_anterior: l.anoAnterior,
      bens_anterior: l.bensAnterior,
      ano_recente: l.anoRecente,
      bens_recente: l.bensRecente,
      multiplo: l.bensAnterior > 0 ? l.bensRecente / l.bensAnterior : null,
      sq_anterior: l.sqAnterior,
      motivo:
        "declarações de bens são autodeclaradas ao TSE; crescimento atípico pode ter explicação legítima (herança, venda de empresa, correção de declaração)",
    },
  }));
}

export type FornecedorConcentrado = {
  cnpjFornecedor: string;
  nomeFornecedor: string | null;
  partido: string | null;
  uf: string | null;
  ano: number;
  candidatos: number;
  totalFornecedor: number;
  totalGrupo: number;
  fracao: number;
};

/** fornecedor_campanha_concentrado: fração alta do gasto de muitos candidatos do mesmo partido×UF. */
export function sinaisFornecedorConcentrado(linhas: FornecedorConcentrado[]): QaFinding[] {
  return linhas.map((l) => ({
    ...BASE,
    entidade_tipo: "fornecedor_campanha",
    entidade_id: `${l.cnpjFornecedor}-${l.ano}-${l.partido ?? "sp"}-${l.uf ?? "uf"}`,
    regra: "fornecedor_campanha_concentrado",
    valor_armazenado: l.totalFornecedor,
    detalhes: {
      cnpj: l.cnpjFornecedor,
      nome: l.nomeFornecedor,
      partido: l.partido,
      uf: l.uf,
      ano_eleicao: l.ano,
      candidatos_atendidos: l.candidatos,
      total_fornecedor: l.totalFornecedor,
      total_grupo: l.totalGrupo,
      fracao: l.fracao,
      motivo:
        "concentração pode refletir contrato coletivo legítimo do diretório; o sinal só aponta dependência incomum de um único fornecedor",
    },
  }));
}
