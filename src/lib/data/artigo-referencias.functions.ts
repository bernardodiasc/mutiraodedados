import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import type { ResumoBusca } from "@/lib/busca/consulta";
import { montarFiltrosSql } from "@/lib/busca/consulta";
import { filtrosDaSearch, validarBuscarSearch } from "@/lib/buscar/logic";
import {
  extrairLinksInternos,
  motivosDeRevisao,
  normalizarConsulta,
  type MotivoRevisao,
} from "@/lib/artigo-referencias/logic";
import { ensureAdmin } from "@/lib/data/real/sweep";

/**
 * Referências de artigo (admin): sugestões a partir dos links do texto,
 * cadastro, verificação e o cálculo de "necessita revisão". A resolução de uma
 * ficha usa o índice de busca: o link casa com o `href_interno` da linha.
 */

export type ReferenciaArtigo = {
  id: string;
  tipo: "registro" | "consulta";
  colecao: string | null;
  idOrigem: string | null;
  consultaUrl: string | null;
  rotulo: string | null;
  tituloCitado: string | null;
  verificadoEm: string | null;
  /** Destino atual do registro (do índice); null quando sumiu. */
  href: string | null;
  motivos: MotivoRevisao[];
};

export type SugestaoReferencia = {
  caminho: string;
  texto: string;
  situacao: "nova" | "ja_cadastrada" | "ambigua" | "nao_encontrada";
  tipo: "registro" | "consulta";
  colecao?: string;
  idOrigem?: string;
  consultaUrl?: string;
  titulo?: string;
  /** Candidatos quando o link casa com mais de um registro (ex.: contrato CGU e PNCP). */
  candidatos?: { colecao: string; idOrigem: string; titulo: string }[];
};

type LinhaRef = {
  id: string;
  artigo_id: string;
  tipo: string;
  colecao: string | null;
  id_origem: string | null;
  consulta_url: string | null;
  rotulo: string | null;
  titulo_citado: string | null;
  verificado_em: string | null;
  ordem: number;
};

type NoIndice = { titulo: string; href: string; atualizadoEm: string };

const ORCAMENTO_CONSULTA_MS = 3000;

/** As linhas do índice dos registros citados, por `colecao|id_origem`. */
async function registrosNoIndice(refs: LinhaRef[]): Promise<Map<string, NoIndice>> {
  const porColecao = new Map<string, string[]>();
  for (const r of refs) {
    if (r.tipo !== "registro" || !r.colecao || !r.id_origem) continue;
    porColecao.set(r.colecao, [...(porColecao.get(r.colecao) ?? []), r.id_origem]);
  }
  const out = new Map<string, NoIndice>();
  await Promise.all(
    [...porColecao].map(async ([colecao, ids]) => {
      const { data, error } = await supabaseAdmin
        .from("busca_indice")
        .select("id_origem, titulo, href_interno, atualizado_em")
        .eq("colecao", colecao)
        .in("id_origem", ids);
      if (error) throw new Error(`Falha ao ler o índice: ${error.message}`);
      for (const l of data ?? []) {
        out.set(`${colecao}|${l.id_origem}`, {
          titulo: l.titulo,
          href: l.href_interno,
          atualizadoEm: l.atualizado_em,
        });
      }
    }),
  );
  return out;
}

/** Total atual de uma consulta de /buscar; null quando não dá para contar a tempo. */
async function totalDaConsulta(consultaUrl: string): Promise<number | null> {
  const search = validarBuscarSearch(
    Object.fromEntries(new URLSearchParams(consultaUrl.split("?")[1] ?? "")),
  );
  if (!search.q) return null;
  let filtros: Json;
  try {
    filtros = montarFiltrosSql(filtrosDaSearch(search), search.tipo ?? null) as Json;
  } catch {
    return null;
  }
  const { data, error } = await supabaseAdmin
    .rpc("busca_resumo", { p_q: search.q, p_filtros: filtros, p_ate: null, p_contar: true })
    .abortSignal(AbortSignal.timeout(ORCAMENTO_CONSULTA_MS));
  if (error) return null;
  const resumo = data as unknown as ResumoBusca;
  const totais = resumo.categorias
    .filter((c) => !search.tipo || c.categoria === search.tipo)
    .map((c) => c.total);
  return totais.some((t) => t === null) ? null : totais.reduce<number>((s, t) => s + t!, 0);
}

async function lerReferencias(artigoId?: string): Promise<LinhaRef[]> {
  let q = supabaseAdmin
    .from("artigo_referencias")
    .select(
      "id, artigo_id, tipo, colecao, id_origem, consulta_url, rotulo, titulo_citado, verificado_em, ordem",
    );
  if (artigoId) q = q.eq("artigo_id", artigoId);
  const { data, error } = await q.order("ordem").order("created_at");
  if (error) throw new Error(`Falha ao ler as referências: ${error.message}`);
  return (data ?? []) as LinhaRef[];
}

async function comSituacao(refs: LinhaRef[]): Promise<ReferenciaArtigo[]> {
  const indice = await registrosNoIndice(refs);
  const consultas = new Map<string, number | null>();
  await Promise.all(
    [...new Set(refs.flatMap((r) => (r.consulta_url ? [r.consulta_url] : [])))].map(async (c) =>
      consultas.set(c, await totalDaConsulta(c)),
    ),
  );
  return refs.map((r) => {
    const noIndice = r.tipo === "registro" ? indice.get(`${r.colecao}|${r.id_origem}`) : undefined;
    const motivos =
      r.tipo === "registro"
        ? motivosDeRevisao({
            tipo: "registro",
            verificadoEm: r.verificado_em,
            noIndice: noIndice ? { atualizadoEm: noIndice.atualizadoEm } : null,
          })
        : motivosDeRevisao({
            tipo: "consulta",
            verificadoEm: r.verificado_em,
            total: consultas.get(r.consulta_url!) ?? null,
          });
    return {
      id: r.id,
      tipo: r.tipo as ReferenciaArtigo["tipo"],
      colecao: r.colecao,
      idOrigem: r.id_origem,
      consultaUrl: r.consulta_url,
      rotulo: r.rotulo,
      tituloCitado: r.titulo_citado,
      verificadoEm: r.verificado_em,
      href: r.tipo === "consulta" ? r.consulta_url : (noIndice?.href ?? null),
      motivos,
    };
  });
}

const artigoSchema = z.object({ artigoId: z.string().uuid() });

/** Admin — referências de um artigo, com o motivo de revisão de cada uma. */
export const referenciasDoArtigo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => artigoSchema.parse(d))
  .handler(async ({ data, context }): Promise<ReferenciaArtigo[]> => {
    await ensureAdmin(context.userId);
    return comSituacao(await lerReferencias(data.artigoId));
  });

/** Admin — artigos que pedem revisão, com a quantidade de referências afetadas. */
export const artigosComRevisao = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Record<string, number>> => {
    await ensureAdmin(context.userId);
    const refs = await lerReferencias();
    const situacao = await comSituacao(refs);
    const out: Record<string, number> = {};
    situacao.forEach((s, i) => {
      if (s.motivos.length) out[refs[i].artigo_id] = (out[refs[i].artigo_id] ?? 0) + 1;
    });
    return out;
  });

/**
 * Admin — sugestões de referência a partir dos links internos do texto do
 * artigo: fichas resolvidas pelo índice, consultas de /buscar normalizadas.
 */
export const sugerirReferencias = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => artigoSchema.parse(d))
  .handler(async ({ data, context }): Promise<SugestaoReferencia[]> => {
    await ensureAdmin(context.userId);
    const { data: artigo, error } = await supabaseAdmin
      .from("artigos")
      .select("conteudo_md")
      .eq("id", data.artigoId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const links = extrairLinksInternos(artigo?.conteudo_md ?? "");
    const existentes = await lerReferencias(data.artigoId);
    const temRegistro = new Set(existentes.map((r) => `${r.colecao}|${r.id_origem}`));
    const temConsulta = new Set(
      existentes.flatMap((r) => (r.consulta_url ? [r.consulta_url] : [])),
    );

    // Fichas: o link casa com o `href_interno` (como está no texto e decodificado).
    const fichas = links.filter((l) => !normalizarConsulta(l.caminho));
    const caminhos = [
      ...new Set(
        fichas.flatMap((l) => {
          const semBusca = l.caminho.split(/[?#]/)[0];
          let decodificado = semBusca;
          try {
            decodificado = decodeURIComponent(semBusca);
          } catch {
            /* caminho com % solto: fica como está */
          }
          return [semBusca, decodificado];
        }),
      ),
    ];
    const porHref = new Map<string, { colecao: string; idOrigem: string; titulo: string }[]>();
    if (caminhos.length) {
      const { data: linhas, error: e2 } = await supabaseAdmin
        .from("busca_indice")
        .select("colecao, id_origem, titulo, href_interno")
        .in("href_interno", caminhos);
      if (e2) throw new Error(e2.message);
      for (const l of linhas ?? []) {
        const lista = porHref.get(l.href_interno) ?? [];
        lista.push({ colecao: l.colecao, idOrigem: l.id_origem, titulo: l.titulo });
        porHref.set(l.href_interno, lista);
      }
    }

    return links.map((l): SugestaoReferencia => {
      const consultaUrl = normalizarConsulta(l.caminho);
      if (consultaUrl) {
        return {
          caminho: l.caminho,
          texto: l.texto,
          tipo: "consulta",
          consultaUrl,
          situacao: temConsulta.has(consultaUrl) ? "ja_cadastrada" : "nova",
        };
      }
      const semBusca = l.caminho.split(/[?#]/)[0];
      let decodificado = semBusca;
      try {
        decodificado = decodeURIComponent(semBusca);
      } catch {
        /* idem */
      }
      const candidatos = porHref.get(semBusca) ?? porHref.get(decodificado) ?? [];
      if (candidatos.length === 0) {
        return { caminho: l.caminho, texto: l.texto, tipo: "registro", situacao: "nao_encontrada" };
      }
      if (candidatos.length > 1) {
        return {
          caminho: l.caminho,
          texto: l.texto,
          tipo: "registro",
          situacao: "ambigua",
          candidatos,
        };
      }
      const [c] = candidatos;
      return {
        caminho: l.caminho,
        texto: l.texto,
        tipo: "registro",
        colecao: c.colecao,
        idOrigem: c.idOrigem,
        titulo: c.titulo,
        situacao: temRegistro.has(`${c.colecao}|${c.idOrigem}`) ? "ja_cadastrada" : "nova",
      };
    });
  });

const salvarSchema = z.discriminatedUnion("tipo", [
  z.object({
    artigoId: z.string().uuid(),
    tipo: z.literal("registro"),
    colecao: z.string().regex(/^[a-z_]{1,63}$/),
    idOrigem: z.string().trim().min(1).max(200),
    rotulo: z.string().trim().max(200).optional(),
  }),
  z.object({
    artigoId: z.string().uuid(),
    tipo: z.literal("consulta"),
    consultaUrl: z.string().trim().min(1).max(1000),
    rotulo: z.string().trim().max(200).optional(),
  }),
]);

/**
 * Admin — cadastra (ou confirma uma sugestão de) referência. Registra o título
 * atual do registro e a verificação neste momento.
 */
export const salvarReferencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => salvarSchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);
    const agora = new Date().toISOString();
    let linha;
    if (data.tipo === "consulta") {
      const consultaUrl = normalizarConsulta(data.consultaUrl);
      if (!consultaUrl) throw new Error("A consulta precisa ser um link de /buscar com termo.");
      linha = { tipo: "consulta", consulta_url: consultaUrl, titulo_citado: null };
    } else {
      const { data: noIndice } = await supabaseAdmin
        .from("busca_indice")
        .select("titulo")
        .eq("colecao", data.colecao)
        .eq("id_origem", data.idOrigem)
        .maybeSingle();
      linha = {
        tipo: "registro",
        colecao: data.colecao,
        id_origem: data.idOrigem,
        titulo_citado: noIndice?.titulo ?? null,
      };
    }
    const { count } = await supabaseAdmin
      .from("artigo_referencias")
      .select("id", { count: "exact", head: true })
      .eq("artigo_id", data.artigoId);
    const { error } = await supabaseAdmin.from("artigo_referencias").insert({
      artigo_id: data.artigoId,
      rotulo: data.rotulo || null,
      ordem: count ?? 0,
      verificado_em: agora,
      ...linha,
    });
    if (error) {
      throw new Error(
        error.code === "23505"
          ? "Esta referência já está cadastrada no artigo."
          : `Não foi possível salvar a referência: ${error.message}`,
      );
    }
    return { ok: true };
  });

const idSchema = z.object({ id: z.string().uuid() });

/** Admin — remove uma referência (o registro citado não é tocado). */
export const removerReferencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);
    const { error } = await supabaseAdmin.from("artigo_referencias").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Admin — "marcar como verificado": o autor conferiu o artigo contra o registro
 * ou a consulta atual. Atualiza o título citado; o texto do artigo não muda.
 */
export const verificarReferencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);
    const { data: ref, error } = await supabaseAdmin
      .from("artigo_referencias")
      .select("tipo, colecao, id_origem")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !ref) throw new Error(error?.message ?? "Referência não encontrada.");
    let titulo: string | null | undefined;
    if (ref.tipo === "registro") {
      const { data: noIndice } = await supabaseAdmin
        .from("busca_indice")
        .select("titulo")
        .eq("colecao", ref.colecao!)
        .eq("id_origem", ref.id_origem!)
        .maybeSingle();
      titulo = noIndice?.titulo ?? null;
    }
    const { error: e2 } = await supabaseAdmin
      .from("artigo_referencias")
      .update({
        verificado_em: new Date().toISOString(),
        ...(titulo !== undefined ? { titulo_citado: titulo } : {}),
      })
      .eq("id", data.id);
    if (e2) throw new Error(e2.message);
    return { ok: true };
  });
