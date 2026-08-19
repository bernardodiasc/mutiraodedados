import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import type { SerieAnual } from "@/lib/data/types";
import { fmtBRL } from "@/lib/fmt";

export function SerieAnualChart({ data }: { data: SerieAnual[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ left: 12, right: 12, top: 12, bottom: 0 }}>
          <defs>
            <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.5} />
              <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="ano" stroke="var(--muted-foreground)" />
          <YAxis
            stroke="var(--muted-foreground)"
            tickFormatter={(v) => `R$ ${(v / 1e6).toFixed(0)}M`}
          />
          <Tooltip
            formatter={(v: number) => fmtBRL(v)}
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Area
            type="monotone"
            dataKey="valor"
            stroke="var(--accent)"
            fill="url(#g1)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
