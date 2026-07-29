/**
 * Ponte parlamentar ↔ candidato (tabela tse_parlamentar_candidato) — server-only.
 *
 * Prioridade de match (plano de integração TSE, Fase 2):
 *   1. CPF — a API da Câmara expõe o CPF no detalhe do deputado (confiança 1.0).
 *   2. Nome normalizado + UF (+ partido) — Senado não expõe CPF (0.75–0.9).
 * Matches com confiança < 0.8 entram na fila de revisão humana como finding
 * informativo em /admin/qualidade (regra `ponte_baixa_confianca`).
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { flagQA, type QaFinding } from "@/lib/data/qa";

const CAMARA_BASE = "https://dadosabertos.camara.leg.br/api/v2";
const UA = "MutiraoDeDados/1.0 (+https://mutiraodedados.com.br)";

/** Normaliza nome para comparação: caixa alta, sem acentos, espaços únicos. */
export function normalizarNome(nome: string | null | undefined): string {
  return (nome ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function cpfDoDeputado(id: number): Promise<string | null> {
  for (let tent = 0; tent < 3; tent++) {
    if (tent > 0) await new Promise((r) => setTimeout(r, 500 * 3 ** (tent - 1)));
    try {
      const res = await fetch(`${CAMARA_BASE}/deputados/${id}`, {
        headers: { accept: "application/json", "user-agent": UA },
      });
      if (res.status === 429 || res.status >= 500) continue;
      if (!res.ok) return null;
      const body = (await res.json()) as { dados?: { cpf?: string | null } };
      const cpf = (body.dados?.cpf ?? "").replace(/\D/g, "");
      return cpf.length === 11 ? cpf : null;
    } catch {
      // rede: tenta de novo
    }
  }
  return null;
}

type Candidatura = { sq_candidato: string; ano_eleicao: number };

type ResultadoMatch = {
  candidaturas: Candidatura[];
  metodo: "cpf" | "nome_uf_partido";
  confianca: number;
  cpf: string | null;
};

async function candidaturasPorCpf(cpf: string): Promise<Candidatura[]> {
  const { data } = await supabaseAdmin
    .from("tse_candidatos_cache")
    .select("sq_candidato, ano_eleicao")
    .eq("cpf", cpf);
  return data ?? [];
}

async function candidaturasPorNome(
  nome: string,
  uf: string | null,
  partido: string | null,
): Promise<{ candidaturas: Candidatura[]; confianca: number } | null> {
  const alvo = normalizarNome(nome);
  if (!alvo) return null;
  // Busca ampla por sobrenome + primeira palavra; refina em JS com o nome normalizado.
  const primeira = alvo.split(" ")[0];
  let q = supabaseAdmin
    .from("tse_candidatos_cache")
    .select("sq_candidato, ano_eleicao, nome_completo, nome_urna, uf, partido_sigla")
    .ilike("nome_completo", `%${primeira}%`)
    .limit(2000);
  if (uf) q = q.eq("uf", uf);
  const { data } = await q;
  const iguais = (data ?? []).filter(
    (c) => normalizarNome(c.nome_completo) === alvo || normalizarNome(c.nome_urna) === alvo,
  );
  if (iguais.length === 0) return null;
  const comPartido = partido
    ? iguais.filter((c) => (c.partido_sigla ?? "").toUpperCase() === partido.toUpperCase())
    : [];
  // Partido bate em ao menos uma eleição → confiança maior para o conjunto.
  const confianca = comPartido.length > 0 ? 0.9 : 0.75;
  return {
    candidaturas: iguais.map((c) => ({ sq_candidato: c.sq_candidato, ano_eleicao: c.ano_eleicao })),
    confianca,
  };
}

async function gravarVinculos(
  parlamentarTipo: "deputado" | "senador",
  parlamentarId: string,
  r: ResultadoMatch,
): Promise<number> {
  if (r.candidaturas.length === 0) return 0;
  const rows = r.candidaturas.map((c) => ({
    parlamentar_tipo: parlamentarTipo,
    parlamentar_id: parlamentarId,
    sq_candidato: c.sq_candidato,
    ano_eleicao: c.ano_eleicao,
    cpf: r.cpf,
    match_metodo: r.metodo,
    match_confianca: r.confianca,
    updated_at: new Date().toISOString(),
  }));
  const { error } = await supabaseAdmin.from("tse_parlamentar_candidato").upsert(rows);
  if (error) throw new Error(`tse_parlamentar_candidato: ${error.message}`);
  return rows.length;
}

export type PonteRodada = {
  processados: number;
  vinculados: number;
  semMatch: number;
  baixaConfianca: number;
  proximoOffset: number | null;
};

/**
 * Processa um lote de parlamentares (offset/limit) vinculando candidaturas.
 * Retomável pela UI via `proximoOffset` (padrão auto-continuar do admin).
 */
export async function sincronizarPonteParlamentar(
  casa: "camara" | "senado",
  offset: number,
  limit = 40,
): Promise<PonteRodada> {
  const findings: QaFinding[] = [];
  let processados = 0;
  let vinculados = 0;
  let semMatch = 0;
  let baixaConfianca = 0;

  if (casa === "camara") {
    const { data: deps, error } = await supabaseAdmin
      .from("camara_deputados_cache")
      .select("id, nome, nome_civil, sigla_uf, sigla_partido")
      .order("id")
      .range(offset, offset + limit - 1);
    if (error) throw new Error(error.message);
    for (const dep of deps ?? []) {
      processados++;
      const cpf = await cpfDoDeputado(dep.id);
      let resultado: ResultadoMatch | null = null;
      if (cpf) {
        const candidaturas = await candidaturasPorCpf(cpf);
        if (candidaturas.length > 0) resultado = { candidaturas, metodo: "cpf", confianca: 1, cpf };
      }
      if (!resultado) {
        const porNome = await candidaturasPorNome(
          dep.nome_civil ?? dep.nome,
          dep.sigla_uf,
          dep.sigla_partido,
        );
        if (porNome) {
          resultado = {
            candidaturas: porNome.candidaturas,
            metodo: "nome_uf_partido",
            confianca: porNome.confianca,
            cpf,
          };
        }
      }
      if (!resultado) {
        semMatch++;
        continue;
      }
      vinculados += await gravarVinculos("deputado", String(dep.id), resultado);
      if (resultado.confianca < 0.8) {
        baixaConfianca++;
        findings.push(
          findingBaixaConfianca("deputado", String(dep.id), dep.nome, resultado.confianca),
        );
      }
      await new Promise((r) => setTimeout(r, 150)); // gentileza com a API da Câmara
    }
    const proximoOffset = (deps ?? []).length === limit ? offset + limit : null;
    await flagQA(findings);
    return { processados, vinculados, semMatch, baixaConfianca, proximoOffset };
  }

  // Senado: sem CPF na API — só nome normalizado + UF + partido.
  const { data: sens, error } = await supabaseAdmin
    .from("senado_senadores_cache")
    .select("codigo_parlamentar, nome, nome_completo, sigla_uf, sigla_partido")
    .order("codigo_parlamentar")
    .range(offset, offset + limit - 1);
  if (error) throw new Error(error.message);
  for (const sen of sens ?? []) {
    processados++;
    const porNome = await candidaturasPorNome(
      sen.nome_completo ?? sen.nome,
      sen.sigla_uf,
      sen.sigla_partido,
    );
    if (!porNome) {
      semMatch++;
      continue;
    }
    const resultado: ResultadoMatch = {
      candidaturas: porNome.candidaturas,
      metodo: "nome_uf_partido",
      confianca: porNome.confianca,
      cpf: null,
    };
    vinculados += await gravarVinculos("senador", String(sen.codigo_parlamentar), resultado);
    if (resultado.confianca < 0.8) {
      baixaConfianca++;
      findings.push(
        findingBaixaConfianca(
          "senador",
          String(sen.codigo_parlamentar),
          sen.nome,
          resultado.confianca,
        ),
      );
    }
  }
  const proximoOffset = (sens ?? []).length === limit ? offset + limit : null;
  await flagQA(findings);
  return { processados, vinculados, semMatch, baixaConfianca, proximoOffset };
}

/** Fila de revisão humana (/admin/qualidade): vínculo derivado com confiança < 0.8. */
function findingBaixaConfianca(
  tipo: "deputado" | "senador",
  id: string,
  nome: string,
  confianca: number,
): QaFinding {
  return {
    fonte: "tse",
    entidade_tipo: "ponte_parlamentar",
    entidade_id: `${tipo}-${id}`,
    regra: "ponte_baixa_confianca",
    tipo: "qualidade",
    severidade: "info",
    detalhes: {
      parlamentar_tipo: tipo,
      parlamentar_id: id,
      nome,
      match_confianca: confianca,
      motivo:
        "vínculo parlamentar↔candidato derivado por nome/UF (sem CPF); revisar em tse_parlamentar_candidato",
    },
  };
}
