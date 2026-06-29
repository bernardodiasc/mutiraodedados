import * as React from "react";
import {
  GitBranch,
  Brain,
  Dice5,
  HelpCircle,
  RotateCcw,
  Scale,
  Layers,
  type LucideIcon,
} from "lucide-react";

export type ModoLeituraKey =
  | "causal"
  | "epistemologica"
  | "probabilistica"
  | "hipotetica"
  | "contrafactual"
  | "dialetica"
  | "integrativa";

const MODOS: Record<ModoLeituraKey, { label: string; icon: LucideIcon; resumo: string }> = {
  causal: {
    label: "Causal",
    icon: GitBranch,
    resumo: "O que provavelmente levou a este resultado?",
  },
  epistemologica: {
    label: "Epistemológica",
    icon: Brain,
    resumo: "Como sabemos disto? Qual a qualidade da evidência?",
  },
  probabilistica: {
    label: "Probabilística",
    icon: Dice5,
    resumo: "Quão provável é cada explicação possível?",
  },
  hipotetica: {
    label: "Hipotética",
    icon: HelpCircle,
    resumo: "Que hipóteses concorrem para explicar o caso?",
  },
  contrafactual: {
    label: "Contrafactual",
    icon: RotateCcw,
    resumo: "Como seria se a decisão tivesse sido outra?",
  },
  dialetica: {
    label: "Dialética",
    icon: Scale,
    resumo: "Quais visões contrárias merecem peso?",
  },
  integrativa: {
    label: "Integrativa",
    icon: Layers,
    resumo: "Como essas leituras se combinam num quadro coerente?",
  },
};

export type LeituraTexto = Partial<Record<ModoLeituraKey, string>>;

/**
 * Painel "Modos de leitura" — curado, sem IA.
 * Cada leitura é um parágrafo curto fornecido por quem escreve a página.
 */
export function PainelModosLeitura({
  leituras,
  titulo = "Modos de leitura",
}: {
  leituras: LeituraTexto;
  titulo?: string;
}) {
  const chaves = (Object.keys(leituras) as ModoLeituraKey[]).filter((k) => leituras[k]);
  const [ativo, setAtivo] = React.useState<ModoLeituraKey | null>(chaves[0] ?? null);
  if (chaves.length === 0) return null;
  const Atual = ativo ? MODOS[ativo] : null;

  return (
    <section className="border border-border rounded-xl bg-card p-5">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {titulo}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {chaves.map((k) => {
          const M = MODOS[k];
          const isActive = k === ativo;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setAtivo(k)}
              className={
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition " +
                (isActive
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border hover:border-accent/60")
              }
              aria-pressed={isActive}
            >
              <M.icon className="size-3.5" />
              {M.label}
            </button>
          );
        })}
      </div>
      {Atual && ativo ? (
        <div className="mt-4">
          <div className="text-xs text-muted-foreground italic">{Atual.resumo}</div>
          <p className="text-sm leading-relaxed mt-2 whitespace-pre-line">
            {leituras[ativo]}
          </p>
        </div>
      ) : null}
      <p className="text-[11px] text-muted-foreground mt-4">
        Curadoria editorial. Sem motor automático: cada parágrafo é escrito e revisado por humanos.
      </p>
    </section>
  );
}