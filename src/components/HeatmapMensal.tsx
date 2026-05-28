import type { Contrato } from "@/lib/data/types";
import { fmtBRL } from "@/lib/fmt";

const MESES = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];

export function HeatmapMensal({ contratos }: { contratos: Contrato[] }) {
  // map ano -> mes -> valor
  const map = new Map<number, number[]>();
  let max = 0;
  for (const c of contratos) {
    if (!c.dataAssinatura) continue;
    const d = new Date(c.dataAssinatura);
    const ano = d.getFullYear();
    const mes = d.getMonth();
    if (!map.has(ano)) map.set(ano, Array(12).fill(0));
    const arr = map.get(ano)!;
    arr[mes] += c.valor;
    if (arr[mes] > max) max = arr[mes];
  }
  const anos = [...map.keys()].sort();
  if (anos.length === 0 || max === 0) {
    return <div className="text-sm text-muted-foreground">Sem dados suficientes para o heatmap.</div>;
  }

  return (
    <div className="overflow-x-auto">
      <div className="inline-block min-w-full">
        <div className="grid" style={{ gridTemplateColumns: `48px repeat(12, minmax(28px, 1fr))` }}>
          <div />
          {MESES.map(m => (
            <div key={m} className="text-[10px] uppercase text-muted-foreground text-center py-1">{m}</div>
          ))}
          {anos.map(ano => (
            <FragRow key={ano} ano={ano} valores={map.get(ano)!} max={max} />
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
          <span>Menor</span>
          <div className="flex gap-0.5">
            {[0.1, 0.3, 0.5, 0.7, 0.9].map(o => (
              <div key={o} className="size-3 rounded-sm" style={{ background: `color-mix(in oklab, var(--accent) ${o*100}%, transparent)` }} />
            ))}
          </div>
          <span>Maior — intensidade = valor contratado no mês</span>
        </div>
      </div>
    </div>
  );
}

function FragRow({ ano, valores, max }: { ano: number; valores: number[]; max: number }) {
  return (
    <>
      <div className="text-xs font-mono text-muted-foreground flex items-center pr-2">{ano}</div>
      {valores.map((v, i) => {
        const o = v === 0 ? 0 : Math.max(0.08, v / max);
        return (
          <div
            key={i}
            title={`${MESES[i]}/${ano}: ${fmtBRL(v)}`}
            className="h-7 m-0.5 rounded-sm border border-border"
            style={{ background: v === 0 ? "transparent" : `color-mix(in oklab, var(--accent) ${o*100}%, transparent)` }}
          />
        );
      })}
    </>
  );
}