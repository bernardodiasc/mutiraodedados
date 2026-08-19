export type RadarEixo = { label: string; valor: number; descricao: string };

/**
 * Radar SVG simples. Cada eixo recebe valor 0..1.
 */
export function RadarRisco({ eixos }: { eixos: RadarEixo[] }) {
  const size = 260;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 40;
  const n = eixos.length;

  const pt = (i: number, val: number) => {
    const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return [cx + Math.cos(ang) * r * val, cy + Math.sin(ang) * r * val];
  };

  const rings = [0.25, 0.5, 0.75, 1];
  const ringPaths = rings.map(
    (rr) =>
      eixos
        .map((_, i) => {
          const [x, y] = pt(i, rr);
          return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(" ") + " Z",
  );

  const polyPath =
    eixos
      .map((e, i) => {
        const [x, y] = pt(i, Math.max(0, Math.min(1, e.valor)));
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ") + " Z";

  return (
    <div className="flex flex-col items-center gap-4">
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-xs">
        {ringPaths.map((p, i) => (
          <path key={i} d={p} fill="none" stroke="var(--border)" strokeWidth={1} />
        ))}
        {eixos.map((_, i) => {
          const [x, y] = pt(i, 1);
          return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--border)" />;
        })}
        <path
          d={polyPath}
          fill="color-mix(in oklab, var(--accent) 25%, transparent)"
          stroke="var(--accent)"
          strokeWidth={1.5}
        />
        {eixos.map((e, i) => {
          const [x, y] = pt(i, 1.18);
          return (
            <text
              key={i}
              x={x}
              y={y}
              fontSize="10"
              textAnchor="middle"
              fill="var(--muted-foreground)"
              dominantBaseline="middle"
            >
              {e.label}
            </text>
          );
        })}
      </svg>
      <ul className="text-xs text-muted-foreground space-y-1 w-full">
        {eixos.map((e) => (
          <li key={e.label} className="flex justify-between gap-3">
            <span className="font-semibold text-foreground">{e.label}</span>
            <span className="text-right flex-1">{e.descricao}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
