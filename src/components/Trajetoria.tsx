// Componentes compartilhados de situação/trajetória parlamentar, para que Câmara
// e Senado exibam a mesma linguagem visual (badges e linha do tempo idênticas).

export type TomSituacao = "ok" | "saida" | "alerta" | "neutro";

/** "2025-01-01T13:34" ou "2025-01-01" → "01/01/2025". */
export function fmtData(s: string | null | undefined): string {
  if (!s) return "—";
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
}

export function tomSituacao(s: string | null | undefined): TomSituacao {
  const v = (s ?? "").toLowerCase();
  // Ordem importa: "Nunca exerceu" e "Fora de exercício" contêm "exerc", então
  // precisam ser classificados antes do teste genérico de "exerc" lá embaixo.
  // "Nunca exerceu" (suplente que jamais assumiu) — cinza neutro, sem alarde.
  if (v.includes("nunca")) return "neutro";
  // Saída da cadeira (vermelho): fora de exercício, vacância, renúncia, falecimento.
  if (v.includes("vac") || v.includes("fora de") || v.includes("afast") || v.includes("renún") || v.includes("faleci"))
    return "saida";
  if (v.includes("licen") || v.includes("suplên") || v.includes("suplen") || v.includes("convoc")) return "alerta";
  if (v.includes("exerc")) return "ok";
  return "neutro";
}

const BADGE_TOM: Record<TomSituacao, string> = {
  ok: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  saida: "bg-destructive/10 text-destructive border-destructive/30",
  alerta: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
  neutro: "bg-muted text-muted-foreground border-border",
};
const DOT_TOM: Record<TomSituacao, string> = {
  ok: "bg-emerald-500",
  saida: "bg-destructive",
  alerta: "bg-amber-500",
  neutro: "bg-muted-foreground/40",
};

export function SituacaoBadge({ situacao, className = "" }: { situacao: string; className?: string }) {
  return (
    <span
      className={`inline-block rounded-md border px-2 py-0.5 text-[11px] font-medium ${BADGE_TOM[tomSituacao(situacao)]} ${className}`}
    >
      {situacao}
    </span>
  );
}

export type ItemTrajetoria = {
  data: string | null;
  /** Rótulo/etiqueta principal (vira badge + define a cor). */
  situacao: string | null;
  /** Linha pequena de contexto (legislatura · partido/UF, ou UF). */
  meta?: string | null;
  /** Complemento à direita do badge (condição eleitoral / participação). */
  detalhe?: string | null;
  /** Motivo/descrição do evento. */
  descricao?: string | null;
};

/** Linha do tempo vertical usada por deputados e senadores (mesma aparência). */
export function Trajetoria({ items }: { items: ItemTrajetoria[] }) {
  return (
    <ol className="mt-5">
      {items.map((e, i) => {
        const tom = tomSituacao(e.situacao);
        const ultimo = i === items.length - 1;
        return (
          <li key={i} className="flex gap-3">
            <div className="flex flex-col items-center pt-1">
              <span className={`size-2.5 rounded-full shrink-0 ${DOT_TOM[tom]}`} />
              {!ultimo && <span className="w-px flex-1 bg-border my-1" />}
            </div>
            <div className={ultimo ? "" : "pb-5"}>
              <div className="text-xs text-muted-foreground">
                {fmtData(e.data)}
                {e.meta ? ` · ${e.meta}` : ""}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {e.situacao && <SituacaoBadge situacao={e.situacao} />}
                {e.detalhe && <span className="text-xs text-muted-foreground">{e.detalhe}</span>}
              </div>
              {e.descricao && <div className="mt-1 text-sm">{e.descricao}</div>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
