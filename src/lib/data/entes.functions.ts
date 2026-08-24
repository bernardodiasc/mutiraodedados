import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { UF_NOMES, interpretarCodigoEnte } from "@/lib/ente/logic";

export type EnteResolvido = {
  tipo: "estado" | "municipio";
  nome: string;
  uf: string | null;
  /** Código IBGE — 2 dígitos para estado, 7 para município. */
  codIbge: string;
};

/**
 * Resolve o nome do ente da URL /entes/$codigo: estados pelo mapa fixo,
 * municípios pelo cadastro IBGE do acervo.
 */
export const obterEnte = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ codigo: z.string().min(2).max(10) }).parse(input))
  .handler(async ({ data }): Promise<EnteResolvido | null> => {
    const ente = interpretarCodigoEnte(data.codigo);
    if (!ente) return null;
    if (ente.tipo === "estado") {
      return { tipo: "estado", nome: UF_NOMES[ente.uf], uf: ente.uf, codIbge: ente.codIbge };
    }
    const { data: mun, error } = await supabaseAdmin
      .from("ibge_municipios_cache")
      .select("codigo,nome,uf")
      .eq("codigo", ente.ibge)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!mun) return null;
    return { tipo: "municipio", nome: mun.nome, uf: mun.uf, codIbge: mun.codigo };
  });
