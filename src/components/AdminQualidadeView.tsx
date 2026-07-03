import { Loader2 } from "lucide-react";
import { AdminHeader } from "@/components/AdminHeader";
import { AnomaliaInvestigacao } from "@/components/AnomaliaInvestigacao";
import {
  FONTES_QA,
  REGRAS_QA,
  buildCurlsQualidade,
  type FindingAdmin,
} from "@/lib/admin-qualidade/logic";

export type AggItem = {
  fonte: string;
  total: number;
  criticos: number;
  porStatus: Record<string, number>;
};

const STATUS_LABEL: Record<string, string> = {
  aberto: "abertas",
  confirmado: "confirmadas",
  reportado: "reportadas",
  corrigido_origem: "corrigidas",
  corrigido_automaticamente: "corrig. auto",
  falso_positivo: "falso pos.",
  wontfix: "wontfix",
};

export type AdminQualidadeActions = {
  onRevalidarCgu: (
    id: string,
  ) => Promise<{ resultado: string; valor_armazenado: number; valor_detalhe: number }>;
  onReportar: (id: string, canal: string, protocolo?: string) => Promise<void>;
  onConfirmar: (id: string) => Promise<void>;
  onMarcarCorrigido: (id: string) => Promise<void>;
  onMarcarFalsoPositivo: (id: string) => Promise<void>;
  onSalvarNota: (id: string, nota: string) => Promise<void>;
};

export type AdminQualidadeViewProps = {
  fonte: string | undefined;
  status: string | undefined;
  regra: string | undefined;
  onChangeFonte: (v: string | undefined) => void;
  onChangeStatus: (v: string | undefined) => void;
  onChangeRegra: (v: string | undefined) => void;
  agg: AggItem[];
  findings: FindingAdmin[];
  isLoading: boolean;
  actions: AdminQualidadeActions;
};

export function AdminQualidadeView({
  fonte,
  status,
  regra,
  onChangeFonte,
  onChangeStatus,
  onChangeRegra,
  agg,
  findings,
  isLoading,
  actions,
}: AdminQualidadeViewProps) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 space-y-8">
      <AdminHeader titulo="Qualidade dos dados">
        Defeitos detectados nas bases ingeridas. Cada suspeita é investigada, re-checada contra a
        fonte oficial e, quando confirmada como erro da origem, reportada ao órgão responsável.
      </AdminHeader>

      <section className="grid sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {FONTES_QA.map((f) => {
          const a = agg.find((x) => x.fonte === f);
          const ps = a?.porStatus ?? {};
          return (
            <div key={f} className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-baseline justify-between">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">{f}</span>
                <span className="text-[10px] text-muted-foreground">{a?.total ?? 0} total</span>
              </div>
              <div className="text-2xl font-display mt-1">
                {ps.aberto ?? 0}
                <span className="text-xs font-sans text-muted-foreground"> abertas</span>
              </div>
              <div className="mt-1 grid grid-cols-2 gap-x-2 text-[11px] text-muted-foreground">
                {(
                  [
                    "confirmado",
                    "reportado",
                    "corrigido_origem",
                    "corrigido_automaticamente",
                    "falso_positivo",
                    "wontfix",
                  ] as const
                ).map((s) => (
                  <span key={s}>
                    {ps[s] ?? 0} {STATUS_LABEL[s]}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap gap-2 text-xs">
          <select
            className="rounded-md border border-input bg-background px-2 py-1"
            value={fonte ?? ""}
            onChange={(e) => onChangeFonte(e.target.value || undefined)}
          >
            <option value="">Todas as fontes</option>
            {FONTES_QA.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
          <select
            className="rounded-md border border-input bg-background px-2 py-1"
            value={status ?? ""}
            onChange={(e) => onChangeStatus(e.target.value || undefined)}
          >
            <option value="">Todos os status</option>
            <option value="aberto">Aberto</option>
            <option value="confirmado">Confirmado</option>
            <option value="reportado">Reportado</option>
            <option value="corrigido_origem">Corrigido na origem</option>
            <option value="corrigido_automaticamente">Corrigido automaticamente</option>
            <option value="falso_positivo">Falso positivo</option>
            <option value="wontfix">Wontfix</option>
          </select>
          <select
            className="rounded-md border border-input bg-background px-2 py-1"
            value={regra ?? ""}
            onChange={(e) => onChangeRegra(e.target.value || undefined)}
          >
            <option value="">Todas as regras</option>
            {REGRAS_QA.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        {isLoading ? (
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" /> Carregando…
          </div>
        ) : findings.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma suspeita com esses filtros.</p>
        ) : (
          <div className="space-y-3">
            {findings.map((f) => (
              <AnomaliaInvestigacao
                key={f.id}
                anomalia={f}
                notaInicial={f.notas_admin ?? null}
                curls={buildCurlsQualidade(f)}
                actions={{
                  onRevalidar:
                    f.fonte === "cgu"
                      ? () => actions.onRevalidarCgu(f.id).then(() => undefined)
                      : undefined,
                  onReportar: (canal, protocolo) => actions.onReportar(f.id, canal, protocolo),
                  onConfirmar: () => actions.onConfirmar(f.id),
                  onMarcarCorrigido: () => actions.onMarcarCorrigido(f.id),
                  onMarcarFalsoPositivo: () => actions.onMarcarFalsoPositivo(f.id),
                  onSalvarNota: (nota) => actions.onSalvarNota(f.id, nota),
                }}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
