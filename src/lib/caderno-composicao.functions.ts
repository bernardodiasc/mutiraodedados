import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";
import type { PerguntaItem } from "@/lib/pergunta-itens.functions";
import { artigoParaTextoCopiavel } from "@/lib/admin-artigos/logic";
import {
  agruparParaComposicao,
  chaveSnapshot,
  montarTextoComposicao,
  slugDeUrlArtigo,
  type SnapshotResolvido,
} from "@/lib/caderno-composicao/logic";

function publicClient() {
  return createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

const schema = z.object({
  pergunta_id: z.string().uuid(),
  item_ids: z.array(z.string().uuid()).min(1).max(200),
});

/**
 * Monta o texto único da pasta ("copiar selecionados") a partir dos itens
 * marcados: procedimento (artigos internos) → dados coletados → prompts.
 * Conteúdo de artigos e prompts é resolvido aqui para o texto ir completo.
 */
export const montarComposicaoDaPasta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase } = context;

    const { data: pergunta, error: errP } = await supabase
      .from("perguntas")
      .select("titulo, contexto")
      .eq("id", data.pergunta_id)
      .single();
    if (errP || !pergunta) throw new Error("Pasta não encontrada.");

    const { data: itens, error: errI } = await supabase
      .from("pergunta_itens")
      .select("id, pergunta_id, user_id, tipo, ref_id, titulo, url, nota, ordem, created_at")
      .eq("pergunta_id", data.pergunta_id)
      .in("id", data.item_ids)
      .order("ordem", { ascending: true });
    if (errI) throw new Error(`Falha ao carregar itens: ${errI.message}`);
    const grupos = agruparParaComposicao((itens ?? []) as PerguntaItem[]);

    const anon = publicClient();

    const slugs = grupos.procedimentos
      .map((it) => slugDeUrlArtigo(it.url))
      .filter((s): s is string => Boolean(s));
    const artigosPorSlug = new Map<string, string>();
    if (slugs.length > 0) {
      const { data: artigos } = await anon
        .from("artigos")
        .select("slug, titulo, resumo, conteudo_md, fontes_usadas")
        .in("slug", slugs)
        .eq("publico", true);
      for (const a of artigos ?? []) {
        artigosPorSlug.set(a.slug, artigoParaTextoCopiavel(a));
      }
    }

    const promptIds = grupos.prompts.map((it) => it.ref_id).filter((r): r is string => Boolean(r));
    const promptsPorId = new Map<string, string>();
    if (promptIds.length > 0) {
      const { data: prompts } = await anon
        .from("prompt_modelos")
        .select("id, prompt_template")
        .in("id", promptIds);
      for (const p of prompts ?? []) {
        promptsPorId.set(p.id, p.prompt_template);
      }
    }

    // Enriquecimento: se o usuário também salvou a entidade no caderno (com
    // snapshot), os dados de prova entram na composição — RLS limita ao dono.
    const refIds = grupos.dados.map((it) => it.ref_id).filter((r): r is string => Boolean(r));
    const snapshotsPorItem = new Map<string, SnapshotResolvido>();
    if (refIds.length > 0) {
      const { data: salvos } = await supabase
        .from("itens_salvos")
        .select("entidade_tipo, entidade_id, conteudo_snapshot, snapshot_em")
        .in("entidade_id", refIds)
        .not("conteudo_snapshot", "is", null);
      for (const s of salvos ?? []) {
        snapshotsPorItem.set(chaveSnapshot(s.entidade_tipo, s.entidade_id), {
          conteudo: s.conteudo_snapshot as string,
          em: s.snapshot_em,
        });
      }
    }

    return {
      texto: montarTextoComposicao(pergunta, grupos, {
        artigosPorSlug,
        promptsPorId,
        snapshotsPorItem,
      }),
      itensIncluidos: (itens ?? []).length,
    };
  });
