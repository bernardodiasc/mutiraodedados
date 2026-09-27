/**
 * Diagnóstico de busca por coleção (aba "Busca" do /admin/dados), lógica
 * pura. O índice é mantido por gatilhos, então importado deveria implicar
 * indexado; o diagnóstico concilia as três contagens — cache, publicáveis
 * (o que a projeção devolve) e índice — e mostra a defasagem da importação
 * das fontes que alimentam a coleção.
 */
import { CATEGORIA_DA_COLECAO } from "@/lib/busca/desatualizadas";

/** Coleções com gatilho de índice: as das fontes do catálogo e as editoriais. */
export const COLECOES_DO_INDICE: readonly string[] = Object.keys(CATEGORIA_DA_COLECAO);

export type MedidasColecao = {
  cache: number | null;
  publicaveis: number | null;
  indice: number | null;
};

export type SituacaoColecao = "conciliada" | "faltam" | "sobram" | "indisponivel";

export type FonteDiagnostico = {
  titulo: string;
  ultima: string | null;
  defasagemDias: number | null;
  desatualizada: boolean;
};

export type LinhaDiagnostico = {
  colecao: string;
  medidas: MedidasColecao;
  /** índice − publicáveis; null quando alguma medida está indisponível. */
  diferenca: number | null;
  /** Linhas do cache que a projeção não publica (rascunho, dado pessoal…). */
  foraDaBusca: number | null;
  situacao: SituacaoColecao;
  fontes: FonteDiagnostico[];
  desatualizada: boolean;
};

export function linhaDiagnostico(
  entrada: {
    colecao: string;
    medidas: MedidasColecao;
    fontes: readonly { titulo: string; ultima: string | null; limiarDias: number }[];
  },
  agora: Date = new Date(),
): LinhaDiagnostico {
  const { cache, publicaveis, indice } = entrada.medidas;
  const diferenca = publicaveis !== null && indice !== null ? indice - publicaveis : null;
  const foraDaBusca = cache !== null && publicaveis !== null ? cache - publicaveis : null;
  const situacao: SituacaoColecao =
    diferenca === null
      ? "indisponivel"
      : diferenca === 0
        ? "conciliada"
        : diferenca < 0
          ? "faltam"
          : "sobram";
  const fontes = entrada.fontes.map((f) => {
    const defasagemDias = f.ultima
      ? Math.floor((agora.getTime() - new Date(f.ultima).getTime()) / 86_400_000)
      : null;
    return {
      titulo: f.titulo,
      ultima: f.ultima,
      defasagemDias,
      desatualizada: defasagemDias === null || defasagemDias > f.limiarDias,
    };
  });
  return {
    colecao: entrada.colecao,
    medidas: entrada.medidas,
    diferenca,
    foraDaBusca,
    situacao,
    fontes,
    desatualizada: fontes.some((f) => f.desatualizada),
  };
}

/** Ids do "reindexar recorte": separados por vírgula, espaço ou quebra de linha. */
export function lerIds(texto: string): string[] {
  return [...new Set(texto.split(/[\s,;]+/).filter(Boolean))];
}
