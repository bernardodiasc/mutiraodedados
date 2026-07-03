import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { portalGet, PORTAL_BASE } from "@/lib/data/real/portal-client";
import { ensureAdmin, sleep } from "@/lib/data/real/sweep";
import { codigosComDados } from "@/lib/data/status.functions";

/**
 * Catálogo de órgãos SIAFI-driven.
 *
 * Duas rotinas, expostas juntas por um botão no admin ("Sincronizar catálogo de
 * órgãos"):
 *
 * 1. `sincronizarOrgaosSIAFI` — pagina `/orgaos-siafi` e grava nome de cada
 *    código válido em `orgaos_cache` (fonte de nomes + picklist de import). NÃO
 *    decide ativo/extinto: o SIAFI congela e mantém códigos de órgãos extintos.
 *
 * 2. `verificarAtividadeOrgaos` — para cada órgão que aparece em documentos
 *    (contratos/licitações/convênios), sonda `/despesas/por-orgao` no ano
 *    corrente (e no anterior, por causa da defasagem de execução). Sem execução
 *    recente → `ativo = false` (extinto/inativo), mantendo a página histórica.
 */

const CODIGO_INVALIDO = "CODIGO INVALIDO";

type OrgaoSiafi = { codigo?: string; descricao?: string };

/** Remove o sufixo verboso "- Unidades com vínculo direto" das descrições SIAFI. */
function limparNomeSiafi(descricao: string): string {
  return descricao.replace(/\s*-\s*Unidades com vínculo direto\s*$/i, "").trim();
}

export const sincronizarOrgaosSIAFI = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        // Rede de segurança: o endpoint pagina em blocos de 15 e a varredura
        // completa leva centenas de páginas. Pausa curta entre páginas.
        maxPaginas: z.number().int().min(1).max(5000).default(5000),
        delayMs: z.number().int().min(0).max(2000).default(120),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);

    const consultadoEm = new Date().toISOString();
    const validos = new Map<string, string>(); // cod -> nome limpo
    let invalidos = 0;
    let totalBruto = 0;

    for (let pagina = 1; pagina <= data.maxPaginas; pagina++) {
      const lote = await portalGet<OrgaoSiafi[]>("/orgaos-siafi", { pagina: String(pagina) });
      if (!Array.isArray(lote) || lote.length === 0) break;
      totalBruto += lote.length;
      for (const item of lote) {
        const cod = (item.codigo ?? "").trim();
        const desc = (item.descricao ?? "").trim();
        if (!cod) continue;
        if (desc.toUpperCase().includes(CODIGO_INVALIDO)) {
          invalidos++;
          continue;
        }
        validos.set(cod, limparNomeSiafi(desc) || cod);
      }
      if (data.delayMs) await sleep(data.delayMs);
    }

    // Upsert só de {cod, nome}: em INSERT as demais colunas usam DEFAULT
    // (poder='executivo', ativo=true, disponivel_portal=true); em conflito só o
    // nome é atualizado — sigla/funcao/nota/ativo já preenchidos ficam intactos.
    const linhas = [...validos.entries()].map(([cod, nome]) => ({ cod, nome }));
    for (let i = 0; i < linhas.length; i += 500) {
      const chunk = linhas.slice(i, i + 500);
      const { error } = await supabaseAdmin.from("orgaos_cache").upsert(chunk, { onConflict: "cod" });
      if (error) throw new Error(`Falha ao gravar orgaos_cache: ${error.message}`);
    }

    await supabaseAdmin.from("importacoes").insert({
      fonte: "orgaos_siafi",
      escopo: "nomes",
      total_bruto: totalBruto,
      importados: linhas.length,
      consultado_em: consultadoEm,
      user_id: context.userId,
      endpoint: `GET ${PORTAL_BASE}/orgaos-siafi (paginação completa — ${invalidos} inválidos ignorados)`,
    });

    return { importados: linhas.length, invalidos, totalBruto };
  });

/** Há execução orçamentária do órgão `cod` no `ano`? Checa a árvore (orgaoSuperior) e o próprio órgão. */
async function temExecucao(cod: string, ano: number): Promise<boolean> {
  for (const filtro of ["orgaoSuperior", "orgao"] as const) {
    const r = await portalGet<unknown[]>("/despesas/por-orgao", {
      ano: String(ano),
      [filtro]: cod,
      pagina: "1",
    });
    if (Array.isArray(r) && r.length > 0) return true;
  }
  return false;
}

export const verificarAtividadeOrgaos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({ delayMs: z.number().int().min(0).max(2000).default(250) })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);

    const consultadoEm = new Date().toISOString();
    const anoAtual = new Date().getFullYear();
    // Janela: ano corrente e anterior. A execução tem defasagem no início do ano,
    // então "sem despesa no ano corrente" sozinho geraria falso-positivo de extinção.
    const anos = [anoAtual, anoAtual - 1];

    const codigos = await codigosComDados();
    let ativos = 0;
    let inativos = 0;

    for (const cod of codigos) {
      let anoComDespesa: number | null = null;
      for (const ano of anos) {
        if (await temExecucao(cod, ano)) {
          anoComDespesa = ano;
          break;
        }
        if (data.delayMs) await sleep(data.delayMs);
      }
      const ativo = anoComDespesa !== null;
      if (ativo) ativos++;
      else inativos++;

      const { error } = await supabaseAdmin
        .from("orgaos_cache")
        .update({
          ativo,
          ano_ultima_despesa: anoComDespesa,
          ultima_verificacao_atividade: consultadoEm,
        })
        .eq("cod", cod);
      // Órgão com dados mas ausente do catálogo (sync SIAFI não rodou / código
      // não listado): o update é no-op; o /orgaos ainda o mostra como "Órgão {cod}".
      if (error) throw new Error(`Falha ao atualizar atividade de ${cod}: ${error.message}`);
      if (data.delayMs) await sleep(data.delayMs);
    }

    await supabaseAdmin.from("importacoes").insert({
      fonte: "orgaos_siafi",
      escopo: "atividade",
      total_bruto: codigos.length,
      importados: ativos,
      consultado_em: consultadoEm,
      user_id: context.userId,
      endpoint: `GET ${PORTAL_BASE}/despesas/por-orgao?ano=${anos.join("|")}&orgaoSuperior=… (sonda de atividade; ${inativos} inativos)`,
    });

    return { verificados: codigos.length, ativos, inativos };
  });
