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
  return [...items].sort(
    (a, b) => a.ordem - b.ordem || a.created_at.localeCompare(b.created_at),
  );
}

export function filtrarPorAba(items: RoadmapItem[], aba: Aba): RoadmapItem[] {
  if (aba === "tudo") return items;
  return items.filter((i) => i.status === aba);
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