import { describe, expect, it } from "vitest";
import {
  lacunasCandidatoSemBens,
  lacunasEleitoSemContas,
  lacunasParlamentarSemMatch,
  lacunasSerieHistorica,
} from "@/lib/data/tse/lacunas";
import type { QaFinding } from "@/lib/data/qa";

const eleitoBase = {
  sqCandidato: "123",
  ano: 2022,
  uf: "SP",
  nomeUrna: "FULANO",
  cargoNome: "Deputado Federal",
};

function todasAsLacunas(): QaFinding[] {
  return [
    ...lacunasEleitoSemContas([
      { ...eleitoBase, gastoNaApi: null },
      { ...eleitoBase, sqCandidato: "456", gastoNaApi: 5000 },
    ]),
    ...lacunasCandidatoSemBens([eleitoBase]),
    ...lacunasSerieHistorica([
      { ano: 2022, uf: "SP", candidatos: 100, varreduraCompleta: true, varreduraIniciada: true },
      { ano: 2022, uf: "AC", candidatos: 0, varreduraCompleta: true, varreduraIniciada: true },
      { ano: 2022, uf: "RR", candidatos: 0, varreduraCompleta: false, varreduraIniciada: true },
    ]),
    ...lacunasParlamentarSemMatch([{ tipo: "deputado", id: "999", nome: "BELTRANO" }]),
  ];
}

describe("guarda de taxonomia — lacunas TSE", () => {
  it("nenhuma regra de lacunas.ts emite tipo 'investigativo'", () => {
    for (const f of todasAsLacunas()) {
      expect(f.tipo).not.toBe("investigativo");
      expect(["lacuna", "qualidade"]).toContain(f.tipo);
    }
  });

  it("toda lacuna declara tipo explícito e fonte 'tse'", () => {
    for (const f of todasAsLacunas()) {
      expect(f.tipo).toBeDefined();
      expect(f.fonte).toBe("tse");
    }
  });
});

describe("lacunasEleitoSemContas (regra híbrida)", () => {
  it("sem gasto na API → lacuna na origem", () => {
    const [f] = lacunasEleitoSemContas([{ ...eleitoBase, gastoNaApi: null }]);
    expect(f.tipo).toBe("lacuna");
    expect(f.detalhes?.causa).toBe("ausencia_na_origem");
  });

  it("gasto na API que não temos → qualidade (falha nossa de importação)", () => {
    const [f] = lacunasEleitoSemContas([{ ...eleitoBase, gastoNaApi: 12345 }]);
    expect(f.tipo).toBe("qualidade");
    expect(f.detalhes?.causa).toBe("importacao_incompleta");
  });

  it("gasto zero na API conta como ausência na origem", () => {
    const [f] = lacunasEleitoSemContas([{ ...eleitoBase, gastoNaApi: 0 }]);
    expect(f.tipo).toBe("lacuna");
  });
});

describe("lacunasCandidatoSemBens", () => {
  it("gera lacuna 'info' com a chave <sq>-<ano>", () => {
    const [f] = lacunasCandidatoSemBens([eleitoBase]);
    expect(f).toMatchObject({
      regra: "candidato_sem_bens",
      tipo: "lacuna",
      severidade: "info",
      entidade_id: "123-2022",
    });
  });
});

describe("lacunasSerieHistorica (regra híbrida)", () => {
  it("varredura completa e zero candidatos → lacuna info; incompleta → qualidade aviso", () => {
    const fs = lacunasSerieHistorica([
      { ano: 2022, uf: "SP", candidatos: 100, varreduraCompleta: true, varreduraIniciada: true },
      { ano: 2022, uf: "AC", candidatos: 0, varreduraCompleta: true, varreduraIniciada: true },
      { ano: 2022, uf: "RR", candidatos: 0, varreduraCompleta: false, varreduraIniciada: true },
    ]);
    const ac = fs.find((f) => f.entidade_id === "candidatos-2022-AC");
    const rr = fs.find((f) => f.entidade_id === "candidatos-2022-RR");
    expect(ac).toMatchObject({ tipo: "lacuna", severidade: "info" });
    expect(rr).toMatchObject({ tipo: "qualidade", severidade: "aviso" });
  });

  it("ano sem nenhuma UF importada é backlog, não lacuna", () => {
    const fs = lacunasSerieHistorica([
      { ano: 2018, uf: "SP", candidatos: 0, varreduraCompleta: false, varreduraIniciada: false },
      { ano: 2018, uf: "AC", candidatos: 0, varreduraCompleta: false, varreduraIniciada: false },
    ]);
    expect(fs).toEqual([]);
  });
});

describe("lacunasParlamentarSemMatch", () => {
  it("gera lacuna aviso por parlamentar sem candidatura vinculada", () => {
    const [f] = lacunasParlamentarSemMatch([{ tipo: "senador", id: "42", nome: "SICRANO" }]);
    expect(f).toMatchObject({
      regra: "parlamentar_sem_match",
      tipo: "lacuna",
      severidade: "aviso",
      entidade_id: "senador-42",
    });
  });
});
