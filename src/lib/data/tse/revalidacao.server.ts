/**
 * Revalidação pontual via API DivulgaCandContas — server-only.
 *
 * Mesmo papel da conferência detalhe-por-contrato do Portal CGU: a API é a
 * fonte de verdade fresca para CONFIRMAR dados-chave do cache (situação de
 * totalização, existência de contas) antes de exibir/confirmar findings.
 * Nunca substitui a carga em massa do CKAN.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buscarCandidatoDivulga } from "@/lib/data/tse/client-api";
import { flagQA, type QaFinding } from "@/lib/data/qa";

export type RevalidacaoResultado = {
  encontradoNaApi: boolean;
  divergencias: string[];
  api: {
    nomeUrna: string | null;
    situacao: string | null;
    totalizacao: string | null;
    gastoCampanha: number | null;
  } | null;
  findingsRevalidados: number;
};

/** Normaliza rótulos para comparação tolerante ("ELEITO POR MÉDIA" ≈ "Eleito por média"). */
function rotuloComparavel(s: string | null | undefined): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

export async function revalidarCandidatoTse(
  sq: string,
  ano: number,
): Promise<RevalidacaoResultado> {
  const { data: cand, error } = await supabaseAdmin
    .from("tse_candidatos_cache")
    .select("sq_candidato, ano_eleicao, uf, municipio_cod, nome_urna, situacao_totalizacao")
    .eq("sq_candidato", sq)
    .eq("ano_eleicao", ano)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!cand) throw new Error(`Candidatura ${sq}/${ano} não está no cache.`);

  const ue = cand.municipio_cod ?? cand.uf ?? "";
  const api = await buscarCandidatoDivulga(ano, ue, sq);
  if (!api) {
    return { encontradoNaApi: false, divergencias: [], api: null, findingsRevalidados: 0 };
  }

  const divergencias: string[] = [];
  const totalizacaoApi =
    (api as { descricaoTotalizacao?: string | null }).descricaoTotalizacao ?? null;
  if (
    totalizacaoApi &&
    cand.situacao_totalizacao &&
    rotuloComparavel(totalizacaoApi) !== rotuloComparavel(cand.situacao_totalizacao)
  ) {
    divergencias.push(
      `situacao_totalizacao: cache="${cand.situacao_totalizacao}" api="${totalizacaoApi}"`,
    );
  }
  if (api.nomeUrna && rotuloComparavel(api.nomeUrna) !== rotuloComparavel(cand.nome_urna)) {
    divergencias.push(`nome_urna: cache="${cand.nome_urna}" api="${api.nomeUrna}"`);
  }

  // Divergência confirmada → alerta de qualidade (o dado do cache pode estar
  // defasado em relação à origem; nunca corrigimos automaticamente).
  if (divergencias.length > 0) {
    const finding: QaFinding = {
      fonte: "tse",
      entidade_tipo: "candidato",
      entidade_id: `${sq}-${ano}`,
      regra: "divergencia_api_csv",
      tipo: "qualidade",
      severidade: "aviso",
      detalhes: { sq_candidato: sq, ano_eleicao: ano, divergencias },
    };
    await flagQA([finding]);
  }

  // Reconciliação: marca findings abertos desta candidatura como revalidados.
  const { data: abertos } = await supabaseAdmin
    .from("qa_findings")
    .select("id")
    .eq("fonte", "tse")
    .eq("entidade_tipo", "candidato")
    .eq("entidade_id", `${sq}-${ano}`)
    .eq("status", "aberto");
  const agora = new Date().toISOString();
  for (const f of abertos ?? []) {
    await supabaseAdmin.from("qa_findings").update({ revalidado_em: agora }).eq("id", f.id);
  }

  return {
    encontradoNaApi: true,
    divergencias,
    api: {
      nomeUrna: api.nomeUrna ?? null,
      situacao: api.descricaoSituacao ?? null,
      totalizacao: totalizacaoApi,
      gastoCampanha: api.gastoCampanha1T ?? null,
    },
    findingsRevalidados: (abertos ?? []).length,
  };
}
