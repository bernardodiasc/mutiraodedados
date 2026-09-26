/**
 * Peças comuns aos adaptadores do modo nomeado das fontes que usam a API do
 * Portal da Transparência (CGU): licitações, emendas e convênios por ente.
 *
 * O Portal não informa o total de uma consulta — a paginação acaba numa
 * página menor que 15 itens. Por isso a contagem contra a origem, na
 * conferência, "não se aplica": sobra acumulado > 0, ou vazio legítimo.
 */
import type { z } from "zod";
import { anoMesDaJanela } from "@/lib/data/historico-rodada";
import { dentroDaJanela, type FonteJanela } from "@/lib/data/janelas";
import type { SweepRodada } from "@/lib/data/real/sweep";
import type { ResultadoAdaptado } from "@/lib/data/automacao/nomeado";

/**
 * Janela natural do Portal: um mês do calendário (a API recusa período maior
 * que um mês), dentro da janela de disponibilidade da fonte. Janela maior é
 * recusada — quem chama fatia.
 */
export function janelaDeUmMesDoPortal<T extends { dataInicial: string; dataFinal: string }>(
  schema: z.ZodType<T>,
  fonte: FonteJanela,
): z.ZodType<T> {
  return schema.superRefine((p, ctx) => {
    if (p.dataInicial > p.dataFinal) {
      ctx.addIssue({ code: "custom", message: "dataInicial depois de dataFinal" });
      return;
    }
    if (p.dataInicial.slice(0, 7) !== p.dataFinal.slice(0, 7)) {
      ctx.addIssue({
        code: "custom",
        message: "janela maior que um mês — a API do Portal recusa; fatie o intervalo em meses",
      });
      return;
    }
    const [ano, mes] = p.dataInicial.split("-").map(Number);
    if (!dentroDaJanela(fonte, ano, mes)) {
      ctx.addIssue({
        code: "custom",
        message: `fora da janela de disponibilidade da fonte (${fonte})`,
      });
    }
  }) as z.ZodType<T>;
}

/** O mês de uma janela do Portal, já validada como um mês só. */
export function mesDaJanelaDoPortal(p: { dataInicial: string; dataFinal: string }): {
  ano: number;
  mes: number;
} {
  const { ano, mes } = anoMesDaJanela(p.dataInicial, p.dataFinal);
  return { ano: ano ?? 0, mes: mes ?? 0 };
}

/** O Portal não informa o total da consulta: a contagem contra a origem não se aplica. */
export const semTotalDaOrigem = async () => null;

/**
 * Traduz a rodada da varredura do Portal (`varrerPaginado`) para a resposta
 * única. Os avisos `info:` voltam junto dos erros — a rota os separa.
 */
export function adaptarVarreduraDoPortal(r: SweepRodada, unidade: string): ResultadoAdaptado {
  return {
    importados: { [unidade]: r.processados },
    erros: [...r.erros, ...r.avisos],
    varredura: {
      haMais: r.haMais,
      cursor: r.cursor,
      totalAcumulado: r.totalAcumulado,
      orcamentoEsgotado: r.orcamentoEsgotado,
      custoEsgotado: false,
    },
    origem: null,
  };
}
