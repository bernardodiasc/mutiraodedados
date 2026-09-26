/**
 * Modo nomeado — as tarefas de cruzamento, por eleição:
 *
 * - `tse_lacunas`: eleito sem prestação de contas (confirmado na API
 *   DivulgaCandContas), candidato sem bens, série histórica incompleta e
 *   parlamentar sem vínculo;
 * - `tse_sinais`: evolução patrimonial atípica e fornecedor de campanha
 *   concentrado;
 * - `cruzamento_doador_fornecedor`: doador de campanha que virou fornecedor
 *   (precisa também dos contratos da CGU).
 *
 * Os mesmos runners dos botões do painel (`tse/sinais.server.ts`), chamados
 * com o ano. Cada tarefa é uma chamada só (`haMais: false` na primeira
 * rodada) e não importa de uma origem — cruza o que já está no banco: a
 * conferência é a mínima (terminou e log limpo; contagem e cobertura "não se
 * aplicam") e informa os findings novos. O runner não grava linha no
 * Histórico; o adaptador grava uma, com o ano e `mes` 1: `fonte` = a tarefa,
 * menos o doador↔fornecedor, que grava `tse_doador_fornecedor` (as fontes
 * derivadas do TSE ficam sob o prefixo `tse_`).
 */
import type { z } from "zod";
import { anoEleicaoTseSchema } from "@/lib/data/tse/ingest.functions";
import { lacunasTseSchema, sinaisTseSchema } from "@/lib/data/tse/sinais.functions";
import {
  rodarCandidatosSemBens,
  rodarDoadorVirouFornecedor,
  rodarEleitosSemContas,
  rodarEvolucaoPatrimonial,
  rodarFornecedorConcentrado,
  rodarParlamentarSemMatch,
  rodarSerieHistorica,
  type SinaisRodada,
} from "@/lib/data/tse/sinais.server";
import type { Adaptador, ResultadoAdaptado } from "@/lib/data/automacao/adaptador";
import { registrarRodadaAvulsa } from "@/lib/data/automacao/adaptadores/linha-de-rodada";
import type { OrigemRodada } from "@/lib/data/historico-rodada";
import { janelasPendentes } from "@/lib/data/automacao/conferencia";
import { lerConferencias } from "@/lib/data/automacao/conferencia.server";
import { ehEleicao } from "@/lib/data/tse/matriz";

/** O ano tem de ser uma eleição coberta, dentro da janela da fonte. */
const comEleicao = <T extends { ano: number }>(schema: z.ZodType<T>) =>
  schema.superRefine((p, ctx) => {
    const r = anoEleicaoTseSchema.safeParse(p.ano);
    if (!r.success)
      for (const i of r.error.issues) ctx.addIssue({ code: "custom", message: i.message });
  }) as z.ZodType<T>;

/**
 * Roda os runners em sequência e grava a linha da rodada. Runner que lança
 * vira erro da rodada — o que falta dele não chega a rodar —, e os avisos
 * dos runners vão como estão (`info:` à parte).
 */
async function rodarCruzamento(
  tarefa: string,
  ano: number,
  runners: Array<() => Promise<SinaisRodada>>,
  origem: OrigemRodada,
): Promise<ResultadoAdaptado> {
  const erros: string[] = [];
  const regras: string[] = [];
  let avaliados = 0;
  let findings = 0;
  for (const rodar of runners) {
    try {
      const r = await rodar();
      regras.push(r.regra);
      avaliados += r.candidatosAvaliados;
      findings += r.findingsGerados;
      erros.push(...r.avisos.map((a) => (a.startsWith("info:") ? a : `${r.regra}: ${a}`)));
    } catch (e) {
      erros.push((e as Error).message);
    }
  }
  const aviso = await registrarRodadaAvulsa({
    fonte: tarefa,
    escopo: "",
    ano,
    mes: 1,
    importados: findings,
    processados: avaliados,
    erros,
    endpoint: `Cruzamento ${tarefa} da eleição de ${ano} (${regras.join(", ") || "nenhuma regra concluída"})`,
    origem,
  });
  if (aviso) erros.push(aviso);
  return {
    importados: { avaliados, findings },
    erros,
    varredura: {
      haMais: false,
      cursor: null,
      totalAcumulado: avaliados,
      orcamentoEsgotado: false,
      custoEsgotado: false,
    },
    origem: null,
    findingsNovos: findings,
  };
}

type Ano = { ano: number };

/**
 * O que as três tarefas dividem: a janela é a eleição, sem varredura; as
 * pendentes são as eleições da janela da fonte sem conferência aprovada.
 */
const base = <P extends Ano>(tarefa: string, rotulo: string) => ({
  fonte: tarefa,
  granularidade: "ano" as const,
  janela: (p: P) => ({ ano: p.ano, mes: 1 }),
  conferenciaMinima: true,
  descricao: (p: P) => `${rotulo} da eleição de ${p.ano}`,
  unidades: ["avaliados", "findings"],
  pendentes: async () =>
    janelasPendentes("tse", await lerConferencias(tarefa), new Date(), "ano").filter((j) =>
      ehEleicao(j.ano),
    ),
});

type ParamsLacunas = z.infer<typeof lacunasTseSchema>;

export const adaptadorTseLacunas: Adaptador<ParamsLacunas> = {
  ...base<ParamsLacunas>("tse_lacunas", "TSE: lacunas"),
  schema: comEleicao(lacunasTseSchema),
  rodada: (p, origem) =>
    rodarCruzamento(
      "tse_lacunas",
      p.ano,
      [
        () => rodarEleitosSemContas(p.ano),
        () => rodarCandidatosSemBens(p.ano, p.ativarCandidatoSemBens ?? true),
        () => rodarSerieHistorica(p.ano),
        () => rodarParlamentarSemMatch(),
      ],
      origem,
    ),
};

export const adaptadorTseSinais: Adaptador<Ano> = {
  ...base<Ano>("tse_sinais", "TSE: sinais investigativos"),
  schema: comEleicao(sinaisTseSchema),
  rodada: (p, origem) =>
    rodarCruzamento(
      "tse_sinais",
      p.ano,
      [() => rodarEvolucaoPatrimonial(p.ano), () => rodarFornecedorConcentrado(p.ano)],
      origem,
    ),
};

export const adaptadorDoadorFornecedor: Adaptador<Ano> = {
  ...base<Ano>("tse_doador_fornecedor", "TSE: cruzamento doador↔fornecedor"),
  schema: comEleicao(sinaisTseSchema),
  rodada: (p, origem) =>
    rodarCruzamento(
      "tse_doador_fornecedor",
      p.ano,
      [() => rodarDoadorVirouFornecedor(p.ano)],
      origem,
    ),
};
