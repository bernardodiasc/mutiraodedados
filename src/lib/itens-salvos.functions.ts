import { createServerFn } from "@tanstack/react-start";
import { createHash } from "node:crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { serializarSnapshot } from "@/lib/itens-salvos/logic";
import {
  getConvenioCguPorId,
  getEmendaPorId,
  getLicitacaoPorId,
} from "@/lib/data/real/queries.functions";
import { getContratoPorId } from "@/lib/data/real/portal.functions";

// Tipos polimórficos que o caderno reconhece. Lista aberta — basta adicionar
// novos valores quando uma página passar a oferecer "Salvar no caderno".
export const TIPOS_ENTIDADE = [
  "pergunta",
  "orgao",
  "contrato",
  "fornecedor",
  "anomalia",
  "parlamentar",
  "convenio",
  "votacao",
  "proposicao",
  "materia",
  "lacuna",
  "artigo",
  "mapa",
  "tutorial",
  "prompt",
  "busca",
  "emenda",
  "licitacao",
] as const;

export type EntidadeTipo = (typeof TIPOS_ENTIDADE)[number];

export type ItemSalvo = {
  id: string;
  user_id: string;
  entidade_tipo: string;
  entidade_id: string;
  titulo: string;
  url: string | null;
  contexto: string | null;
  tags: string[];
  conteudo_snapshot: string | null;
  snapshot_em: string | null;
  snapshot_hash: string | null;
  snapshot_verificado_em: string | null;
  snapshot_divergiu_em: string | null;
  created_at: string;
  updated_at: string;
};

const COLS =
  "id, user_id, entidade_tipo, entidade_id, titulo, url, contexto, tags, conteudo_snapshot, snapshot_em, snapshot_hash, snapshot_verificado_em, snapshot_divergiu_em, created_at, updated_at";

function hashSnapshot(conteudo: string): string {
  return createHash("sha256").update(conteudo, "utf8").digest("hex");
}

const salvarSchema = z.object({
  entidade_tipo: z.enum(TIPOS_ENTIDADE),
  entidade_id: z.string().trim().min(1).max(200),
  titulo: z.string().trim().min(1).max(300),
  url: z.string().trim().max(500).optional().nullable(),
  contexto: z.string().trim().max(2000).optional().nullable(),
  tags: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
  // Snapshot canônico (serializarSnapshot) dos dados no momento do salvar.
  conteudo_snapshot: z.string().max(20000).optional().nullable(),
});

export const salvarItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => salvarSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const payload = {
      user_id: userId,
      entidade_tipo: data.entidade_tipo,
      entidade_id: data.entidade_id,
      titulo: data.titulo,
      url: data.url ?? null,
      contexto: data.contexto ?? null,
      tags: data.tags ?? [],
      ...(data.conteudo_snapshot
        ? {
            conteudo_snapshot: data.conteudo_snapshot,
            snapshot_hash: hashSnapshot(data.conteudo_snapshot),
            snapshot_em: new Date().toISOString(),
            snapshot_verificado_em: null,
            snapshot_divergiu_em: null,
          }
        : {}),
    };
    const { data: row, error } = await supabase
      .from("itens_salvos")
      .upsert(payload, { onConflict: "user_id,entidade_tipo,entidade_id" })
      .select(COLS)
      .single();
    if (error) {
      console.error("[salvarItem] erro", error);
      throw new Error(`Falha ao salvar item: ${error.message}`);
    }
    return row as ItemSalvo;
  });

export const listarMeusItens = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("itens_salvos")
      .select(COLS)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) {
      console.error("[listarMeusItens] erro", error);
      throw new Error(`Falha ao listar itens: ${error.message}`);
    }
    return (data ?? []) as ItemSalvo[];
  });

const verificarSchema = z.object({
  entidade_tipo: z.enum(TIPOS_ENTIDADE),
  entidade_id: z.string().trim().min(1).max(200),
});

export const verificarItemSalvo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => verificarSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("itens_salvos")
      .select("id")
      .eq("user_id", userId)
      .eq("entidade_tipo", data.entidade_tipo)
      .eq("entidade_id", data.entidade_id)
      .maybeSingle();
    if (error) {
      console.error("[verificarItemSalvo] erro", error);
      throw new Error(`Falha ao verificar item: ${error.message}`);
    }
    return { salvo: Boolean(row), id: row?.id ?? null };
  });

/**
 * Re-busca o dado ao vivo para um item salvo (dispatcher por tipo — só os
 * tipos com server fn de detalhe por id). null = registro sumiu da base.
 */
async function buscarDadoVivo(tipo: string, id: string): Promise<unknown | null> {
  switch (tipo) {
    case "contrato":
      return (await getContratoPorId({ data: { id } })).contrato;
    case "emenda":
      return (await getEmendaPorId({ data: { id } })).emenda;
    case "convenio":
      return (await getConvenioCguPorId({ data: { id } })).convenio;
    case "licitacao":
      return (await getLicitacaoPorId({ data: { id } })).licitacao;
    default:
      throw new Error("Verificação automática ainda não é suportada para este tipo de item.");
  }
}

const verificarSnapshotSchema = z.object({
  id: z.string().uuid(),
  // true = substitui o snapshot pelo dado ao vivo (perde o valor de prova antigo).
  substituir: z.boolean().optional(),
});

export const verificarSnapshotItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => verificarSnapshotSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: item, error } = await supabase
      .from("itens_salvos")
      .select(COLS)
      .eq("id", data.id)
      .single();
    if (error || !item) throw new Error("Item não encontrado.");

    const vivo = await buscarDadoVivo(item.entidade_tipo, item.entidade_id);
    const agora = new Date().toISOString();

    if (vivo == null) {
      // Registro desapareceu da base: divergência por definição; snapshot fica.
      const { data: row, error: errU } = await supabase
        .from("itens_salvos")
        .update({
          snapshot_verificado_em: agora,
          snapshot_divergiu_em: item.snapshot_divergiu_em ?? agora,
        })
        .eq("id", data.id)
        .select(COLS)
        .single();
      if (errU) throw new Error(`Falha ao registrar verificação: ${errU.message}`);
      return { mudou: true, encontrado: false, item: row as ItemSalvo };
    }

    // Mesmo truncamento do salvar (client) — senão registros >20k divergiriam sempre.
    const conteudoVivo = serializarSnapshot(vivo).slice(0, 20000);
    const hashVivo = hashSnapshot(conteudoVivo);
    const mudou = Boolean(item.snapshot_hash) && hashVivo !== item.snapshot_hash;

    const patch =
      data.substituir || !item.snapshot_hash
        ? {
            conteudo_snapshot: conteudoVivo,
            snapshot_hash: hashVivo,
            snapshot_em: agora,
            snapshot_verificado_em: agora,
            snapshot_divergiu_em: null,
          }
        : {
            snapshot_verificado_em: agora,
            snapshot_divergiu_em: mudou ? (item.snapshot_divergiu_em ?? agora) : null,
          };

    const { data: row, error: errU } = await supabase
      .from("itens_salvos")
      .update(patch)
      .eq("id", data.id)
      .select(COLS)
      .single();
    if (errU) throw new Error(`Falha ao atualizar snapshot: ${errU.message}`);
    return { mudou, encontrado: true, item: row as ItemSalvo };
  });

const excluirSchema = z.object({ id: z.string().uuid() });

export const excluirItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => excluirSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { error } = await supabase.from("itens_salvos").delete().eq("id", data.id);
    if (error) {
      console.error("[excluirItem] erro", error);
      throw new Error(`Falha ao excluir item: ${error.message}`);
    }
    return { ok: true };
  });