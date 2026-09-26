/**
 * Modo nomeado — um relatório do SICONFI (RREO, RGF ou DCA) de um ente. Janela
 * natural: o período do relatório (bimestre, quadrimestre, semestre; o DCA é
 * anual, sem período). Chamada única, sem varredura: sempre roda. A origem só
 * informa `hasMore`, então a contagem "não se aplica".
 *
 * A linha de rodada grava o tipo de relatório no `escopo`, o exercício e o
 * período em `ano`/`mes` (0 no DCA) — a célula da matriz de cobertura — e o
 * ente em `orgao_cod`. As pendentes são por ente e relatório: a consulta
 * exige `codIbge` e `tipoRelatorio`.
 */
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  importarRelatorioSICONFISchema,
  relatorioRecente,
  rodadaRelatorioSiconfi,
} from "@/lib/data/siconfi/ingest.functions";
import { familiaDoTipo, periodosDoTipo } from "@/lib/data/siconfi/consulta";
import { dentroDaJanelaAnual } from "@/lib/data/janelas";
import { janelasPendentesPorPeriodo } from "@/lib/data/automacao/conferencia";
import { lerConferencias } from "@/lib/data/automacao/conferencia.server";
import type { Adaptador } from "@/lib/data/automacao/adaptador";
import { textoDoErroDoBanco } from "@/lib/data/erros-banco";

type Params = z.infer<typeof importarRelatorioSICONFISchema>;

/** O período existe no tipo pedido e o exercício está na janela da fonte. */
const schema = importarRelatorioSICONFISchema.superRefine((p, ctx) => {
  const n = periodosDoTipo(p.tipoRelatorio);
  if (n === 0 && p.periodo !== undefined) {
    ctx.addIssue({ code: "custom", message: `${p.tipoRelatorio} é anual: não tem período` });
  }
  if (n > 0 && (p.periodo === undefined || p.periodo > n)) {
    ctx.addIssue({ code: "custom", message: `${p.tipoRelatorio} exige período de 1 a ${n}` });
  }
  if (!dentroDaJanelaAnual("siconfi", p.exercicio)) {
    ctx.addIssue({
      code: "custom",
      message: "fora da janela de disponibilidade da fonte (siconfi)",
    });
  }
}) as z.ZodType<Params>;

/** Linhas do relatório do ente no cache — a parte dele na célula da cobertura. */
async function contarNaCelula(p: Params): Promise<number> {
  let q = supabaseAdmin
    .from("siconfi_relatorios_cache")
    .select("id", { count: "exact" })
    .eq("cod_ibge", p.codIbge)
    .eq("exercicio", p.exercicio)
    .like("tipo_relatorio", `${familiaDoTipo(p.tipoRelatorio)}%`);
  q = p.periodo === undefined ? q.is("periodo", null) : q.eq("periodo", p.periodo);
  const { count, error, status } = await q.limit(0);
  if (error)
    throw new Error(
      `conferência: contagem em siconfi_relatorios_cache: ${textoDoErroDoBanco(error, status)}`,
    );
  return count ?? 0;
}

/** O que a consulta de pendentes precisa: o ente e o relatório. */
const pendentesSchema = importarRelatorioSICONFISchema.pick({ codIbge: true, tipoRelatorio: true });

export const adaptadorSiconfi: Adaptador<Params> = {
  schema,
  fonte: "siconfi",
  janela: (p) => ({ ano: p.exercicio, mes: p.periodo ?? 0 }),
  recente: relatorioRecente,
  contarNaCelula,
  descricao: (p) =>
    `SICONFI: ${p.tipoRelatorio} ${p.exercicio}${p.periodo ? `/${p.periodo}` : ""} do ente ${p.codIbge}`,
  unidades: ["linhas"],
  rodada: (p, origem) =>
    rodadaRelatorioSiconfi(p, null, origem).then((r) => ({
      importados: { linhas: r.importados },
      erros: r.aviso ? [...r.erros, `info: ${r.aviso}`] : r.erros,
      varredura: {
        haMais: false,
        cursor: null,
        totalAcumulado: r.importados,
        orcamentoEsgotado: false,
        custoEsgotado: false,
      },
      origem: null,
    })),
  pendentes: async (params) => {
    const q = pendentesSchema.safeParse(params);
    if (!q.success) {
      return { recusa: `siconfi_relatorio: ${z.prettifyError(q.error)}` };
    }
    const conferencias = await lerConferencias("siconfi", {
      orgaoCod: q.data.codIbge,
      escopoComeca: familiaDoTipo(q.data.tipoRelatorio),
    });
    return janelasPendentesPorPeriodo(
      "siconfi",
      periodosDoTipo(q.data.tipoRelatorio),
      conferencias,
    );
  },
};
