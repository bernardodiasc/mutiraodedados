import type { PromptModelo } from "@/lib/prompt-modelos.functions";

/* ── Formulário (criar/editar) ───────────────────────────────────────────── */

export type VariavelForm = { nome: string; dica: string; href: string; hrefLabel: string };

export type FormPrompt = {
  titulo: string;
  descricao: string;
  prompt_template: string;
  variaveis: VariavelForm[];
  tags: string;
  ordem: number;
};

export const FORM_VAZIO: FormPrompt = {
  titulo: "",
  descricao: "",
  prompt_template: "",
  variaveis: [],
  tags: "",
  ordem: 0,
};

/** Separa "a, b, c" em array limpo. */
export function splitLista(s: string): string[] {
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

/** Aceita o formato legado (string) ou estruturado (objeto) vindo do banco. */
export function variavelDoBanco(v: unknown): VariavelForm {
  if (typeof v === "string") return { nome: v, dica: "", href: "", hrefLabel: "" };
  const o = (v ?? {}) as Record<string, unknown>;
  return {
    nome: String(o.nome ?? ""),
    dica: String(o.dica ?? ""),
    href: String(o.href ?? ""),
    hrefLabel: String(o.hrefLabel ?? ""),
  };
}

export function formFromPrompt(p: PromptModelo): FormPrompt {
  return {
    titulo: p.titulo,
    descricao: p.descricao ?? "",
    prompt_template: p.prompt_template,
    variaveis: (p.variaveis ?? []).map(variavelDoBanco),
    tags: p.tags.join(", "),
    ordem: p.ordem,
  };
}

export type PromptPayload = {
  titulo: string;
  descricao: string | null;
  prompt_template: string;
  variaveis: { nome: string; dica: string | null; href: string | null; hrefLabel: string | null }[];
  tags: string[];
  ordem: number;
};

export function payloadDoForm(f: FormPrompt): PromptPayload {
  return {
    titulo: f.titulo.trim(),
    descricao: f.descricao.trim() || null,
    prompt_template: f.prompt_template.trim(),
    variaveis: f.variaveis
      .filter((v) => v.nome.trim())
      .map((v) => ({
        nome: v.nome.trim(),
        dica: v.dica.trim() || null,
        href: v.href.trim() || null,
        hrefLabel: v.hrefLabel.trim() || null,
      })),
    tags: splitLista(f.tags),
    ordem: f.ordem,
  };
}

/** Regras mínimas para habilitar salvar: título >= 5 e template >= 10. */
export function formPromptValido(f: FormPrompt): boolean {
  return f.titulo.trim().length >= 5 && f.prompt_template.trim().length >= 10;
}

const VAR_VAZIA: VariavelForm = { nome: "", dica: "", href: "", hrefLabel: "" };

export function comVariavelAdicionada(f: FormPrompt): FormPrompt {
  return { ...f, variaveis: [...f.variaveis, { ...VAR_VAZIA }] };
}

export function comVariavelRemovida(f: FormPrompt, i: number): FormPrompt {
  return { ...f, variaveis: f.variaveis.filter((_, idx) => idx !== i) };
}

export function comVariavelAtualizada(
  f: FormPrompt,
  i: number,
  patch: Partial<VariavelForm>,
): FormPrompt {
  return { ...f, variaveis: f.variaveis.map((v, idx) => (idx === i ? { ...v, ...patch } : v)) };
}

/* ── Filtros ──────────────────────────────────────────────────────────────── */

export type AbaPrompt = "tudo" | "ativos" | "inativos";

export function filtrarPrompts(prompts: PromptModelo[], aba: AbaPrompt): PromptModelo[] {
  if (aba === "ativos") return prompts.filter((p) => p.ativo);
  if (aba === "inativos") return prompts.filter((p) => !p.ativo);
  return prompts;
}

export function contarPrompts(prompts: PromptModelo[]) {
  return {
    tudo: prompts.length,
    ativos: prompts.filter((p) => p.ativo).length,
    inativos: prompts.filter((p) => !p.ativo).length,
  };
}

export type LinhaCsvPrompt = {
  ordem: number;
  titulo: string;
  ativo: string;
  descricao: string;
  variaveis: string;
  tags: string;
  prompt_template: string;
  created_at: string;
  id: string;
};

export const CSV_COLUNAS_PROMPT: (keyof LinhaCsvPrompt)[] = [
  "ordem",
  "titulo",
  "ativo",
  "descricao",
  "variaveis",
  "tags",
  "prompt_template",
  "created_at",
  "id",
];

/** Aceita o formato legado (string) ou estruturado (objeto) da variável. */
function nomeVariavel(v: unknown): string {
  if (typeof v === "string") return v;
  const o = (v ?? {}) as Record<string, unknown>;
  return String(o.nome ?? "");
}

export function promptParaLinhaCsv(p: PromptModelo): LinhaCsvPrompt {
  return {
    ordem: p.ordem,
    titulo: p.titulo,
    ativo: p.ativo ? "sim" : "não",
    descricao: p.descricao ?? "",
    variaveis: (p.variaveis ?? []).map(nomeVariavel).filter(Boolean).join(" | "),
    tags: (p.tags ?? []).join(" | "),
    prompt_template: p.prompt_template,
    created_at: p.created_at,
    id: p.id,
  };
}

export function promptsParaCsv(items: PromptModelo[]): LinhaCsvPrompt[] {
  return items.map(promptParaLinhaCsv);
}

/** Texto copiável de um prompt: descrição como comentário + template pronto para colar. */
export function promptParaTextoCopiavel(p: PromptModelo): string {
  const partes: string[] = [];
  if (p.descricao) partes.push(p.descricao, "");
  partes.push(p.prompt_template);
  return partes.join("\n");
}
