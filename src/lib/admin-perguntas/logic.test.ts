import { describe, it, expect } from "vitest";
import type { PerguntaModelo } from "@/lib/pergunta-modelos.functions";
import type { Pergunta } from "@/lib/perguntas.functions";
import {
  draftFromModelo,
  draftFromPergunta,
  modeloDraftValido,
  modeloParaLinhaCsv,
  modeloParaTextoCopiavel,
  patchModelo,
  patchPergunta,
  payloadCriarModelo,
  perguntaEditValido,
  perguntaParaLinhaCsv,
  perguntaParaTextoCopiavel,
} from "./logic";

const modelo: PerguntaModelo = {
  id: "m1",
  titulo: "Quem mais recebeu emendas?",
  descricao: null,
  contexto: "Contexto do modelo.",
  tags: [],
  ordem: 3,
  ativo: true,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("modelo helpers", () => {
  it("linha csv traduz ativo e contexto", () => {
    const l = modeloParaLinhaCsv(modelo);
    expect(l.ativo).toBe("sim");
    expect(l.contexto).toBe("Contexto do modelo.");
  });
  it("texto copiável junta título e contexto", () => {
    expect(modeloParaTextoCopiavel(modelo)).toBe(
      "Quem mais recebeu emendas?\n\nContexto do modelo.",
    );
  });
  it("patch só inclui campos alterados", () => {
    const d = draftFromModelo(modelo);
    expect(patchModelo(modelo, d)).toEqual({});
    expect(patchModelo(modelo, { ...d, titulo: "Novo título" })).toEqual({ titulo: "Novo título" });
    expect(patchModelo(modelo, { ...d, contexto: "" })).toEqual({ contexto: null });
  });
  it("payloadCriarModelo limpa e converte vazio em null", () => {
    expect(payloadCriarModelo({ titulo: " T ", contexto: "  ", ordem: 2 })).toEqual({
      titulo: "T",
      contexto: null,
      ordem: 2,
    });
  });
  it("modeloDraftValido exige título >= 5", () => {
    expect(modeloDraftValido({ titulo: "abcde", contexto: "", ordem: 0 })).toBe(true);
    expect(modeloDraftValido({ titulo: "abc", contexto: "", ordem: 0 })).toBe(false);
  });
});

const pergunta: Pergunta = {
  id: "p1",
  user_id: "u1",
  modelo_id: null,
  titulo: "Investigação X",
  descricao: "Resumo",
  contexto: "Contexto",
  tags: ["emendas"],
  status: "publicada",
  visibilidade_publica: true,
  slug: "investigacao-x",
  publicada_em: "2026-02-02T00:00:00Z",
  arquivada_em: null,
  encerrada_em: null,
  solicitada_publicacao_em: null,
  motivo_rejeicao: null,
  ordem: 0,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("pergunta helpers", () => {
  it("linha csv achata tags e usa slug", () => {
    const l = perguntaParaLinhaCsv(pergunta);
    expect(l.slug).toBe("investigacao-x");
    expect(l.tags).toBe("emendas");
  });
  it("texto copiável inclui título, descrição e contexto", () => {
    expect(perguntaParaTextoCopiavel(pergunta)).toBe("# Investigação X\n\nResumo\n\nContexto");
  });
  it("patchPergunta só inclui campos alterados", () => {
    const d = draftFromPergunta(pergunta);
    expect(patchPergunta(pergunta, d)).toEqual({});
    expect(patchPergunta(pergunta, { ...d, titulo: "Outro título" })).toEqual({
      titulo: "Outro título",
    });
    expect(patchPergunta(pergunta, { ...d, descricao: "" })).toEqual({ descricao: null });
    // slug vazio não vira patch (evita apagar slug sem querer)
    expect(patchPergunta(pergunta, { ...d, slug: "" })).toEqual({});
  });
  it("perguntaEditValido exige título >= 5", () => {
    expect(perguntaEditValido({ titulo: "abcde", descricao: "", contexto: "", slug: "" })).toBe(
      true,
    );
    expect(perguntaEditValido({ titulo: "abc", descricao: "", contexto: "", slug: "" })).toBe(
      false,
    );
  });
});
