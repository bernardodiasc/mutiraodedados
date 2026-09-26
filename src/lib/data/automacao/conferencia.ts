/**
 * Conferência de uma janela importada pela ferramenta — a parte pura.
 *
 * Uma EXECUÇÃO (todas as rodadas de um `execucao_id`) importa uma janela. A
 * conferência é o veredito sobre a janela inteira: calculado pela rota na
 * última rodada (`haMais: false`), gravado em `importacoes.conferencia` na
 * linha dessa rodada e devolvido na resposta. A leitura do banco e a gravação
 * ficam em `conferencia.server.ts`.
 *
 * Checagens:
 * - **Terminou** — a janela chegou ao fim (`haMais: false`).
 * - **Log limpo** — nenhuma rodada da execução com erro; avisos `info:` à
 *   parte, como no Histórico.
 * - **Contagem** — acumulado da janela > 0, ou vazio com resultado legítimo.
 *   Onde a origem informa o total, acumulado + descartados = total, exato.
 *   Onde não informa, a comparação não se aplica (e não pesa contra).
 * - **Reflexo na cobertura** — a célula da janela tem registros ou, se a
 *   janela veio vazia, uma rodada ancorada nela com resultado sem erro. Fonte
 *   sem célula mensal: basta a contagem > 0.
 * - **Findings** — só informa quantos sinais novos a janela gerou.
 *
 * **Conferência mínima.** As tarefas de cruzamento (lacunas e sinais do TSE,
 * doador↔fornecedor) não trazem registros de uma origem: cruzam o que já está
 * no banco. Nelas só valem "terminou" e "log limpo"; contagem e reflexo na
 * cobertura ficam como "não se aplica", e os findings novos vão no motivo.
 *
 * Estados: reprovada (falha nossa, contagem divergente em janela fechada,
 * zero onde a origem diz que há registros, cobertura não refletida, janela
 * sem fim) vence inconclusiva (falha da origem depois das novas tentativas,
 * divergência em janela recente), que vence aprovada. Com falha da origem no
 * log, contagem ou cobertura em falta viram inconclusiva: a falha as explica.
 *
 * **Conferência sem reimportação.** Janela que a varredura já dá como
 * completa, mas ainda sem conferência aprovada (ex.: importada pelo painel),
 * é conferida sem baixar tudo de novo: acumulado do checkpoint, uma chamada à
 * origem para o total e as rodadas antigas da janela — que não têm
 * `execucao_id` e são achadas por fonte + ano/mês, como a cobertura casa as
 * tentativas. Nesse modo o log limpo é mais frouxo: vale só a última rodada
 * da janela (a que a completou), porque as antigas misturam varreduras
 * refeitas e tentativas já superadas. Item perdido numa rodada anterior
 * continua aparecendo, só que na contagem contra a origem. Janela vazia que a
 * origem confirma vazia agora está refletida (a linha da conferência ancora a
 * célula). Sem nenhuma rodada da janela no Histórico, o vazio sem explicação e
 * a cobertura não refletida viram inconclusiva: falta evidência, não há
 * defeito — reimportar é o remédio.
 *
 * Também aqui: quais janelas de uma fonte estão PENDENTES — dentro da janela
 * de disponibilidade e sem a última conferência aprovada.
 */
import {
  dentroDaJanela,
  dentroDaJanelaAnual,
  ANO_INICIO_POR_FONTE,
  type FonteJanela,
} from "@/lib/data/janelas";

export type EstadoConferencia = "aprovada" | "inconclusiva" | "reprovada";

/**
 * O veredito gravado em `importacoes.conferencia` (jsonb). `estado` e
 * `motivo` são o contrato mínimo de quem lê (o Histórico); o resto detalha
 * cada checagem.
 */
export type Conferencia = {
  estado: EstadoConferencia;
  /** Frase curta, em português, para exibir. */
  motivo: string;
  /** Rodadas lidas do Histórico (da execução, ou da janela sem reimportação). */
  rodadas: number;
  /** Conferida sem reimportar: a janela já estava completa na varredura. */
  semReimportacao: boolean;
  /** A janela é recente (até dois meses): divergência vira inconclusiva. */
  janelaRecente: boolean;
  checagens: {
    terminou: boolean;
    log: {
      situacao: "limpo" | "erro_da_origem" | "erro_nosso";
      /** O que foi lido: as rodadas da execução ou só a última rodada da janela. */
      escopo: "execucao" | "ultima_rodada_da_janela";
      rodadasComErroNosso: number;
      rodadasComErroDaOrigem: number;
      avisos: number;
    };
    contagem: {
      situacao:
        | "confere"
        | "sem_total_da_origem"
        | "vazia_legitima"
        | "divergente"
        | "zero_com_origem"
        | "vazia_sem_explicacao"
        | "nao_se_aplica";
      /** Registros processados pela varredura da janela, somando as rodadas. */
      acumulado: number;
      /** Registros da origem que a importação descarta por regra. */
      descartados: number;
      /** Total informado pela origem; `null` quando ela não informa. */
      totalOrigem: number | null;
    };
    cobertura: {
      situacao: "refletida" | "nao_refletida" | "nao_se_aplica";
      /** Registros no cache dentro da janela; `null` = fonte sem célula mensal. */
      registrosNaCelula: number | null;
    };
  };
  /** Sinais novos gerados pela janela; `null` = fonte sem regras de qualidade. */
  findingsNovos: number | null;
};

/** Uma linha de rodada da execução, como está em `importacoes`. */
export type RodadaDaExecucao = {
  ano: number | null;
  mes: number | null;
  resultado: string | null;
  erros: string[];
};

export type EntradaConferencia = {
  /** A célula da janela na cobertura; `null` no cadastro, que não tem célula no tempo. */
  janela: { ano: number; mes: number } | null;
  terminou: boolean;
  /**
   * As rodadas, na ordem: as da execução ou, sem reimportação, as da janela
   * (fonte + ano/mês).
   */
  rodadas: RodadaDaExecucao[];
  /** A janela já estava completa e só foi conferida (ver o topo do módulo). */
  semReimportacao?: boolean;
  /** A chamada que busca o total na origem falhou (só sem reimportação). */
  falhaAoConsultarOrigem?: string | null;
  /** `totalAcumulado` da varredura da janela. */
  acumulado: number;
  /** Total da origem e descartados, lidos na última rodada; `null` se a origem não informa. */
  origem: { total: number; descartados: number } | null;
  registrosNaCelula: number | null;
  recente: boolean;
  findingsNovos: number | null;
  /** Conferência mínima: só "terminou" e "log limpo" (ver o topo do módulo). */
  minima?: boolean;
};

const ehAviso = (e: string) => e.startsWith("info:");

/** Resultados de rodada que explicam uma janela vazia. */
const VAZIO_LEGITIMO = new Set(["sem_dados", "nao_publicado", "fora_da_janela"]);

const rotuloJanela = (j: { ano: number; mes: number } | null) =>
  j ? `a janela ${j.ano}-${String(j.mes).padStart(2, "0")}` : "o cadastro";

export function conferirJanela(e: EntradaConferencia): Conferencia {
  const reprovacoes: string[] = [];
  const inconclusoes: string[] = [];

  const semReimportacao = e.semReimportacao ?? false;
  if (!e.terminou) reprovacoes.push("A janela não terminou.");
  if (e.rodadas.length === 0 && !semReimportacao) {
    reprovacoes.push("Nenhuma rodada desta execução ficou registrada no Histórico.");
  }

  // Log limpo. Erro que a classificação não atribuiu à origem conta como
  // nosso — a mesma regra de `resultado-rodada.ts`. Sem reimportação, só a
  // última rodada da janela conta.
  let comErroNosso = 0;
  let comErroDaOrigem = 0;
  let avisos = 0;
  for (const r of semReimportacao ? e.rodadas.slice(-1) : e.rodadas) {
    avisos += r.erros.filter(ehAviso).length;
    const temErro = r.erros.some((x) => !ehAviso(x));
    if (r.resultado === "erro_origem") comErroDaOrigem++;
    else if (r.resultado === "erro_nosso" || temErro) comErroNosso++;
  }
  if (comErroNosso > 0) reprovacoes.push(`Falha nossa em ${comErroNosso} rodada(s).`);
  if (comErroDaOrigem > 0) {
    inconclusoes.push(
      `A origem falhou em ${comErroDaOrigem} rodada(s), mesmo com as novas tentativas.`,
    );
  }
  if (e.falhaAoConsultarOrigem) {
    inconclusoes.push(
      `Não foi possível consultar o total na origem (${e.falhaAoConsultarOrigem}).`,
    );
  }
  const origemFalhou = comErroDaOrigem > 0 || Boolean(e.falhaAoConsultarOrigem);

  // Contagem e cobertura. Com falha da origem no log, o que falta na
  // contagem ou na célula é explicado por ela: vira inconclusiva, não
  // reprovada — insistir depois é o remédio, não corrigir código.
  const faltas: string[] = [];
  // Faltas que só existem por não haver evidência a ler: sem reimportação e
  // sem nenhuma rodada da janela no Histórico (o checkpoint sobreviveu à
  // linha que ancorava a célula). Não apontam defeito — pedem reimportação.
  const semEvidencia: string[] = [];
  const semHistorico = semReimportacao && e.rodadas.length === 0;
  const descartados = e.origem?.descartados ?? 0;
  let contagem: Conferencia["checagens"]["contagem"]["situacao"];
  if (e.minima) {
    contagem = "nao_se_aplica";
  } else if (e.origem) {
    const { total } = e.origem;
    if (total > 0 && e.acumulado === 0) {
      contagem = "zero_com_origem";
      faltas.push(`Nenhum registro importado, mas a origem informa ${total}.`);
    } else if (e.acumulado + descartados !== total) {
      contagem = "divergente";
      const frase = `Contagem diverge da origem: ${e.acumulado} importados + ${descartados} descartados, a origem informa ${total}`;
      if (e.recente) inconclusoes.push(`${frase} (janela recente).`);
      else faltas.push(`${frase}.`);
    } else {
      contagem = "confere";
    }
  } else if (e.acumulado > 0) {
    contagem = "sem_total_da_origem";
  } else if (e.rodadas.some((r) => r.resultado && VAZIO_LEGITIMO.has(r.resultado))) {
    contagem = "vazia_legitima";
  } else {
    contagem = "vazia_sem_explicacao";
    (semHistorico ? semEvidencia : faltas).push(
      "Nenhum registro importado e nenhuma rodada explica o vazio.",
    );
  }

  // Reflexo na cobertura.
  let refletida: boolean;
  const janela = e.janela;
  if (e.minima) {
    refletida = true;
  } else if (e.registrosNaCelula === null || janela === null) {
    refletida = e.acumulado > 0;
  } else if (e.acumulado > 0) {
    refletida = e.registrosNaCelula > 0;
  } else {
    // Sem reimportação, a origem respondeu agora que a janela é vazia: a
    // própria conferência a consultou sem erro, e a linha que ela grava (com
    // `ano`/`mes`) ancora a célula na cobertura.
    const vaziaConfirmadaAgora = semReimportacao && e.origem?.total === 0;
    refletida =
      e.registrosNaCelula > 0 ||
      vaziaConfirmadaAgora ||
      e.rodadas.some(
        (r) =>
          r.ano === janela.ano &&
          r.mes === janela.mes &&
          r.resultado !== null &&
          r.resultado !== "erro_origem" &&
          r.resultado !== "erro_nosso",
      );
  }
  if (!refletida) {
    (semHistorico ? semEvidencia : faltas).push(
      `A cobertura não reflete ${rotuloJanela(e.janela)}.`,
    );
  }
  (origemFalhou ? inconclusoes : reprovacoes).push(...faltas);
  if (semEvidencia.length > 0) {
    inconclusoes.push(
      "Nenhuma rodada da janela no Histórico: sem como conferir sem reimportar.",
      ...semEvidencia,
    );
  }

  let estado: EstadoConferencia;
  let motivo: string;
  if (reprovacoes.length > 0) {
    estado = "reprovada";
    motivo = reprovacoes[0];
  } else if (inconclusoes.length > 0) {
    estado = "inconclusiva";
    motivo = inconclusoes[0];
  } else {
    estado = "aprovada";
    motivo = e.minima
      ? `Tarefa concluída: ${e.findingsNovos ?? 0} findings novos.`
      : motivoDaAprovacao(e.acumulado, e.origem);
  }
  if (semReimportacao) motivo = `${motivo} Conferida sem reimportar.`;

  return {
    estado,
    motivo,
    rodadas: e.rodadas.length,
    semReimportacao,
    janelaRecente: e.recente,
    checagens: {
      terminou: e.terminou,
      log: {
        situacao:
          comErroNosso > 0 ? "erro_nosso" : comErroDaOrigem > 0 ? "erro_da_origem" : "limpo",
        escopo: semReimportacao ? "ultima_rodada_da_janela" : "execucao",
        rodadasComErroNosso: comErroNosso,
        rodadasComErroDaOrigem: comErroDaOrigem,
        avisos,
      },
      contagem: {
        situacao: contagem,
        acumulado: e.acumulado,
        descartados,
        totalOrigem: e.origem?.total ?? null,
      },
      cobertura: {
        situacao: e.minima ? "nao_se_aplica" : refletida ? "refletida" : "nao_refletida",
        registrosNaCelula: e.registrosNaCelula,
      },
    },
    findingsNovos: e.findingsNovos,
  };
}

function motivoDaAprovacao(
  acumulado: number,
  origem: { total: number; descartados: number } | null,
): string {
  if (!origem) {
    return acumulado > 0
      ? `Janela completa: ${acumulado} registros (a origem não informa total).`
      : "Janela completa, sem registros no período.";
  }
  if (origem.total === 0) return "Janela completa, sem registros na origem.";
  const descartes = origem.descartados > 0 ? ` (${origem.descartados} descartados)` : "";
  return `Janela completa: ${acumulado} de ${origem.total} registros da origem${descartes}.`;
}

// ---------------------------------------------------------------------------
// Pendentes
// ---------------------------------------------------------------------------

/**
 * Uma conferência já gravada, como a consulta de pendentes a lê. `ano`/`mes`
 * são nulos na linha de fonte sem célula (ex.: cadastro de municípios).
 */
export type ConferenciaGravada = {
  ano: number | null;
  mes: number | null;
  /** A linha da matriz (órgão, ente, sigla) em que a conferência foi gravada. */
  escopo?: string;
  estado: EstadoConferencia;
  motivo: string;
  execucao_id: string | null;
  consultado_em: string;
};

/**
 * Uma janela pendente. Em fonte mensal, `mes` é o mês; em fonte anual, 1 (a
 * âncora da cobertura); no SICONFI, o período do relatório (0 = anual). O
 * cadastro tem uma janela só, sem datas (`ano` e `mes` 0).
 */
export type JanelaPendente = {
  ano: number;
  mes: number;
  dataInicio: string;
  dataFim: string;
  /**
   * A linha da janela, quando a tarefa tem várias no mesmo período: a sigla
   * das matérias ou o tipo das proposições.
   */
  escopo?: string;
  /** A última conferência da janela; `null` = nunca conferida. */
  ultima: Omit<ConferenciaGravada, "ano" | "mes"> | null;
};

type Candidata = Omit<JanelaPendente, "ultima">;

const ultimoDia = (ano: number, mes: number) => new Date(Date.UTC(ano, mes, 0)).getUTCDate();
const mm = (mes: number) => String(mes).padStart(2, "0");

/** Do primeiro dia de `mesIni` ao último de `mesFim`, no mesmo ano. */
function datas(ano: number, mesIni: number, mesFim: number) {
  return {
    dataInicio: `${ano}-${mm(mesIni)}-01`,
    dataFim: `${ano}-${mm(mesFim)}-${ultimoDia(ano, mesFim)}`,
  };
}

/**
 * As candidatas cuja última conferência (casada por `ano`/`mes`) não é
 * aprovada, na ordem em que vieram.
 */
function filtrarPendentes(
  candidatas: readonly Candidata[],
  conferencias: readonly ConferenciaGravada[],
  chave: (c: { ano: number | null; mes: number | null }) => string = (c) => `${c.ano}-${c.mes}`,
): JanelaPendente[] {
  const ultimaPorJanela = new Map<string, ConferenciaGravada>();
  for (const c of conferencias) {
    const k = chave(c);
    const atual = ultimaPorJanela.get(k);
    if (!atual || c.consultado_em > atual.consultado_em) ultimaPorJanela.set(k, c);
  }
  const pendentes: JanelaPendente[] = [];
  for (const j of candidatas) {
    const ultima = ultimaPorJanela.get(chave(j));
    if (ultima?.estado === "aprovada") continue;
    pendentes.push({
      ...j,
      ultima: ultima
        ? {
            estado: ultima.estado,
            motivo: ultima.motivo,
            execucao_id: ultima.execucao_id,
            consultado_em: ultima.consultado_em,
          }
        : null,
    });
  }
  return pendentes;
}

/**
 * Janelas da fonte, dentro da janela de disponibilidade (`janelas.ts`), cuja
 * última conferência não é aprovada — nunca conferida, reprovada ou
 * inconclusiva. Da mais recente para a mais antiga, a ordem em que a
 * ferramenta importa.
 *
 * Mensais por padrão. Com `granularidade: "ano"` (fonte consultada por ano
 * inteiro, como as emendas, as matérias e as proposições), uma janela por
 * ano, com `mes = 1` — a âncora da célula anual na cobertura — e as datas do
 * ano inteiro; o ano corrente entra.
 */
export function janelasPendentes(
  fonte: FonteJanela,
  conferencias: readonly ConferenciaGravada[],
  hoje: Date = new Date(),
  granularidade: "mes" | "ano" = "mes",
): JanelaPendente[] {
  const candidatas: Candidata[] = [];
  for (let ano = hoje.getFullYear(); ano >= ANO_INICIO_POR_FONTE[fonte]; ano--) {
    if (granularidade === "ano") {
      if (dentroDaJanelaAnual(fonte, ano, hoje))
        candidatas.push({ ano, mes: 1, ...datas(ano, 1, 12) });
      continue;
    }
    for (let mes = 12; mes >= 1; mes--) {
      if (dentroDaJanela(fonte, ano, mes, hoje))
        candidatas.push({ ano, mes, ...datas(ano, mes, mes) });
    }
  }
  return filtrarPendentes(candidatas, conferencias);
}

/**
 * Cadastro (deputados, municípios): não tem célula no tempo. É uma janela só,
 * pendente enquanto a última conferência da fonte não for aprovada.
 */
export function janelaPendenteDeCadastro(
  conferencias: readonly ConferenciaGravada[],
): JanelaPendente[] {
  return filtrarPendentes(
    [{ ano: 0, mes: 0, dataInicio: "", dataFim: "" }],
    conferencias,
    () => "cadastro",
  );
}

/**
 * Relatório fiscal por período (SICONFI): `periodos` por exercício (RREO 6
 * bimestres, RGF 3 quadrimestres, RGF simplificado 2 semestres) ou 0 no
 * relatório anual (DCA), que vira o período 0 — o mesmo da célula da
 * cobertura. Só períodos já encerrados, do mais recente ao mais antigo.
 */
export function janelasPendentesPorPeriodo(
  fonte: FonteJanela,
  periodos: number,
  conferencias: readonly ConferenciaGravada[],
  hoje: Date = new Date(),
): JanelaPendente[] {
  const encerrado = (ano: number, mesFim: number) => new Date(ano, mesFim, 1) <= hoje;
  const candidatas: Candidata[] = [];
  for (let ano = hoje.getFullYear(); ano >= ANO_INICIO_POR_FONTE[fonte]; ano--) {
    if (periodos === 0) {
      if (encerrado(ano, 12)) candidatas.push({ ano, mes: 0, ...datas(ano, 1, 12) });
      continue;
    }
    const meses = 12 / periodos;
    for (let p = periodos; p >= 1; p--) {
      const mesFim = p * meses;
      if (encerrado(ano, mesFim)) {
        candidatas.push({ ano, mes: p, ...datas(ano, mesFim - meses + 1, mesFim) });
      }
    }
  }
  return filtrarPendentes(candidatas, conferencias);
}
