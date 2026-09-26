/**
 * Modo nomeado — convênios por ente (`transferegov`), pelo endpoint
 * /convenios do Portal da Transparência.
 *
 * Janela natural: um mês (a API filtra pela data de referência e recusa
 * período maior). Sem ente, a janela é o mês do país inteiro — a linha única
 * da matriz de cobertura. Com ente (`codigoIbgeMunicipio` ou `codigoUF`), as
 * rodadas e a conferência ficam num escopo próprio (`municipio:<ibge>`,
 * `uf:<código>`), que a consulta de pendentes recebe em `params`.
 */
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { interpretarCodigoEnte } from "@/lib/ente/logic";
import {
  chaveVarreduraConveniosPorEnte,
  escopoDoEnte,
  importarConveniosPorEnteSchema,
  rodadaConveniosPorEnte,
  type ParamsConveniosPorEnte,
} from "@/lib/data/transferegov/ingest.functions";
import type { Adaptador } from "@/lib/data/automacao/nomeado";
import {
  janelaDeUmMesDoPortal,
  mesDaJanelaDoPortal,
  semTotalDaOrigem,
} from "@/lib/data/automacao/nomeado-portal";
import { textoDoErroDoBanco } from "@/lib/data/erros-banco";

/** O ente, validado: município (7 dígitos) ou UF (código IBGE), nunca os dois. */
const recorte = z
  .object({
    codigoIbgeMunicipio: z
      .string()
      .regex(/^\d{7}$/, "codigoIbgeMunicipio: código IBGE do município, 7 dígitos")
      .optional(),
    codigoUF: z
      .string()
      .refine((c) => /^\d{2}$/.test(c) && interpretarCodigoEnte(c)?.tipo === "estado", {
        message: "codigoUF: código IBGE da UF, 2 dígitos (ex.: 35)",
      })
      .optional(),
  })
  .refine((p) => !(p.codigoIbgeMunicipio && p.codigoUF), {
    message: "informe o município ou a UF, não os dois",
  });

const schema = janelaDeUmMesDoPortal(
  importarConveniosPorEnteSchema.superRefine((p, ctx) => {
    const r = recorte.safeParse({
      codigoIbgeMunicipio: p.codigoIbgeMunicipio,
      codigoUF: p.codigoUF,
    });
    if (!r.success) {
      for (const i of r.error.issues) ctx.addIssue({ code: "custom", message: i.message });
    }
  }) as z.ZodType<ParamsConveniosPorEnte>,
  "transferegov",
);

/**
 * Convênios da janela no cache: ano e mês de REFERÊNCIA — o mesmo calendário
 * em que a API filtra —, restritos ao ente quando há. A matriz de cobertura
 * desta fonte agrupa pela data de assinatura, que pode cair fora da janela
 * consultada; contar por ela reprovaria janelas que importaram certo.
 */
export async function contarConveniosNaCelula(p: ParamsConveniosPorEnte): Promise<number> {
  const { ano, mes } = mesDaJanelaDoPortal(p);
  let consulta = supabaseAdmin
    .from("convenios_cache")
    .select("id", { count: "exact" })
    .eq("ano", ano)
    .eq("mes_referencia", mes);
  if (p.codigoIbgeMunicipio) consulta = consulta.eq("municipio_ibge", p.codigoIbgeMunicipio);
  if (p.codigoUF) {
    const ente = interpretarCodigoEnte(p.codigoUF);
    if (ente?.tipo === "estado") consulta = consulta.eq("uf", ente.uf);
  }
  const { count, error, status } = await consulta.limit(0);
  if (error)
    throw new Error(
      `conferência: contagem em convenios_cache: ${textoDoErroDoBanco(error, status)}`,
    );
  return count ?? 0;
}

export const adaptadorConveniosPorEnte: Adaptador<ParamsConveniosPorEnte> = {
  schema,
  fonte: "transferegov",
  chave: chaveVarreduraConveniosPorEnte,
  escopo: escopoDoEnte,
  recorte,
  janela: mesDaJanelaDoPortal,
  contarNaCelula: contarConveniosNaCelula,
  totalDaOrigem: semTotalDaOrigem,
  descricao: (p) => {
    const ente = escopoDoEnte(p);
    return `Portal CGU: convênios de ${p.dataInicial} a ${p.dataFinal}${ente ? ` (${ente})` : ""}`;
  },
  unidades: ["convenios"],
  rodada: (p, origem) =>
    rodadaConveniosPorEnte(p, null, origem).then((r) => ({
      importados: { convenios: r.importados },
      erros: r.erros,
      varredura: r.varredura,
      origem: null,
    })),
};
