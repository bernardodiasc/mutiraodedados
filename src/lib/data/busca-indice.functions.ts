import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import { CATEGORIAS_BUSCA, type CategoriaBuscaId } from "@/lib/busca/categorias";
import { LIMITE_EXPORTACAO } from "@/lib/buscar/acoes";
import { categoriasDesatualizadas, type Desatualizadas } from "@/lib/busca/desatualizadas";
import { CATALOGO_COBERTURA } from "@/lib/data/cobertura-catalogo";
import {
  FiltroIncompativelError,
  ITENS_BUSCA,
  ITENS_BUSCA_PADRAO,
  ORDENS_BUSCA,
  facetasDaCategoria,
  montarFiltrosSql,
  paginaPermitida,
  type ListaBusca,
  type OpcaoFaceta,
  type ResumoBusca,
} from "@/lib/busca/consulta";

/**
 * Consulta ao índice de busca (`busca_indice`) para a /buscar.
 *
 * Orçamento de tempo: a contagem completa (totais e facetas) tem 3 s. Se
 * estourar, a mesma consulta é repetida sem contagem — prévias ou página
 * sobre uma amostra, totais nulos e "contagem indisponível" na interface.
 * O banco ainda corta qualquer consulta em 8 s (tempo-limite da service_role).
 */

const ORCAMENTO_CONTAGEM_MS = 3000;

const categoriaIds = CATEGORIAS_BUSCA.map((c) => c.id) as [CategoriaBuscaId, ...CategoriaBuscaId[]];

const listaDeValores = z.array(z.string().trim().min(1).max(200)).max(50).optional();

const filtrosSchema = z
  .object({
    fonte: listaDeValores,
    uf: listaDeValores,
    ano: listaDeValores,
    especificas: z
      .record(z.string().regex(/^[a-z_]{1,40}$/), z.array(z.string().max(200)).max(50))
      .optional(),
  })
  .default({});

const baseSchema = z.object({
  q: z.string().trim().min(2).max(200),
  filtros: filtrosSchema,
  ate: z.string().datetime({ offset: true }).optional(),
});

const listaSchema = baseSchema.extend({
  categoria: z.enum(categoriaIds),
  ordem: z.enum(ORDENS_BUSCA).default("relevancia"),
  pagina: z.number().int().min(1).default(1),
  itens: z
    .number()
    .int()
    .refine((n) => (ITENS_BUSCA as readonly number[]).includes(n))
    .default(ITENS_BUSCA_PADRAO),
});

const opcoesSchema = baseSchema.extend({
  categoria: z.enum(categoriaIds),
  faceta: z.string().regex(/^[a-z_]{1,40}$/),
  termo: z.string().trim().max(100).default(""),
});

type ErroRpc = { code?: string; message?: string; details?: string | null; hint?: string | null };

/** Estourou o orçamento (requisição abortada) ou o tempo-limite do banco? */
function estourouTempo(erro: ErroRpc, sinal: AbortSignal): boolean {
  return sinal.aborted || erro.code === "57014" || /abort/i.test(erro.message ?? "");
}

function erroCidadao(contexto: string, erro: ErroRpc): Error {
  console.error(`[busca] ${contexto}`, erro);
  return new Error(`Não foi possível ${contexto} agora. Tente de novo em instantes.`);
}

function filtrosOuErro(filtros: z.infer<typeof filtrosSchema>, categoria: CategoriaBuscaId | null) {
  try {
    return montarFiltrosSql(filtros, categoria);
  } catch (e) {
    if (e instanceof FiltroIncompativelError) throw new Error(e.message);
    throw e;
  }
}

/**
 * Categorias com coleção desatualizada: fonte que alimenta o índice sem
 * conferência aprovada há mais que o limiar do catálogo. Uma chamada por
 * visita à /buscar, fora da consulta — falhar aqui não derruba a busca.
 */
export const desatualizadasBusca = createServerFn({ method: "GET" }).handler(
  async (): Promise<Desatualizadas> => {
    try {
      const fontes = await Promise.all(
        CATALOGO_COBERTURA.filter((e) => e.indice.length > 0).map(async (entrada) => {
          const { data, error } = await supabaseAdmin
            .from("importacoes")
            .select("consultado_em")
            .eq("fonte", entrada.fonteHistorico ?? entrada.id)
            .eq("conferencia->>estado", "aprovada")
            .order("consultado_em", { ascending: false })
            .limit(1);
          if (error) throw new Error(`${entrada.id}: ${error.message}`);
          return { entrada, ultima: data?.[0]?.consultado_em ?? null };
        }),
      );
      return categoriasDesatualizadas(fontes);
    } catch (e) {
      console.error("[busca] coleções desatualizadas:", (e as Error).message);
      return {};
    }
  },
);

export const resumoBusca = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => baseSchema.parse(input))
  .handler(async ({ data }): Promise<ResumoBusca> => {
    const args = {
      p_q: data.q,
      p_filtros: filtrosOuErro(data.filtros, null) as Json,
      p_ate: data.ate ?? null,
    };
    const sinal = AbortSignal.timeout(ORCAMENTO_CONTAGEM_MS);
    const completo = await supabaseAdmin
      .rpc("busca_resumo", { ...args, p_contar: true })
      .abortSignal(sinal);
    if (!completo.error) return completo.data as unknown as ResumoBusca;
    if (!estourouTempo(completo.error, sinal)) throw erroCidadao("fazer a busca", completo.error);

    const amostra = await supabaseAdmin.rpc("busca_resumo", { ...args, p_contar: false });
    if (amostra.error) throw erroCidadao("fazer a busca", amostra.error);
    return amostra.data as unknown as ResumoBusca;
  });

export const listaBusca = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => listaSchema.parse(input))
  .handler(async ({ data }): Promise<ListaBusca> => {
    if (!paginaPermitida(data.pagina, data.itens)) {
      throw new Error(
        "A navegação por páginas vai até o resultado 10.000. Refine os filtros ou exporte o resultado.",
      );
    }
    const args = {
      p_q: data.q,
      p_categoria: data.categoria,
      p_filtros: filtrosOuErro(data.filtros, data.categoria) as Json,
      p_ate: data.ate ?? null,
      p_ordem: data.ordem,
      p_pagina: data.pagina,
      p_itens: data.itens,
      p_facetas: facetasDaCategoria(data.categoria),
    };
    const sinal = AbortSignal.timeout(ORCAMENTO_CONTAGEM_MS);
    const completo = await supabaseAdmin
      .rpc("busca_lista", { ...args, p_contar: true })
      .abortSignal(sinal);
    if (!completo.error) return completo.data as unknown as ListaBusca;
    if (!estourouTempo(completo.error, sinal)) {
      throw erroCidadao("carregar esta página", completo.error);
    }

    const semContagem = await supabaseAdmin.rpc("busca_lista", { ...args, p_contar: false });
    if (semContagem.error) throw erroCidadao("carregar esta página", semContagem.error);
    return semContagem.data as unknown as ListaBusca;
  });

export const opcoesFacetaBusca = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => opcoesSchema.parse(input))
  .handler(async ({ data }): Promise<OpcaoFaceta[]> => {
    const { data: opcoes, error } = await supabaseAdmin.rpc("busca_opcoes_faceta", {
      p_q: data.q,
      p_categoria: data.categoria,
      p_faceta: data.faceta,
      p_termo: data.termo,
      p_filtros: filtrosOuErro(data.filtros, data.categoria) as Json,
      p_ate: data.ate ?? null,
    });
    if (error) throw erroCidadao("carregar as opções do filtro", error);
    return opcoes as unknown as OpcaoFaceta[];
  });

const exportarSchema = baseSchema.extend({
  categoria: z.enum(categoriaIds),
  ordem: z.enum(ORDENS_BUSCA).default("relevancia"),
  /** Corte obrigatório: a exportação precisa registrar o recorte exportado. */
  ate: z.string().datetime({ offset: true }),
});

/**
 * Conjunto completo de uma categoria para exportar: páginas de 100 no mesmo
 * corte, até LIMITE_EXPORTACAO itens. Acima disso, `truncado`; a exportação
 * integral grande fica para um job.
 */
export const exportarBusca = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => exportarSchema.parse(input))
  .handler(async ({ data }) => {
    const filtros = filtrosOuErro(data.filtros, data.categoria) as Json;
    const itens: ListaBusca["resultados"] = [];
    let total: number | null = null;
    let temMais = true;
    for (let pagina = 1; temMais && itens.length < LIMITE_EXPORTACAO; pagina++) {
      const { data: resposta, error } = await supabaseAdmin.rpc("busca_lista", {
        p_q: data.q,
        p_categoria: data.categoria,
        p_filtros: filtros,
        p_ate: data.ate,
        p_ordem: data.ordem,
        p_pagina: pagina,
        p_itens: 100,
        p_facetas: [],
        p_contar: pagina === 1,
      });
      if (error) throw erroCidadao("exportar esta busca", error);
      const lista = resposta as unknown as ListaBusca;
      if (pagina === 1) total = lista.total;
      itens.push(...lista.resultados);
      temMais = lista.temMais;
    }
    return {
      itens: itens.slice(0, LIMITE_EXPORTACAO),
      total,
      truncado: temMais || itens.length > LIMITE_EXPORTACAO,
    };
  });
