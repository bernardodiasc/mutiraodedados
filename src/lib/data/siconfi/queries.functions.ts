import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type SiconfiRow = {
  id: string;
  cod_ibge: string;
  esfera: string;
  uf: string | null;
  ente_nome: string;
  exercicio: number;
  periodo: number | null;
  tipo_relatorio: string;
  anexo: string | null;
  coluna: string | null;
  conta: string | null;
  valor: number;
};

export const listarRelatoriosSICONFI = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        codIbge: z.string().optional(),
        uf: z.string().length(2).optional(),
        exercicio: z.number().int().optional(),
        tipoRelatorio: z.string().optional(),
        q: z.string().max(120).optional(),
        limit: z.number().int().min(1).max(500).default(100),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    let q = supabaseAdmin
      .from("siconfi_relatorios_cache")
      .select("id,cod_ibge,esfera,uf,ente_nome,exercicio,periodo,tipo_relatorio,anexo,coluna,conta,valor")
      .order("exercicio", { ascending: false })
      .limit(data.limit);

    if (data.codIbge) q = q.eq("cod_ibge", data.codIbge);
    if (data.uf) q = q.eq("uf", data.uf.toUpperCase());
    if (data.exercicio) q = q.eq("exercicio", data.exercicio);
    if (data.tipoRelatorio) q = q.eq("tipo_relatorio", data.tipoRelatorio);
    if (data.q) q = q.ilike("conta", `%${data.q}%`);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { relatorios: (rows ?? []) as SiconfiRow[] };
  });