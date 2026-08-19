/**
 * LACUNAS da fonte TSE — ausências detectáveis: algo que deveria existir
 * segundo a regra de negócio/lei mas não é encontrado na fonte (taxonomia em
 * docs/qualidade-dados.md). Rodam PÓS-importação (a ausência só é detectável
 * com o conjunto carregado). Este arquivo é puro; consultas em sinais.server.ts.
 */
import type { QaFinding } from "@/lib/data/qa";

export type EleitoSemContas = {
  sqCandidato: string;
  ano: number;
  uf: string | null;
  nomeUrna: string | null;
  cargoNome: string | null;
  /** Gasto informado pela API DivulgaCandContas na confirmação (null = sem contas lá também). */
  gastoNaApi: number | null;
};

/**
 * eleito_sem_prestacao_contas: todo eleito é obrigado a prestar contas finais.
 * Se a API também não mostra gasto → lacuna na origem. Se a API mostra gasto
 * que não temos → falha da NOSSA importação (tipo qualidade, para reimportar).
 */
export function lacunasEleitoSemContas(linhas: EleitoSemContas[]): QaFinding[] {
  return linhas.map((l) => {
    const faltaNaOrigem = l.gastoNaApi == null || l.gastoNaApi === 0;
    return {
      fonte: "tse" as const,
      entidade_tipo: "candidato",
      entidade_id: `${l.sqCandidato}-${l.ano}`,
      regra: "eleito_sem_prestacao_contas",
      tipo: faltaNaOrigem ? ("lacuna" as const) : ("qualidade" as const),
      severidade: "aviso" as const,
      detalhes: {
        sq_candidato: l.sqCandidato,
        ano_eleicao: l.ano,
        uf: l.uf,
        nome_urna: l.nomeUrna,
        cargo: l.cargoNome,
        gasto_na_api: l.gastoNaApi,
        causa: faltaNaOrigem ? "ausencia_na_origem" : "importacao_incompleta",
        motivo: faltaNaOrigem
          ? "candidato eleito sem nenhuma receita/despesa na prestação de contas — a lei exige prestação final"
          : "a API DivulgaCandContas mostra gasto de campanha que não está no nosso cache — reimportar receitas/despesas deste (ano, UF)",
      },
    };
  });
}

export type CandidatoSemBens = {
  sqCandidato: string;
  ano: number;
  uf: string | null;
  nomeUrna: string | null;
  cargoNome: string | null;
};

/**
 * candidato_sem_bens: a declaração de bens é obrigatória no registro — mesmo
 * "sem bens" gera registro; ausência total é lacuna. Roda por padrão; o flag
 * do runner permite desligar pontualmente num ano em que a declaração
 * "sem bens" comprovadamente não gera linha no CSV.
 */
export function lacunasCandidatoSemBens(linhas: CandidatoSemBens[]): QaFinding[] {
  return linhas.map((l) => ({
    fonte: "tse" as const,
    entidade_tipo: "candidato",
    entidade_id: `${l.sqCandidato}-${l.ano}`,
    regra: "candidato_sem_bens",
    tipo: "lacuna" as const,
    severidade: "info" as const,
    detalhes: {
      sq_candidato: l.sqCandidato,
      ano_eleicao: l.ano,
      uf: l.uf,
      nome_urna: l.nomeUrna,
      cargo: l.cargoNome,
    },
  }));
}

export type SerieAnoUf = {
  ano: number;
  uf: string;
  candidatos: number;
  /** Estado da varredura de candidatos desse (ano, uf). */
  varreduraCompleta: boolean;
  varreduraIniciada: boolean;
};

/**
 * serie_historica_incompleta: (ano, UF) esperado sem registros. Distingue:
 * varredura incompleta/não iniciada = falha NOSSA (tipo qualidade, reimportar);
 * varredura completa com zero candidatos = ausência na origem (lacuna).
 * Só considera anos em que alguma UF já foi importada (senão é só backlog).
 */
export function lacunasSerieHistorica(series: SerieAnoUf[]): QaFinding[] {
  const anosAtivos = new Set(series.filter((s) => s.candidatos > 0).map((s) => s.ano));
  const out: QaFinding[] = [];
  for (const s of series) {
    if (!anosAtivos.has(s.ano) || s.candidatos > 0) continue;
    const nossaFalha = !s.varreduraCompleta;
    out.push({
      fonte: "tse",
      entidade_tipo: "serie",
      entidade_id: `candidatos-${s.ano}-${s.uf}`,
      regra: "serie_historica_incompleta",
      tipo: nossaFalha ? "qualidade" : "lacuna",
      severidade: nossaFalha ? "aviso" : "info",
      detalhes: {
        ano_eleicao: s.ano,
        uf: s.uf,
        causa: nossaFalha ? "importacao_incompleta" : "ausencia_na_origem",
        varredura_iniciada: s.varreduraIniciada,
        motivo: nossaFalha
          ? "UF sem candidatos no cache e varredura incompleta — reimportar este (ano, UF)"
          : "varredura completa e mesmo assim zero candidatos — ausência na própria origem",
      },
    });
  }
  return out;
}

export type ParlamentarSemMatch = {
  tipo: "deputado" | "senador";
  id: string;
  nome: string;
};

/**
 * parlamentar_sem_match: parlamentar em exercício sem nenhuma candidatura na
 * ponte — impossível (todo parlamentar se elegeu); ou faltam anos no cache ou
 * o matcher não encontrou (nome divergente).
 */
export function lacunasParlamentarSemMatch(linhas: ParlamentarSemMatch[]): QaFinding[] {
  return linhas.map((l) => ({
    fonte: "tse" as const,
    entidade_tipo: "ponte_parlamentar",
    entidade_id: `${l.tipo}-${l.id}`,
    regra: "parlamentar_sem_match",
    tipo: "lacuna" as const,
    severidade: "aviso" as const,
    detalhes: {
      parlamentar_tipo: l.tipo,
      parlamentar_id: l.id,
      nome: l.nome,
      motivo:
        "todo parlamentar em exercício se elegeu — a ausência de candidatura vinculada indica ano não importado ou nome divergente no matcher",
    },
  }));
}
