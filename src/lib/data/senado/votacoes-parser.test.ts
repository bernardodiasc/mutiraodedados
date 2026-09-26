import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  mapearVotacaoSenado,
  origemDaListaDeVotacoes,
  type SessaoVotacaoApi,
} from "@/lib/data/senado/parsers";

// Amostra real de GET /dadosabertos/votacao?v=2 (junho/2025): uma votação
// secreta (6944, totais preenchidos) e uma nominal aberta (6950, totais nulos).
const amostra = JSON.parse(
  readFileSync(join(__dirname, "__fixtures__", "votacao-2025-06.json"), "utf8"),
) as SessaoVotacaoApi[];
const porCodigo = (c: number) => amostra.find((v) => v.codigoSessaoVotacao === c)!;

describe("mapearVotacaoSenado — amostra real de /votacao", () => {
  it("nominal aberta: totais nulos na API, placar contado dos votos", () => {
    const bruta = porCodigo(6950);
    expect(bruta.totalVotosSim).toBeNull();
    const m = mapearVotacaoSenado(bruta)!;
    expect(m.votacao).toMatchObject({
      id: "6950",
      data: "2025-06-25",
      resultado: "A",
      materia_id: 169081,
      materia_titulo: "RQS 451/2025",
      sigla_orgao: "SF",
      votos_sim: 43,
      votos_nao: 30,
      votos_outros: 8,
    });
    expect(m.votos).toHaveLength(81);
  });

  it('secreta: placar vem dos totais da API, não dos votos "Votou"', () => {
    const m = mapearVotacaoSenado(porCodigo(6944))!;
    expect(m.votacao).toMatchObject({
      id: "6944",
      data: "2025-06-10",
      materia_id: 167958,
      materia_titulo: "MSF 6/2025",
      votos_sim: 40,
      votos_nao: 1,
      votos_outros: 1,
    });
    expect(m.votos.filter((x) => x.tipo_voto === "Votou")).toHaveLength(42);
  });

  it("votos individuais no formato de senado_votos_cache", () => {
    const m = mapearVotacaoSenado(porCodigo(6944))!;
    expect(m.votos).toContainEqual({
      votacao_id: "6944",
      senador_id: 5672,
      tipo_voto: "MIS",
      sigla_partido: "UNIÃO",
      sigla_uf: "AC",
    });
  });

  it("sem código de votação não há o que gravar", () => {
    expect(mapearVotacaoSenado({ ...porCodigo(6950), codigoSessaoVotacao: null })).toBeNull();
  });
});

describe("origemDaListaDeVotacoes — total da origem da janela", () => {
  it("o tamanho da lista é o total; sessão sem código é descartada", () => {
    const lista = [...amostra, { ...porCodigo(6950), codigoSessaoVotacao: null }];
    expect(origemDaListaDeVotacoes(lista)).toEqual({
      total: amostra.length + 1,
      descartados: 1,
    });
  });

  it("lista vazia: total zero", () => {
    expect(origemDaListaDeVotacoes([])).toEqual({ total: 0, descartados: 0 });
  });
});
