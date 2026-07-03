import type { RoadmapItem, RoadmapStatus } from "@/lib/data/roadmap.functions";

export type Aba = "tudo" | "concluido" | "em_andamento" | "planejado";

export const STATUS_LABEL: Record<RoadmapStatus, string> = {
  planejado: "Planejado",
  em_andamento: "Em andamento",
  concluido: "Concluído",
};

export type FormRoadmap = {
  titulo: string;
  descricao: string;
  status: RoadmapStatus;
  publico: boolean;
  notas: string;
  concluido_em: string;
};

export const FORM_INICIAL: FormRoadmap = {
  titulo: "",
  descricao: "",
  status: "planejado",
  publico: true,
  notas: "",
  concluido_em: "",
};

export function formFromItem(it: RoadmapItem): FormRoadmap {
  return {
    titulo: it.titulo,
    descricao: it.descricao ?? "",
    status: it.status,
    publico: it.publico,
    notas: it.notas ?? "",
    concluido_em: it.concluido_em ?? "",
  };
}

export function ordenarItens(items: RoadmapItem[]): RoadmapItem[] {
  return [...items].sort((a, b) => a.ordem - b.ordem || a.created_at.localeCompare(b.created_at));
}

/**
 * Ordenação dos concluídos (exceção à ordem global): por data de conclusão
 * decrescente — o mais recente primeiro — e, dentro do mesmo dia, pela ordem
 * manual. Vale igual para /admin/roadmap (aba Concluídos) e /roadmap público.
 */
export function ordenarConcluidos(items: RoadmapItem[]): RoadmapItem[] {
  return [...items].sort(
    (a, b) =>
      (b.concluido_em ?? "").localeCompare(a.concluido_em ?? "") ||
      a.ordem - b.ordem ||
      a.created_at.localeCompare(b.created_at),
  );
}

export function filtrarPorAba(items: RoadmapItem[], aba: Aba): RoadmapItem[] {
  if (aba === "tudo") return items;
  return items.filter((i) => i.status === aba);
}

/**
 * Itens visíveis de uma aba, já ordenados. `itensPorOrdem` deve vir de
 * `ordenarItens`. Concluídos usam a ordenação por data de conclusão.
 */
export function itensVisiveis(itensPorOrdem: RoadmapItem[], aba: Aba): RoadmapItem[] {
  if (aba === "concluido") {
    return ordenarConcluidos(itensPorOrdem.filter((i) => i.status === "concluido"));
  }
  return filtrarPorAba(itensPorOrdem, aba);
}

export function contarPorStatus(items: RoadmapItem[]) {
  return {
    tudo: items.length,
    em_andamento: items.filter((i) => i.status === "em_andamento").length,
    planejado: items.filter((i) => i.status === "planejado").length,
    concluido: items.filter((i) => i.status === "concluido").length,
  };
}

export function buildSavePayload(
  form: FormRoadmap,
  editing: RoadmapItem | null,
  totalItens: number,
) {
  const ordem = editing?.ordem ?? totalItens;
  return {
    ...(editing ? { id: editing.id } : {}),
    titulo: form.titulo.trim(),
    descricao: form.descricao.trim() || null,
    status: form.status,
    ordem,
    publico: form.publico,
    notas: form.notas.trim() || null,
    concluido_em: form.concluido_em || null,
  };
}

export function vizinhoParaTroca(
  sorted: RoadmapItem[],
  id: string,
  dir: -1 | 1,
): RoadmapItem | null {
  const idx = sorted.findIndex((x) => x.id === id);
  if (idx < 0) return null;
  return sorted[idx + dir] ?? null;
}

export type LinhaCsvRoadmap = {
  ordem: number;
  titulo: string;
  status: string;
  publico: string;
  concluido_em: string;
  descricao: string;
  notas: string;
  created_at: string;
  id: string;
};

export const CSV_COLUNAS_ROADMAP: (keyof LinhaCsvRoadmap)[] = [
  "ordem",
  "titulo",
  "status",
  "publico",
  "concluido_em",
  "descricao",
  "notas",
  "created_at",
  "id",
];

export function itemParaLinhaCsv(it: RoadmapItem): LinhaCsvRoadmap {
  return {
    ordem: it.ordem,
    titulo: it.titulo,
    status: STATUS_LABEL[it.status],
    publico: it.publico ? "sim" : "não",
    concluido_em: it.concluido_em ?? "",
    descricao: it.descricao ?? "",
    notas: it.notas ?? "",
    created_at: it.created_at,
    id: it.id,
  };
}

export function itensParaCsv(items: RoadmapItem[]): LinhaCsvRoadmap[] {
  return items.map(itemParaLinhaCsv);
}

/** Texto copiável de um item do roadmap (título, status, descrição e notas). */
export function itemParaTextoCopiavel(it: RoadmapItem): string {
  const partes: string[] = [`# ${it.titulo}`, "", `Status: ${STATUS_LABEL[it.status]}`];
  if (it.concluido_em) partes.push(`Concluído em: ${it.concluido_em}`);
  if (it.descricao) partes.push("", it.descricao);
  if (it.notas) partes.push("", `Notas internas: ${it.notas}`);
  return partes.join("\n");
}
