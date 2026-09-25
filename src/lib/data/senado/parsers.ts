/**
 * Parsers puros da fonte Senado (API legis.senado.leg.br).
 * Separados do ingest para serem testáveis sem I/O.
 */

/**
 * Valor monetário do Senado (ex.: `ValorReembolsado` do CEAPS, que a API
 * emite como string). Number JSON passa direto. String só perde os pontos
 * quando há vírgula decimal (pt-BR "1.234,56") ou quando é inequivocamente
 * milhar pt-BR ("1.234.567") — uma string decimal americana ("3000.00")
 * passa direta; antes virava 300000 (×100).
 */
export function parseValorSenado(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const s = String(v).trim();
  if (!s) return 0;
  const pareceMilharPtBr = /^-?\d{1,3}(\.\d{3})+$/.test(s);
  const normalizado = s.includes(",")
    ? s.replace(/\./g, "").replace(",", ".")
    : pareceMilharPtBr
      ? s.replace(/\./g, "")
      : s;
  const n = Number(normalizado);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Item de `GET /dadosabertos/votacao?v=2` (schema `sessaoVotacao`) — só os
 * campos que o importador usa. Substituto de `/plenario/lista/votacao`,
 * depreciado; os IDs (`codigoSessaoVotacao`) e os votos são os mesmos.
 */
export type SessaoVotacaoApi = {
  codigoSessaoVotacao?: number | null;
  dataSessao?: string | null;
  descricaoVotacao?: string | null;
  resultadoVotacao?: string | null;
  codigoMateria?: number | null;
  identificacao?: string | null;
  sigla?: string | null;
  votacaoSecreta?: string | null;
  totalVotosSim?: number | null;
  totalVotosNao?: number | null;
  totalVotosAbstencao?: number | null;
  votos?: VotoApi[] | null;
};

type VotoApi = {
  codigoParlamentar?: number | null;
  siglaPartidoParlamentar?: string | null;
  siglaUFParlamentar?: string | null;
  siglaVotoParlamentar?: string | null;
};

/**
 * Converte uma votação da API nas linhas de `senado_votacoes_cache` e
 * `senado_votos_cache` (sem `updated_at`). Devolve `null` sem código de
 * votação — não há chave para gravar.
 *
 * Placar: a API só preenche os totais em votação secreta (os votos
 * individuais vêm como "Votou"); em nominal aberta os totais são nulos e o
 * placar é contado dos votos — "Sim", "Não" e o restante (abstenção,
 * ausências, presidente) em outros. Na secreta, outros = abstenções.
 */
export function mapearVotacaoSenado(v: SessaoVotacaoApi) {
  if (v.codigoSessaoVotacao == null) return null;
  const id = String(v.codigoSessaoVotacao);
  const votos = v.votos ?? [];

  let placar: { sim: number; nao: number; outros: number };
  if (v.totalVotosSim != null || v.totalVotosNao != null) {
    placar = {
      sim: v.totalVotosSim ?? 0,
      nao: v.totalVotosNao ?? 0,
      outros: v.totalVotosAbstencao ?? 0,
    };
  } else {
    placar = { sim: 0, nao: 0, outros: 0 };
    for (const x of votos) {
      const t = (x.siglaVotoParlamentar ?? "").trim().toLowerCase();
      if (t === "sim") placar.sim++;
      else if (t === "não" || t === "nao") placar.nao++;
      else placar.outros++;
    }
  }

  return {
    votacao: {
      id,
      data:
        v.dataSessao && /^\d{4}-\d{2}-\d{2}/.test(v.dataSessao) ? v.dataSessao.slice(0, 10) : null,
      descricao: (v.descricaoVotacao ?? "").slice(0, 2000) || null,
      resultado: v.resultadoVotacao ?? null,
      materia_id: v.codigoMateria ?? null,
      materia_titulo: v.identificacao || v.sigla || null,
      sigla_orgao: "SF",
      votos_sim: placar.sim,
      votos_nao: placar.nao,
      votos_outros: placar.outros,
    },
    votos: votos
      .filter((x) => x.codigoParlamentar != null)
      .map((x) => ({
        votacao_id: id,
        senador_id: Number(x.codigoParlamentar),
        tipo_voto: (x.siglaVotoParlamentar ?? "—").slice(0, 40),
        sigla_partido: x.siglaPartidoParlamentar ?? null,
        sigla_uf: x.siglaUFParlamentar ?? null,
      })),
  };
}
