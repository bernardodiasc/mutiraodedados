import { Link } from "@tanstack/react-router";
import { fmtBRL } from "@/lib/fmt";

export type GrafoNo = { id: string; label: string; valor: number };

/**
 * Grafo radial simples: fornecedor central, órgãos satélites com aresta de espessura proporcional.
 */
export function GrafoFornecedor({
  central,
  nos,
}: {
  central: string;
  nos: GrafoNo[];
}) {
  const size = 360;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 60;
  const n = nos.length;
  if (n === 0) return null;

  const max = Math.max(...nos.map(x => x.valor));

  const positions = nos.map((_, i) => {
    const ang = (-Math.PI / 2) + (i * 2 * Math.PI) / n;
    return [cx + Math.cos(ang) * r, cy + Math.sin(ang) * r];
  });

  return (
    <div className="flex flex-col items-center gap-3">
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-md">
        {nos.map((no, i) => {
          const [x, y] = positions[i];
          const w = 1 + (no.valor / max) * 5;
          return (
            <line key={`l-${no.id}`} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--accent)" strokeOpacity={0.4} strokeWidth={w} />
          );
        })}
        {nos.map((no, i) => {
          const [x, y] = positions[i];
          const rad = 8 + (no.valor / max) * 14;
          return (
            <g key={no.id}>
              <circle cx={x} cy={y} r={rad} fill="var(--card)" stroke="var(--accent)" strokeWidth={1.5} />
              <text x={x} y={y + rad + 12} fontSize="10" textAnchor="middle" fill="var(--muted-foreground)">
                {no.label}
              </text>
            </g>
          );
        })}
        <circle cx={cx} cy={cy} r={28} fill="var(--accent)" />
        <text x={cx} y={cy + 4} fontSize="11" fontWeight="700" textAnchor="middle" fill="var(--accent-foreground)">
          fornecedor
        </text>
      </svg>
      <ul className="text-xs w-full divide-y divide-border border border-border rounded-md bg-card">
        {[...nos].sort((a,b)=>b.valor-a.valor).map(no => (
          <li key={no.id} className="flex items-center justify-between p-2">
            <Link to="/orgaos/$cod" params={{ cod: no.id }} className="hover:text-accent truncate">{no.label}</Link>
            <span className="font-mono text-muted-foreground">{fmtBRL(no.valor)}</span>
          </li>
        ))}
      </ul>
      <div className="text-[11px] text-muted-foreground">Espessura da aresta e tamanho do nó = volume contratado por {central}.</div>
    </div>
  );
}