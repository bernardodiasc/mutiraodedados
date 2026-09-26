/**
 * Modo nomeado — proposições da Câmara. Janela natural: um ano de um tipo
 * (PL, PEC…). Total da origem: o header `X-Total-Count` da listagem. A
 * célula da cobertura é o ano (âncora `mes` 1), para todos os tipos; as
 * pendentes são por ano e tipo (`por-sigla.ts`).
 */
import type { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  chaveVarreduraProposicoes,
  importarProposicoesSchema,
  rodadaProposicoes,
  totalDaOrigemProposicoes,
} from "@/lib/data/camara/proposicoes.functions";
import { anoDentroDaJanela, type Adaptador } from "@/lib/data/automacao/adaptador";
import { pendentesPorSigla } from "@/lib/data/automacao/adaptadores/por-sigla";
import { TIPOS_PROPOSICAO_CAMARA } from "@/lib/data/siglas-legislativas";
import { textoDoErroDoBanco } from "@/lib/data/erros-banco";

type Params = z.infer<typeof importarProposicoesSchema>;

/** Proposições no cache do ano — a célula anual da cobertura. */
async function contarNaCelula(p: Params): Promise<number> {
  const { count, error, status } = await supabaseAdmin
    .from("camara_proposicoes_cache")
    .select("id", { count: "exact" })
    .eq("ano", p.ano)
    .limit(0);
  if (error)
    throw new Error(
      `conferência: contagem em camara_proposicoes_cache: ${textoDoErroDoBanco(error, status)}`,
    );
  return count ?? 0;
}

export const adaptadorProposicoes: Adaptador<Params> = {
  schema: anoDentroDaJanela(importarProposicoesSchema, "camara_props"),
  fonte: "camara_props",
  chave: chaveVarreduraProposicoes,
  // A célula é a do ano (âncora `mes` 1); ele só fecha em dezembro, e até lá
  // a origem ainda pode crescer.
  granularidade: "ano",
  // Cada tipo é uma linha própria: varredura, rodadas e conferência.
  escopo: (p) => p.siglaTipo,
  janela: (p) => ({ ano: p.ano, mes: 1 }),
  contarNaCelula,
  totalDaOrigem: totalDaOrigemProposicoes,
  descricao: (p) => `Câmara: proposições ${p.siglaTipo} de ${p.ano}`,
  unidades: ["proposicoes", "autores"],
  rodada: (p, origem) =>
    rodadaProposicoes(p, null, origem).then((r) => ({
      importados: { proposicoes: r.importados, autores: r.autores },
      erros: r.erros,
      varredura: r.varredura,
      origem: r.origem,
    })),
  pendentes: (params) =>
    pendentesPorSigla("camara_props", "siglaTipo", TIPOS_PROPOSICAO_CAMARA, params),
};
