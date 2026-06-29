import { Link } from "@tanstack/react-router";
import type { FonteCobertura } from "@/lib/data/cobertura-publica.functions";
import {
  fmtRelativo,
  fmtAnoMes,
  freshness,
  corFresh,
} from "@/lib/cobertura-secao/logic";

export { fmtRelativo, freshness } from "@/lib/cobertura-secao/logic";

type Cobertura = { anoCorrente: number; fontes: FonteCobertura[]; geradoEm: string };

const MESES = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const MESES_LONG = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/**
 * Variant compact: heatmap apenas do ano corrente.
 * Variant full: heatmap completo ano × mês para todos os anos com dados.
 */
export function CoberturaResumo({ cobertura }: { cobertura: Cobertura }) {
  const fontesComDados = cobertura.fontes.filter((f) => f.totalRegistros > 0);
  const atualizadas30d = fontesComDados.filter((f) => freshness(f.ultimaAtualizacao) === "fresh").length;
  const totalRegistros = cobertura.fontes.reduce((s, f) => s + f.totalRegistros, 0);
  const maisRecente = fontesComDados.reduce<FonteCobertura | null>(
    (acc, f) => (!acc || (f.ultimaAtualizacao ?? "") > (acc.ultimaAtualizacao ?? "") ? f : acc),
    null,
  );
  return (
    <div className="grid sm:grid-cols-3 gap-3">
      <div className="border border-border rounded-lg p-3 bg-background/40">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Fontes com dados</div>
        <div className="font-display text-xl mt-1">
          {fontesComDados.length} / {cobertura.fontes.length}
        </div>
      </div>
      <div className="border border-border rounded-lg p-3 bg-background/40">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Atualizadas em 30 dias</div>
        <div className="font-display text-xl mt-1">
          {atualizadas30d} / {fontesComDados.length}
        </div>
      </div>
      <div className="border border-border rounded-lg p-3 bg-background/40">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Total de registros</div>
        <div className="font-display text-xl mt-1">{totalRegistros.toLocaleString("pt-BR")}</div>
        {maisRecente && (
          <div className="text-[11px] text-muted-foreground mt-0.5">
            última: {maisRecente.id} · {fmtRelativo(maisRecente.ultimaAtualizacao)}
          </div>
        )}
      </div>
    </div>
  );
}

export function FonteCard({
  fonte,
  anoCorrente,
  variant = "compact",
}: {
  fonte: FonteCobertura;
  anoCorrente: number;
  variant?: "compact" | "full";
}) {
  const fresh = freshness(fonte.ultimaAtualizacao);
  const semDados = fonte.totalRegistros === 0;
  const mesesSet = new Set(fonte.mesesAnoCorrente);
  const anosCobertos = fonte.porAno.length;

  return (
    <div className={`border border-border rounded-xl p-4 bg-card ${semDados ? "opacity-70" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex-1 min-w-[240px]">
          <div className="flex items-center gap-2 flex-wrap">
            {fonte.rota ? (
              <Link to={fonte.rota as "/"} className="font-display text-lg hover:text-accent">
                {fonte.titulo}
              </Link>
            ) : (
              <h3 className="font-display text-lg">{fonte.titulo}</h3>
            )}
            {semDados && (
              <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-400">
                sem dados
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1 max-w-2xl">{fonte.descricao}</p>
        </div>
        <div className="text-right">
          <div className="font-mono text-lg">{fonte.totalRegistros.toLocaleString("pt-BR")}</div>
          <div className={`text-[11px] ${corFresh(fresh)}`}>
            atualização: {fmtRelativo(fonte.ultimaAtualizacao)}
          </div>
        </div>
      </div>

      {fonte.granularidade !== "cadastro" && (
        <>
          <div className="mt-3 grid sm:grid-cols-3 gap-2 text-xs">
            <Info label="Período coberto">
              {fmtAnoMes(fonte.primeiraData)} → {fmtAnoMes(fonte.ultimaData)}
            </Info>
            <Info label="Anos com registros">{anosCobertos}</Info>
            <Info
              label={
                fonte.granularidade === "ano"
                  ? `Dados em ${anoCorrente}`
                  : `Meses em ${anoCorrente}`
              }
            >
              {fonte.granularidade === "ano"
                ? (fonte.porAno.find((p) => p.ano === anoCorrente)?.qtd ?? 0) > 0
                  ? "sim"
                  : "não"
                : `${mesesSet.size} / 12`}
            </Info>
          </div>

          {variant === "compact" && fonte.granularidade === "mes" && (
            <div className="mt-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Cobertura mensal em {anoCorrente}
              </div>
              <div className="grid grid-cols-12 gap-0.5">
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                  const tem = mesesSet.has(m);
                  return (
                    <div
                      key={m}
                      title={`${tem ? "Com dados" : "Sem dados"} em ${String(m).padStart(2, "0")}/${anoCorrente}`}
                      className={`h-5 rounded text-[9px] flex items-center justify-center border ${
                        tem
                          ? "bg-accent/70 border-accent text-accent-foreground"
                          : "bg-transparent border-dashed border-border/60 text-muted-foreground"
                      }`}
                    >
                      {MESES[m - 1]}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {variant === "full" && fonte.granularidade !== "ano" && fonte.porAnoMes.length > 0 && (
            <HeatmapAnoMes fonte={fonte} />
          )}

          {(variant === "compact" || fonte.granularidade === "ano") && fonte.porAno.length > 0 && (
            <div className="mt-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Registros por ano
              </div>
              <BarraAnos porAno={fonte.porAno} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function HeatmapAnoMes({ fonte }: { fonte: FonteCobertura }) {
  const cols = fonte.granularidade === "periodo" ? 6 : 12;
  const labels = fonte.granularidade === "periodo" ? Array.from({ length: 6 }, (_, i) => `P${i + 1}`) : MESES_LONG;
  const porChave = new Map<string, number>();
  for (const r of fonte.porAnoMes) porChave.set(`${r.ano}|${r.mes}`, r.qtd);
  const anos = Array.from(new Set(fonte.porAnoMes.map((r) => r.ano))).sort((a, b) => b - a);
  const max = Math.max(1, ...fonte.porAnoMes.map((r) => r.qtd));

  return (
    <div className="mt-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
        Cobertura {fonte.granularidade === "periodo" ? "ano × período" : "ano × mês"} (intensidade = volume)
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[10px] border-separate border-spacing-0.5">
          <thead>
            <tr>
              <th className="w-10"></th>
              {labels.map((l, i) => (
                <th key={i} className="font-normal text-muted-foreground px-1">
                  {l}
                </th>
              ))}
              <th className="font-normal text-muted-foreground px-1 text-right uppercase tracking-wider">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {anos.map((ano) => (
              <tr key={ano}>
                <th className="font-mono text-muted-foreground pr-2 text-right">{ano}</th>
                {Array.from({ length: cols }, (_, i) => i + 1).map((m) => {
                  const qtd = porChave.get(`${ano}|${m}`) ?? 0;
                  const intensidade = qtd === 0 ? 0 : Math.max(0.2, Math.min(1, qtd / max));
                  return (
                    <td key={m} className="p-0 w-[7%]">
                      <div
                        title={`${ano}-${String(m).padStart(2, "0")}: ${qtd.toLocaleString("pt-BR")} registros`}
                        className={`h-5 w-full rounded ${
                          qtd === 0 ? "border border-dashed border-border/50" : "border border-transparent"
                        }`}
                        style={
                          qtd > 0
                            ? {
                                backgroundColor: `color-mix(in oklch, var(--accent) ${Math.round(
                                  intensidade * 100,
                                )}%, transparent)`,
                              }
                            : undefined
                        }
                      />
                    </td>
                  );
                })}
                <td className="pl-2 font-mono text-right text-foreground/80 whitespace-nowrap">
                  {Array.from({ length: cols }, (_, i) => i + 1)
                    .reduce((s, m) => s + (porChave.get(`${ano}|${m}`) ?? 0), 0)
                    .toLocaleString("pt-BR")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border border-border/60 rounded p-2 bg-background/40">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-mono mt-0.5">{children}</div>
    </div>
  );
}

function BarraAnos({ porAno }: { porAno: { ano: number; qtd: number }[] }) {
  const max = Math.max(1, ...porAno.map((p) => p.qtd));
  return (
    <div className="flex items-end gap-1 h-16">
      {porAno.map((p) => {
        const h = Math.max(4, Math.round((p.qtd / max) * 56));
        return (
          <div
            key={p.ano}
            className="flex flex-col items-center gap-1 flex-1 min-w-0"
            title={`${p.ano}: ${p.qtd.toLocaleString("pt-BR")} registros`}
          >
            <div className="w-full bg-accent/60 rounded-sm" style={{ height: `${h}px` }} />
            <div className="text-[9px] font-mono text-muted-foreground">{p.ano}</div>
          </div>
        );
      })}
    </div>
  );
}