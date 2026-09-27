/**
 * Estados de cobertura de uma fonte do catálogo: o universo de janelas, o
 * estado de cada uma e o resumo "X de Y concluídas", mais a data da última
 * importação válida e se a fonte está desatualizada.
 *
 * O universo vem da consulta de pendentes da ferramenta, que já sabe as
 * janelas de cada tarefa (órgãos ativos, siglas, janela de disponibilidade):
 * universo = pendentes ∪ janelas com conferência aprovada. Tarefa cuja fonte
 * depende do pedido (TSE, uma fonte por tipo de arquivo) ou cujas pendentes
 * exigem parâmetro (SICONFI, por ente e relatório) não tem universo
 * enumerável: o resumo cobre só as janelas já consultadas e diz isso.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { consultarPendentes, fonteEEscopoDaTarefa } from "@/lib/data/automacao/nomeado";
import { limiarDefasagemDias, type EntradaCatalogoCobertura } from "@/lib/data/cobertura-catalogo";
import {
  estadoDaJanela,
  resumirJanelas,
  ultimaImportacaoValida,
  type CelulaEstado,
  type EstadosDaFonte,
  type ResumoJanela,
} from "@/lib/data/cobertura-estado";
import type { ResultadoClassificado } from "@/lib/data/resultado-rodada";

export type { EstadosDaFonte };

export type LinhaJanela = {
  escopo: string;
  ano: number;
  mes: number;
  ultimo_resultado: string | null;
  ultimo_motivo_parada: string | null;
  ultima_rodada_em: string | null;
  conferencia_estado: string | null;
  conferencia_contagem: string | null;
  conferencia_em: string | null;
  /** Desde a migration 0014; ausentes antes dela. */
  conferencia_motivo?: string | null;
  conferencia_execucao_id?: string | null;
};

/**
 * Registros no cache por célula: chave `escopo|ano|mes`; `*|ano|mes` quando a
 * contagem da fonte não separa o escopo. Cadastro: `*|0|0`.
 */
export type RegistrosPorCelula = ReadonlyMap<string, number>;

function temRegistros(r: RegistrosPorCelula, escopo: string, ano: number, mes: number): boolean {
  return (r.get(`${escopo}|${ano}|${mes}`) ?? r.get(`*|${ano}|${mes}`) ?? 0) > 0;
}

export function resumoDaLinha(l: LinhaJanela | undefined, registros: boolean): ResumoJanela {
  return {
    temRegistros: registros,
    ultimaRodada: l?.ultima_rodada_em
      ? {
          resultado: l.ultimo_resultado as ResultadoClassificado | null,
          motivoParada: l.ultimo_motivo_parada,
          em: l.ultima_rodada_em,
        }
      : null,
    conferencia:
      l?.conferencia_em && l.conferencia_estado
        ? {
            estado: l.conferencia_estado as "aprovada" | "reprovada" | "inconclusiva",
            contagem: l.conferencia_contagem,
            em: l.conferencia_em,
          }
        : null,
  };
}

export async function linhasDaFonte(fonte: string): Promise<LinhaJanela[]> {
  const { data, error } = await supabaseAdmin.rpc("cobertura_janelas", { p_fonte: fonte });
  if (error) throw new Error(`cobertura: janelas de ${fonte}: ${error.message}`);
  return (data ?? []) as LinhaJanela[];
}

export async function estadosDaFonte(
  entrada: EntradaCatalogoCobertura,
  registros: RegistrosPorCelula,
  agora: Date = new Date(),
): Promise<EstadosDaFonte> {
  let universoEnumerado = true;
  // Chave `fonte|escopo|ano|mes` → escopo/ano/mes e a linha do Histórico.
  const universo = new Map<string, { escopo: string; ano: number; mes: number }>();
  const linhas = new Map<string, LinhaJanela>();

  // As tarefas de uma fonte são lidas em paralelo: o Histórico de cada fonte
  // uma vez só, e as pendentes de cada tarefa.
  const alvos = entrada.tarefas.map((tarefa) => ({ tarefa, alvo: fonteEEscopoDaTarefa(tarefa) }));
  if (alvos.some((a) => !a.alvo)) universoEnumerado = false;
  const fontes = [...new Set(alvos.flatMap((a) => (a.alvo ? [a.alvo.fonte] : [])))];
  const [historicos, pendentes] = await Promise.all([
    Promise.all(fontes.map(async (fonte) => ({ fonte, linhas: await linhasDaFonte(fonte) }))),
    Promise.all(
      alvos.map(async ({ tarefa, alvo }) =>
        alvo ? { alvo, r: await consultarPendentes({ consulta: "pendentes", tarefa }) } : null,
      ),
    ),
  ]);
  for (const { fonte, linhas: ls } of historicos) {
    for (const l of ls) linhas.set(`${fonte}|${l.escopo}|${l.ano}|${l.mes}`, l);
  }
  for (const p of pendentes) {
    if (!p) continue;
    if ("recusa" in p.r) {
      universoEnumerado = false;
      continue;
    }
    for (const j of p.r.janelas) {
      const escopo = j.escopo ?? p.alvo.escopo;
      universo.set(`${p.alvo.fonte}|${escopo}|${j.ano}|${j.mes}`, {
        escopo,
        ano: j.ano,
        mes: j.mes,
      });
    }
  }

  // Janelas aprovadas saem das pendentes: voltam pelo Histórico. Sem universo
  // enumerável, todas as janelas já consultadas entram.
  for (const [chave, l] of linhas) {
    if (!universoEnumerado || l.conferencia_estado === "aprovada") {
      universo.set(chave, { escopo: l.escopo, ano: l.ano, mes: l.mes });
    }
  }

  const celulas: CelulaEstado[] = [];
  for (const [chave, j] of universo) {
    const estado = estadoDaJanela(
      resumoDaLinha(linhas.get(chave), temRegistros(registros, j.escopo, j.ano, j.mes)),
      agora,
    );
    celulas.push({ ...j, estado });
  }

  const ultima = ultimaImportacaoValida(
    [...linhas.values()]
      .filter((l) => l.conferencia_estado && l.conferencia_em)
      .map((l) => ({ estado: l.conferencia_estado!, em: l.conferencia_em! })),
  );
  const limiarMs = limiarDefasagemDias(entrada) * 86_400_000;
  return {
    universoEnumerado,
    resumo: resumirJanelas(celulas.map((c) => c.estado)),
    celulas,
    ultimaImportacaoValida: ultima,
    desatualizada: !ultima || agora.getTime() - new Date(ultima).getTime() > limiarMs,
  };
}
