/**
 * Modo nomeado de `/api/cron-importar`: quem chama diz a tarefa e a janela.
 *
 * O modo fila escolhe sozinho a próxima tarefa e importa sempre o mês
 * corrente. O modo nomeado existe para a ferramenta de linha de comando
 * (`bun run importar`) importar uma janela qualquer, sem o painel: cada
 * chamada é UMA rodada de UMA janela, e quem chama repete até `haMais` virar
 * falso. Não passa pela fila (`automacao_tarefas`), mas divide o cursor com
 * painel e fila pela mesma chave de varredura — começar num gatilho e
 * terminar em outro é permitido.
 *
 * Cada tarefa nomeada tem um adaptador (contrato em `adaptador.ts`; os de
 * fonte ficam em `adaptadores/`, um módulo por fonte): o schema de parâmetros
 * (o MESMO da casca autenticada, exportado de lá), a checagem da janela
 * natural da fonte, a chave de varredura e a tradução do retorno do núcleo
 * para a resposta única ({@link RespostaNomeada}).
 *
 * Na última rodada da janela (`haMais: false`) a rota confere a execução
 * inteira (`conferencia.ts`), grava o veredito em `importacoes.conferencia` e
 * o devolve na resposta. A consulta nomeada de PENDENTES
 * ({@link consultarPendentes}) diz quais janelas da fonte ainda não têm
 * conferência aprovada — só lê, nada importa.
 *
 * Janela que a varredura já dá como completa não é reimportada sem
 * `reprocessar`. Se ainda não tem conferência aprovada, a rota só a confere
 * (`conferirSemReimportar`): uma chamada à origem para o total, sem baixar os
 * registros de novo.
 */
import { z } from "zod";
import { checkpointImportacao } from "@/lib/data/checkpoint.server";
import { ehPeriodoRecente } from "@/lib/data/historico-rodada";
import type { FonteJanela } from "@/lib/data/janelas";
import {
  adaptador,
  janelaDeUmMes,
  mesDasDatas,
  type Adaptador,
  type RecusaNomeada,
  type Varredura,
} from "@/lib/data/automacao/adaptador";
import {
  janelaPendenteDeCadastro,
  janelasPendentes,
  type Conferencia,
  type JanelaPendente,
} from "@/lib/data/automacao/conferencia";
import {
  conferirEGravar,
  conferirSemReimportar,
  contarRegistrosNaJanela,
  lerConferencias,
  ultimaConferenciaDaJanela,
} from "@/lib/data/automacao/conferencia.server";
import {
  chaveVarreduraVotacoesCamara,
  importarVotacoesSchema,
  rodadaVotacoesCamara,
  totalDaOrigemVotacoesCamara,
} from "@/lib/data/camara/votacoes.functions";
import {
  chaveVarreduraVotacoesSenado,
  importarVotacoesSenadoSchema,
  rodadaVotacoesSenado,
  totalDaOrigemVotacoesSenado,
} from "@/lib/data/senado/votacoes.functions";
import { adaptadorPncp } from "@/lib/data/automacao/adaptadores/pncp";
import { adaptadorConvenios } from "@/lib/data/automacao/adaptadores/convenios";
import { adaptadorCeap } from "@/lib/data/automacao/adaptadores/ceap";
import { adaptadorCeaps } from "@/lib/data/automacao/adaptadores/ceaps";
import { adaptadorMaterias } from "@/lib/data/automacao/adaptadores/materias";
import { adaptadorProposicoes } from "@/lib/data/automacao/adaptadores/proposicoes";
import { adaptadorIbge } from "@/lib/data/automacao/adaptadores/ibge";
import { adaptadorCamaraCadastro } from "@/lib/data/automacao/adaptadores/camara-cadastro";
import { adaptadorSiconfi } from "@/lib/data/automacao/adaptadores/siconfi";
import { adaptadorCguLicitacoes } from "@/lib/data/automacao/nomeado-cgu-licitacoes";
import { adaptadorCguEmendas } from "@/lib/data/automacao/nomeado-cgu-emendas";
import { adaptadorConveniosPorEnte } from "@/lib/data/automacao/nomeado-transferegov";
import { adaptadorConveniosOrigem } from "@/lib/data/automacao/adaptadores/convenios-origem";
import { adaptadorTseArquivo } from "@/lib/data/automacao/adaptadores/tse-arquivo";
import { adaptadorTsePonte } from "@/lib/data/automacao/adaptadores/tse-ponte";
import {
  adaptadorDoadorFornecedor,
  adaptadorTseLacunas,
  adaptadorTseSinais,
} from "@/lib/data/automacao/adaptadores/tse-cruzamentos";
import { adaptadorCguContratos } from "@/lib/data/automacao/adaptadores/cgu-contratos";
import { adaptadorCguSiafi } from "@/lib/data/automacao/adaptadores/cgu-siafi";
import { adaptadorCguAtividade } from "@/lib/data/automacao/adaptadores/cgu-atividade";
import { adaptadorSenadoCadastro } from "@/lib/data/automacao/adaptadores/senado-cadastro";
import { adaptadorCamaraTrajetoria } from "@/lib/data/automacao/adaptadores/camara-trajetoria";
import { adaptadorSiconfiAno } from "@/lib/data/automacao/adaptadores/siconfi-ano";
import { adaptadorSiconfiVarredura } from "@/lib/data/automacao/adaptadores/siconfi-varredura";

// O contrato do adaptador mora em `adaptador.ts`; os módulos de fonte que o
// importam daqui continuam valendo.
export type { Adaptador, ResultadoAdaptado, Varredura } from "@/lib/data/automacao/adaptador";

/**
 * Por que a rodada parou. `janela_completa` = nada foi importado (ver
 * `reprocessar`); pode ter havido só a conferência.
 */
export type MotivoParada = "fim" | "tempo" | "subrequisicoes" | "erro" | "janela_completa";

export type RespostaNomeada = {
  tarefa: string;
  /** Os parâmetros já validados (com os padrões do schema aplicados). */
  params: unknown;
  execucao_id: string;
  /** Quantidade importada nesta rodada, por unidade (ex.: votações e votos). */
  importados: Record<string, number>;
  /** Erros da rodada, com o texto. */
  erros: string[];
  /** Avisos `info:`, separados dos erros como no Histórico. */
  avisos: string[];
  haMais: boolean;
  /** Onde a varredura da janela parou. */
  cursor: number | null;
  /** Processados somando todas as rodadas da janela. */
  totalAcumulado: number;
  parada: MotivoParada;
  /**
   * Veredito sobre a janela inteira, na última rodada dela ou, com a janela
   * já completa, na conferência sem reimportação. `null` nas rodadas
   * intermediárias e na janela completa que já tinha conferência aprovada.
   */
  conferencia: Conferencia | null;
};

/** O corpo que liga o modo nomeado. Sem `tarefa`, a rota fica no modo fila. */
export const pedidoNomeadoSchema = z.object({
  tarefa: z.string().min(1),
  params: z.unknown(),
  execucao_id: z.uuid(),
  reprocessar: z.boolean().default(false),
});

export type PedidoNomeado = z.infer<typeof pedidoNomeadoSchema>;

const ADAPTADORES: Record<string, Adaptador<unknown>> = {
  camara_vot: adaptador({
    schema: janelaDeUmMes(importarVotacoesSchema, "camara_vot"),
    fonte: "camara_vot",
    chave: chaveVarreduraVotacoesCamara,
    janela: (p) => mesDasDatas(p.dataInicio, p.dataFim),
    contarNaCelula: (p) => contarRegistrosNaJanela("camara_votacoes_cache", p),
    totalDaOrigem: totalDaOrigemVotacoesCamara,
    descricao: (p) => `Câmara: votações de ${p.dataInicio} a ${p.dataFim}`,
    unidades: ["votacoes", "votos"],
    rodada: (p, origem) =>
      rodadaVotacoesCamara(p, null, origem).then((r) => ({
        importados: { votacoes: r.votacoes, votos: r.votos },
        erros: r.erros,
        varredura: r.varredura,
        origem: r.origem,
      })),
  }),
  senado_vot: adaptador({
    schema: janelaDeUmMes(importarVotacoesSenadoSchema, "senado_vot"),
    fonte: "senado_vot",
    chave: chaveVarreduraVotacoesSenado,
    janela: (p) => mesDasDatas(p.dataInicio, p.dataFim),
    contarNaCelula: (p) => contarRegistrosNaJanela("senado_votacoes_cache", p),
    totalDaOrigem: totalDaOrigemVotacoesSenado,
    descricao: (p) => `Senado: votações de ${p.dataInicio} a ${p.dataFim}`,
    unidades: ["votacoes", "votos"],
    rodada: (p, origem) =>
      rodadaVotacoesSenado(p, null, origem).then((r) => ({
        importados: { votacoes: r.votacoes, votos: r.votos },
        erros: r.erros,
        varredura: r.varredura,
        origem: r.origem,
      })),
  }),
  pncp: adaptador(adaptadorPncp),
  convenios: adaptador(adaptadorConvenios),
  camara_ceap: adaptador(adaptadorCeap),
  senado_ceaps: adaptador(adaptadorCeaps),
  senado_mat: adaptador(adaptadorMaterias),
  camara_props: adaptador(adaptadorProposicoes),
  ibge: adaptador(adaptadorIbge),
  camara_cadastro: adaptador(adaptadorCamaraCadastro),
  siconfi_relatorio: adaptador(adaptadorSiconfi),
  cgu_licitacoes: adaptador(adaptadorCguLicitacoes),
  cgu_emendas: adaptador(adaptadorCguEmendas),
  transferegov: adaptador(adaptadorConveniosPorEnte),
  convenios_origem: adaptador(adaptadorConveniosOrigem),
  tse_arquivo: adaptador(adaptadorTseArquivo),
  tse_ponte: adaptador(adaptadorTsePonte),
  tse_lacunas: adaptador(adaptadorTseLacunas),
  tse_sinais: adaptador(adaptadorTseSinais),
  cruzamento_doador_fornecedor: adaptador(adaptadorDoadorFornecedor),
  cgu_contratos: adaptador(adaptadorCguContratos),
  cgu_siafi: adaptador(adaptadorCguSiafi),
  cgu_atividade: adaptador(adaptadorCguAtividade),
  senado_cadastro: adaptador(adaptadorSenadoCadastro),
  camara_trajetoria: adaptador(adaptadorCamaraTrajetoria),
  siconfi_ano: adaptador(adaptadorSiconfiAno),
  siconfi_varredura: adaptador(adaptadorSiconfiVarredura),
};

export function motivoDaParada(v: Varredura): MotivoParada {
  if (!v.haMais) return "fim";
  if (v.orcamentoEsgotado) return "tempo";
  if (v.custoEsgotado) return "subrequisicoes";
  return "erro";
}

const ehAviso = (e: string) => e.startsWith("info:");

export type { RecusaNomeada };

/**
 * A janela ainda pode crescer na origem (até dois meses: divergência vira
 * inconclusiva)? A anual é recente enquanto o ano fechou há menos de dois
 * meses; o cadastro, sem janela no tempo, nunca.
 */
function janelaRecente(alvo: Adaptador<unknown>, p: unknown): boolean {
  if (alvo.recente) return alvo.recente(p);
  const janela = alvo.janela(p);
  if (!janela) return false;
  return alvo.granularidade === "ano"
    ? ehPeriodoRecente(janela.ano, 12)
    : ehPeriodoRecente(janela.ano, janela.mes);
}

/** A contagem da célula, ou `null` na fonte sem célula (cadastro). */
function contadorDaCelula(alvo: Adaptador<unknown>, p: unknown) {
  const contar = alvo.contarNaCelula;
  return contar ? () => contar(p) : null;
}

/**
 * Executa uma rodada nomeada. Devolve a resposta única, ou a recusa (pedido
 * inválido) — quem chama responde 400 nesse caso, sem ter rodado nada.
 */
export async function executarRodadaNomeada(
  corpo: unknown,
): Promise<RespostaNomeada | RecusaNomeada> {
  const pedido = pedidoNomeadoSchema.safeParse(corpo);
  if (!pedido.success) return { recusa: z.prettifyError(pedido.error) };
  const { tarefa, execucao_id, reprocessar } = pedido.data;

  const alvo = ADAPTADORES[tarefa];
  if (!alvo) {
    return {
      recusa: `tarefa sem modo nomeado: ${tarefa} (disponíveis: ${Object.keys(ADAPTADORES).join(", ")})`,
    };
  }
  const params = alvo.schema.safeParse(pedido.data.params);
  if (!params.success) return { recusa: z.prettifyError(params.error) };

  const base = { tarefa, params: params.data, execucao_id };
  const fonte = typeof alvo.fonte === "function" ? alvo.fonte(params.data) : alvo.fonte;

  // Janela completa: por padrão não refaz — devolve o estado. Se ela ainda
  // não tem conferência aprovada (ex.: veio do painel), só a confere, sem
  // reimportar. `reprocessar` deixa o runner recomeçar do zero, que é o que
  // ele faz com varredura completa. Janela parcial sempre segue do cursor.
  const escopo = alvo.escopo?.(params.data);
  if (!reprocessar && alvo.chave) {
    const checkpoint = alvo.checkpoint ?? checkpointImportacao;
    const estado = await checkpoint.ler(alvo.chave(params.data));
    if (estado?.completa) {
      const janela = alvo.janela(params.data);
      const ultima = await (escopo === undefined
        ? ultimaConferenciaDaJanela(fonte, janela)
        : ultimaConferenciaDaJanela(fonte, janela, escopo));
      const conferencia =
        ultima?.estado === "aprovada"
          ? null
          : await conferirSemReimportar({
              fonte,
              escopo,
              execucaoId: execucao_id,
              entrada: {
                janela,
                acumulado: estado.total,
                recente: janelaRecente(alvo, params.data),
                findingsNovos: null,
              },
              totalDaOrigem: async () => (await alvo.totalDaOrigem?.(params.data)) ?? null,
              contarNaCelula: contadorDaCelula(alvo, params.data),
              descricao: alvo.descricao(params.data),
            });
      return {
        ...base,
        importados: Object.fromEntries(alvo.unidades.map((u) => [u, 0])),
        erros: [],
        avisos: [],
        haMais: false,
        cursor: estado.cursor,
        totalAcumulado: estado.total,
        parada: "janela_completa",
        conferencia,
      };
    }
  }

  const r = await alvo.rodada(params.data, { gatilho: "ferramenta", execucaoId: execucao_id });

  // Última rodada da janela: confere a execução inteira e grava o veredito.
  let conferencia: Conferencia | null = null;
  if (!r.varredura.haMais) {
    conferencia = await conferirEGravar(
      execucao_id,
      {
        janela: alvo.janela(params.data),
        terminou: true,
        acumulado: r.varredura.totalAcumulado,
        origem: r.origem,
        ...(r.falhaAoConsultarOrigem ? { falhaAoConsultarOrigem: r.falhaAoConsultarOrigem } : {}),
        recente: janelaRecente(alvo, params.data),
        // Findings novos só nas tarefas que geram sinais (os cruzamentos); nas
        // importações o QA roda, mas não é somado por janela.
        findingsNovos: r.findingsNovos ?? null,
        ...(alvo.conferenciaMinima ? { minima: true } : {}),
      },
      contadorDaCelula(alvo, params.data),
    );
  }

  return {
    ...base,
    importados: r.importados,
    erros: r.erros.filter((e) => !ehAviso(e)),
    avisos: r.erros.filter(ehAviso),
    haMais: r.varredura.haMais,
    cursor: r.varredura.cursor,
    totalAcumulado: r.varredura.totalAcumulado,
    parada: motivoDaParada(r.varredura),
    conferencia,
  };
}

/** O corpo da consulta de pendentes. */
export const pedidoPendentesSchema = z.object({
  consulta: z.literal("pendentes"),
  tarefa: z.string().min(1),
  /**
   * O que a tarefa precisa para enumerar as janelas: o recorte (ex.:
   * `{ codigoOrgao }`) nas que têm várias linhas na matriz, ou o ente e o
   * relatório do SICONFI.
   */
  params: z.unknown().optional(),
});

export type RespostaPendentes = {
  consulta: "pendentes";
  tarefa: string;
  /** Da mais recente para a mais antiga. */
  janelas: JanelaPendente[];
};

/**
 * Consulta nomeada, só de leitura: as janelas da tarefa dentro da janela de
 * disponibilidade cuja última conferência não é aprovada. É o que permite à
 * ferramenta não guardar estado local — interromper e rodar de novo continua
 * de onde parou, porque a lista vem sempre do servidor.
 */
export async function consultarPendentes(
  corpo: unknown,
): Promise<RespostaPendentes | RecusaNomeada> {
  const pedido = pedidoPendentesSchema.safeParse(corpo);
  if (!pedido.success) return { recusa: z.prettifyError(pedido.error) };
  const { tarefa } = pedido.data;
  const alvo = ADAPTADORES[tarefa];
  if (!alvo) {
    return {
      recusa: `tarefa sem modo nomeado: ${tarefa} (disponíveis: ${Object.keys(ADAPTADORES).join(", ")})`,
    };
  }
  if (alvo.pendentes) {
    const janelas = await alvo.pendentes(pedido.data.params);
    if ("recusa" in janelas) return janelas;
    return { consulta: "pendentes", tarefa, janelas };
  }
  if (typeof alvo.fonte !== "string") {
    return { recusa: `tarefa sem consulta de pendentes: ${tarefa}` };
  }
  let escopo: string | undefined;
  if (alvo.escopo) {
    const recorte = (alvo.recorte ?? z.object({})).safeParse(pedido.data.params ?? {});
    if (!recorte.success) return { recusa: z.prettifyError(recorte.error) };
    escopo = alvo.escopo(recorte.data);
  }
  const conferencias = await (escopo === undefined
    ? lerConferencias(alvo.fonte)
    : lerConferencias(alvo.fonte, escopo));
  const janelas =
    alvo.granularidade === "cadastro"
      ? janelaPendenteDeCadastro(conferencias)
      : janelasPendentes(alvo.fonte as FonteJanela, conferencias, new Date(), alvo.granularidade);
  return { consulta: "pendentes", tarefa, janelas };
}
