import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { normalizarNomeParlamentar } from "@/lib/secao-vinculos/logic";

/**
 * Casa um nome de parlamentar (ex.: o campo `autor` de uma emenda, que a CGU
 * publica em caixa alta e sem acento) com os cadastros da Câmara e do Senado.
 *
 * Match SEMPRE por nome normalizado exato — e a UI marca o vínculo como
 * `inferido` (aviso de homônimo), nunca como link "limpo". Sem match, o
 * chamador mantém o texto puro.
 */

export type ParlamentarCasado = {
  tipo: "deputado" | "senador";
  id: string;
  nome: string;
  partido: string | null;
  uf: string | null;
};

export const casarAutorParlamentar = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ nome: z.string().min(3).max(200) }).parse(input))
  .handler(async ({ data }) => {
    const alvo = normalizarNomeParlamentar(data.nome);
    if (!alvo) return { parlamentares: [] as ParlamentarCasado[] };

    // Cadastros pequenos (513 + 81 por legislatura): compara em memória com
    // normalização — a origem publica sem acentos, os cadastros com.
    const [dep, sen] = await Promise.all([
      supabaseAdmin
        .from("camara_deputados_cache")
        .select("id,nome,nome_civil,sigla_partido,sigla_uf"),
      supabaseAdmin
        .from("senado_senadores_cache")
        .select("codigo_parlamentar,nome,nome_completo,sigla_partido,sigla_uf"),
    ]);

    const casados = new Map<string, ParlamentarCasado>();

    for (const d of dep.data ?? []) {
      const bate =
        normalizarNomeParlamentar(d.nome ?? "") === alvo ||
        normalizarNomeParlamentar(d.nome_civil ?? "") === alvo;
      if (bate && !casados.has(`deputado-${d.id}`)) {
        casados.set(`deputado-${d.id}`, {
          tipo: "deputado",
          id: String(d.id),
          nome: d.nome ?? data.nome,
          partido: d.sigla_partido,
          uf: d.sigla_uf,
        });
      }
    }
    for (const s of sen.data ?? []) {
      const bate =
        normalizarNomeParlamentar(s.nome ?? "") === alvo ||
        normalizarNomeParlamentar(s.nome_completo ?? "") === alvo;
      if (bate && !casados.has(`senador-${s.codigo_parlamentar}`)) {
        casados.set(`senador-${s.codigo_parlamentar}`, {
          tipo: "senador",
          id: String(s.codigo_parlamentar),
          nome: s.nome ?? data.nome,
          partido: s.sigla_partido,
          uf: s.sigla_uf,
        });
      }
    }

    return { parlamentares: [...casados.values()] };
  });
