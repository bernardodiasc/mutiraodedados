/**
 * Modo nomeado — matérias do Senado. Janela natural: um ano de uma sigla (a
 * origem devolve o ano inteiro numa chamada). Total da origem: o tamanho da
 * lista; os itens ilegíveis contam como descartados. A célula da cobertura é
 * o ano (âncora `mes` 1), para todas as siglas; as pendentes são por ano e
 * sigla (`por-sigla.ts`).
 */
import type { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  chaveVarreduraMaterias,
  importarMateriasSchema,
  rodadaMaterias,
  totalDaOrigemMaterias,
} from "@/lib/data/senado/materias.functions";
import { anoDentroDaJanela, type Adaptador } from "@/lib/data/automacao/adaptador";
import { pendentesPorSigla } from "@/lib/data/automacao/adaptadores/por-sigla";
import { SIGLAS_MATERIA_SENADO } from "@/lib/data/siglas-legislativas";
import { textoDoErroDoBanco } from "@/lib/data/erros-banco";

type Params = z.infer<typeof importarMateriasSchema>;

/** Matérias no cache do ano — a célula anual da cobertura. */
async function contarNaCelula(p: Params): Promise<number> {
  const { count, error, status } = await supabaseAdmin
    .from("senado_materias_cache")
    .select("id", { count: "exact" })
    .eq("ano", p.ano)
    .limit(0);
  if (error)
    throw new Error(
      `conferência: contagem em senado_materias_cache: ${textoDoErroDoBanco(error, status)}`,
    );
  return count ?? 0;
}

export const adaptadorMaterias: Adaptador<Params> = {
  schema: anoDentroDaJanela(importarMateriasSchema, "senado_mat"),
  fonte: "senado_mat",
  chave: chaveVarreduraMaterias,
  // A célula é a do ano (âncora `mes` 1); ele só fecha em dezembro, e até lá
  // a origem ainda pode crescer.
  granularidade: "ano",
  // Cada sigla é uma linha própria: varredura, rodadas e conferência.
  escopo: (p) => p.sigla,
  janela: (p) => ({ ano: p.ano, mes: 1 }),
  contarNaCelula,
  totalDaOrigem: totalDaOrigemMaterias,
  descricao: (p) => `Senado: matérias ${p.sigla} de ${p.ano}`,
  unidades: ["materias", "autores"],
  rodada: (p, origem) =>
    rodadaMaterias(p, null, origem).then((r) => ({
      importados: { materias: r.importados, autores: r.autores },
      erros: r.erros,
      varredura: r.varredura,
      origem: r.origem,
    })),
  pendentes: (params) => pendentesPorSigla("senado_mat", "sigla", SIGLAS_MATERIA_SENADO, params),
};
