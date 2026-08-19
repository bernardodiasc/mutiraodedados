/**
 * Runners dos sinais da fonte TSE (lacunas + investigativos) — server-only.
 * As regras (puras) vivem em lacunas.ts e investigativos.ts; aqui ficam as
 * consultas (RPCs SQL para as agregações pesadas) e a persistência via flagQA.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { flagQA } from "@/lib/data/qa";
import { buscarCandidatoDivulga } from "@/lib/data/tse/client-api";
import {
  LIMIARES_INVESTIGATIVOS,
  sinaisDoadorVirouFornecedor,
  sinaisEvolucaoPatrimonial,
  sinaisFornecedorConcentrado,
  type DoacaoFornecedorCruzada,
} from "@/lib/data/tse/investigativos";
import {
  lacunasCandidatoSemBens,
  lacunasEleitoSemContas,
  lacunasParlamentarSemMatch,
  lacunasSerieHistorica,
  type EleitoSemContas,
  type SerieAnoUf,
} from "@/lib/data/tse/lacunas";
import { TSE_UFS, anoEleicaoMunicipal } from "@/lib/data/tse/client-ckan";

export type SinaisRodada = {
  regra: string;
  candidatosAvaliados: number;
  findingsGerados: number;
  avisos: string[];
};

// ---------------------------------------------------------------------------
// Investigativos
// ---------------------------------------------------------------------------

/**
 * doador_virou_fornecedor: cruza doações (≥ threshold) de CNPJs que também são
 * fornecedores com os contratos desses CNPJs no cache. Roda em lote (backfill
 * e re-execução); o mesmo runner serve ao gatilho incremental pós-importação.
 */
export async function rodarDoadorVirouFornecedor(): Promise<SinaisRodada> {
  const avisos: string[] = [];
  const { data: doacoes, error } = await supabaseAdmin.rpc("tse_doacoes_de_fornecedores", {
    _minimo: LIMIARES_INVESTIGATIVOS.doacaoMinima,
  });
  if (error) throw new Error(`tse_doacoes_de_fornecedores: ${error.message}`);
  const linhas = doacoes ?? [];

  // Contratos por CNPJ formatado (é assim que contratos_cache guarda).
  const cnpjsFormatados = [...new Set(linhas.map((d) => d.cnpj_formatado))];
  const contratosPorCnpj = new Map<
    string,
    Array<{ id: string; valor: number; dataAssinatura: string | null }>
  >();
  const LOTE = 100;
  for (let i = 0; i < cnpjsFormatados.length; i += LOTE) {
    const slice = cnpjsFormatados.slice(i, i + LOTE);
    const { data: contratos, error: cErr } = await supabaseAdmin
      .from("contratos_cache")
      .select("id, fornecedor_cnpj, valor, data_assinatura")
      .in("fornecedor_cnpj", slice);
    if (cErr) {
      avisos.push(`contratos_cache: ${cErr.message}`);
      break;
    }
    for (const c of contratos ?? []) {
      const lista = contratosPorCnpj.get(c.fornecedor_cnpj) ?? [];
      lista.push({
        id: String(c.id),
        valor: Number(c.valor ?? 0),
        dataAssinatura: c.data_assinatura,
      });
      contratosPorCnpj.set(c.fornecedor_cnpj, lista);
    }
  }

  const cruzadas: DoacaoFornecedorCruzada[] = linhas.map((d) => ({
    cnpj: d.cnpj,
    cnpjFormatado: d.cnpj_formatado,
    nomeDoador: d.nome_doador,
    nomeFornecedor: d.nome_fornecedor,
    sqCandidato: d.sq_candidato,
    anoEleicao: d.ano_eleicao,
    valorDoado: Number(d.valor_doado ?? 0),
    dataDoacao: d.data_doacao,
    parlamentarTipo: d.parlamentar_tipo,
    parlamentarId: d.parlamentar_id,
    contratos: contratosPorCnpj.get(d.cnpj_formatado) ?? [],
  }));

  const findings = sinaisDoadorVirouFornecedor(cruzadas);
  const inseridos = await flagQA(findings);
  return {
    regra: "doador_virou_fornecedor",
    candidatosAvaliados: linhas.length,
    findingsGerados: inseridos,
    avisos,
  };
}

export async function rodarEvolucaoPatrimonial(): Promise<SinaisRodada> {
  const { data, error } = await supabaseAdmin.rpc("tse_evolucao_patrimonial", {
    _multiplo: LIMIARES_INVESTIGATIVOS.evolucaoMultiplo,
    _minimo_final: LIMIARES_INVESTIGATIVOS.evolucaoMinimoFinal,
  });
  if (error) throw new Error(`tse_evolucao_patrimonial: ${error.message}`);
  const findings = sinaisEvolucaoPatrimonial(
    (data ?? []).map((l) => ({
      cpf: l.cpf,
      sqAnterior: l.sq_anterior,
      anoAnterior: l.ano_anterior,
      bensAnterior: Number(l.bens_anterior ?? 0),
      sqRecente: l.sq_recente,
      anoRecente: l.ano_recente,
      bensRecente: Number(l.bens_recente ?? 0),
      nomeUrna: l.nome_urna,
      uf: l.uf,
    })),
  );
  const inseridos = await flagQA(findings);
  return {
    regra: "evolucao_patrimonial_atipica",
    candidatosAvaliados: (data ?? []).length,
    findingsGerados: inseridos,
    avisos: [],
  };
}

export async function rodarFornecedorConcentrado(ano: number): Promise<SinaisRodada> {
  const { data, error } = await supabaseAdmin.rpc("tse_fornecedor_concentrado", {
    _ano: ano,
    _min_candidatos: LIMIARES_INVESTIGATIVOS.concentradoMinCandidatos,
    _fracao_minima: LIMIARES_INVESTIGATIVOS.concentradoFracaoMinima,
  });
  if (error) throw new Error(`tse_fornecedor_concentrado: ${error.message}`);
  const findings = sinaisFornecedorConcentrado(
    (data ?? []).map((l) => ({
      cnpjFornecedor: l.cnpj_fornecedor,
      nomeFornecedor: l.nome_fornecedor,
      partido: l.partido_sigla,
      uf: l.uf,
      ano,
      candidatos: Number(l.candidatos ?? 0),
      totalFornecedor: Number(l.total_fornecedor ?? 0),
      totalGrupo: Number(l.total_grupo ?? 0),
      fracao: Number(l.fracao ?? 0),
    })),
  );
  const inseridos = await flagQA(findings);
  return {
    regra: "fornecedor_campanha_concentrado",
    candidatosAvaliados: (data ?? []).length,
    findingsGerados: inseridos,
    avisos: [],
  };
}

// ---------------------------------------------------------------------------
// Lacunas (pós-importação)
// ---------------------------------------------------------------------------

/**
 * eleito_sem_prestacao_contas — confirma cada caso na API DivulgaCandContas
 * ANTES de gravar (plano, Fase 3.B). `maxConfirmacoes` limita o custo por
 * rodada; rode de novo para continuar.
 */
export async function rodarEleitosSemContas(
  ano: number,
  maxConfirmacoes = 60,
): Promise<SinaisRodada> {
  const avisos: string[] = [];
  const { data, error } = await supabaseAdmin.rpc("tse_eleitos_sem_contas", { _ano: ano });
  if (error) throw new Error(`tse_eleitos_sem_contas: ${error.message}`);
  const candidatos = data ?? [];

  const confirmados: EleitoSemContas[] = [];
  for (const c of candidatos.slice(0, maxConfirmacoes)) {
    let gasto: number | null = null;
    try {
      const api = await buscarCandidatoDivulga(ano, c.municipio_cod ?? c.uf ?? "", c.sq_candidato);
      gasto = api?.gastoCampanha1T ?? null;
    } catch (e) {
      avisos.push(`API ${c.sq_candidato}: ${(e as Error).message}`);
      continue; // sem confirmação da API, não publica
    }
    confirmados.push({
      sqCandidato: c.sq_candidato,
      ano,
      uf: c.uf,
      nomeUrna: c.nome_urna,
      cargoNome: c.cargo_nome,
      gastoNaApi: gasto,
    });
    await new Promise((r) => setTimeout(r, 120));
  }
  const inseridos = await flagQA(lacunasEleitoSemContas(confirmados));
  if (candidatos.length > maxConfirmacoes) {
    avisos.push(
      `info: ${candidatos.length - maxConfirmacoes} eleitos ainda por confirmar na API — rode novamente.`,
    );
  }
  return {
    regra: "eleito_sem_prestacao_contas",
    candidatosAvaliados: candidatos.length,
    findingsGerados: inseridos,
    avisos,
  };
}

/** candidato_sem_bens roda por padrão; o flag permite desligar pontualmente
 * (ex.: ano em que declaração 'sem bens' não gera registro no CSV). */
export async function rodarCandidatosSemBens(ano: number, ativar: boolean): Promise<SinaisRodada> {
  if (!ativar) {
    return {
      regra: "candidato_sem_bens",
      candidatosAvaliados: 0,
      findingsGerados: 0,
      avisos: ["regra desligada nesta execução (ativarCandidatoSemBens=false)"],
    };
  }
  const { data, error } = await supabaseAdmin.rpc("tse_candidatos_sem_bens", { _ano: ano });
  if (error) throw new Error(`tse_candidatos_sem_bens: ${error.message}`);
  const inseridos = await flagQA(
    lacunasCandidatoSemBens(
      (data ?? []).map((c) => ({
        sqCandidato: c.sq_candidato,
        ano,
        uf: c.uf,
        nomeUrna: c.nome_urna,
        cargoNome: c.cargo_nome,
      })),
    ),
  );
  return {
    regra: "candidato_sem_bens",
    candidatosAvaliados: (data ?? []).length,
    findingsGerados: inseridos,
    avisos: [],
  };
}

export async function rodarSerieHistorica(): Promise<SinaisRodada> {
  const [{ data: contagens, error }, { data: varreduras }] = await Promise.all([
    supabaseAdmin.rpc("tse_contagem_ano_uf"),
    supabaseAdmin.from("tse_varredura").select("chave, completa").like("chave", "candidatos#%"),
  ]);
  if (error) throw new Error(`tse_contagem_ano_uf: ${error.message}`);
  const contagemPorChave = new Map(
    (contagens ?? []).map((c) => [`${c.ano_eleicao}#${c.uf}`, Number(c.candidatos)]),
  );
  const varreduraPorChave = new Map(
    (varreduras ?? []).map((v) => [
      v.chave.replace(/^candidatos#/, "").replace("#", "#"),
      v.completa,
    ]),
  );
  const anosImportados = [...new Set((contagens ?? []).map((c) => c.ano_eleicao))];

  const series: SerieAnoUf[] = [];
  for (const ano of anosImportados) {
    for (const uf of TSE_UFS) {
      if (uf === "BR" && anoEleicaoMunicipal(ano)) continue;
      const chaveVar = `${ano}#${uf}`;
      series.push({
        ano,
        uf,
        candidatos: contagemPorChave.get(`${ano}#${uf}`) ?? 0,
        varreduraCompleta: varreduraPorChave.get(chaveVar) === true,
        varreduraIniciada: varreduraPorChave.has(chaveVar),
      });
    }
  }
  const inseridos = await flagQA(lacunasSerieHistorica(series));
  return {
    regra: "serie_historica_incompleta",
    candidatosAvaliados: series.length,
    findingsGerados: inseridos,
    avisos: [],
  };
}

export async function rodarParlamentarSemMatch(): Promise<SinaisRodada> {
  const [{ data: deps }, { data: sens }, { data: ponte }] = await Promise.all([
    supabaseAdmin.from("camara_deputados_cache").select("id, nome").limit(2000),
    supabaseAdmin.from("senado_senadores_cache").select("codigo_parlamentar, nome").limit(500),
    supabaseAdmin
      .from("tse_parlamentar_candidato")
      .select("parlamentar_tipo, parlamentar_id")
      .limit(100000),
  ]);
  const vinculados = new Set((ponte ?? []).map((p) => `${p.parlamentar_tipo}-${p.parlamentar_id}`));
  const semMatch = [
    ...(deps ?? [])
      .filter((d) => !vinculados.has(`deputado-${d.id}`))
      .map((d) => ({ tipo: "deputado" as const, id: String(d.id), nome: d.nome })),
    ...(sens ?? [])
      .filter((s) => !vinculados.has(`senador-${s.codigo_parlamentar}`))
      .map((s) => ({ tipo: "senador" as const, id: String(s.codigo_parlamentar), nome: s.nome })),
  ];
  // Sem ponte NENHUMA, o sinal seria só ruído (matcher nunca rodou).
  if (vinculados.size === 0) {
    return {
      regra: "parlamentar_sem_match",
      candidatosAvaliados: 0,
      findingsGerados: 0,
      avisos: ["ponte vazia — rode primeiro o vínculo parlamentar↔candidato"],
    };
  }
  const inseridos = await flagQA(lacunasParlamentarSemMatch(semMatch));
  return {
    regra: "parlamentar_sem_match",
    candidatosAvaliados: semMatch.length,
    findingsGerados: inseridos,
    avisos: [],
  };
}
