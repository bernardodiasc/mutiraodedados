import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Leitura pública dos relatórios fiscais (SICONFI / Tesouro Nacional).
 *
 * Contrato de listagem (kit src/lib/listagem): filtros + `ordem`
 * ("campo-direcao") + `ate` (corte de estabilidade) + limit/offset; resposta
 * com `total` real (count com os mesmos filtros) e `corteSugerido`. O corte é
 * aplicado sobre a data de domínio da lista — aqui o EXERCÍCIO do relatório
 * (granularidade anual): `exercicio <= ano do corte`.
 */

const hojeISO = () => new Date().toISOString().slice(0, 10);

const ateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional();

function ordenar<Q extends { order: (c: string, o: object) => Q }>(
  q: Q,
  ordem: string,
  colunas: Record<string, string>,
  padrao: string,
): Q {
  const [campo, dir] = ordem.includes("-")
    ? [ordem.slice(0, ordem.lastIndexOf("-")), ordem.slice(ordem.lastIndexOf("-") + 1)]
    : [ordem, "desc"];
  const coluna = colunas[campo] ?? colunas[padrao];
  return q.order(coluna, { ascending: dir === "asc", nullsFirst: false });
}

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
        ordem: z
          .enum(["exercicio-desc", "exercicio-asc", "valor-desc", "valor-asc"])
          .default("exercicio-desc"),
        ate: ateSchema,
        q: z.string().max(120).optional(),
        limit: z.number().int().min(1).max(500).default(100),
        offset: z.number().int().min(0).max(100000).default(0),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    let q = supabaseAdmin
      .from("siconfi_relatorios_cache")
      .select(
        "id,cod_ibge,esfera,uf,ente_nome,exercicio,periodo,tipo_relatorio,anexo,coluna,conta,valor",
        { count: "exact" },
      );
    q = ordenar(q, data.ordem, { exercicio: "exercicio", valor: "valor" }, "exercicio");
    // O período acompanha o exercício (mais recente primeiro no desc) e o id
    // desempata — página estável mesmo com muitas linhas do mesmo período.
    if (data.ordem.startsWith("exercicio")) {
      q = q.order("periodo", { ascending: data.ordem === "exercicio-asc", nullsFirst: false });
    }
    q = q.order("id", { ascending: true });
    q = q.range(data.offset, data.offset + data.limit - 1);

    // Relatórios têm granularidade anual — o corte vale por exercício.
    if (data.ate) q = q.lte("exercicio", Number(data.ate.slice(0, 4)));
    if (data.codIbge) q = q.eq("cod_ibge", data.codIbge);
    if (data.uf) q = q.eq("uf", data.uf.toUpperCase());
    if (data.exercicio) q = q.eq("exercicio", data.exercicio);
    if (data.tipoRelatorio) q = q.eq("tipo_relatorio", data.tipoRelatorio);
    if (data.q) q = q.ilike("conta", `%${data.q}%`);

    const { data: rows, error, count } = await q;
    if (error) throw new Error(error.message);
    return {
      relatorios: (rows ?? []) as SiconfiRow[],
      total: count ?? 0,
      corteSugerido: hojeISO(),
    };
  });
