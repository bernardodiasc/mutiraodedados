import * as React from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { AdminNav } from "@/components/AdminNav";
import { EmptyState } from "@/components/EmptyState";
import { InvestigacaoInline } from "@/components/InvestigacaoInline";
import type { Anomalia } from "@/lib/data/types";
import {
  REGRA_LABEL,
  SEV_MAP,
  SEV_STYLES,
  buildCurlsSinal,
  contarPorRegra,
  contarPorSeveridade,
  hrefSinal,
} from "@/lib/admin-sinais/logic";

export type AdminSinaisViewProps = {
  all: Anomalia[];
  filtrados: Anomalia[];
  regras: string[];
  regraSel: string | null;
  sevSel: string | null;
  statusSel: string;
  onToggleRegra: (r: string) => void;
  onToggleSev: (s: string) => void;
  onStatusChange: (s: string) => void;
  onLimpar: () => void;
};

export function AdminSinaisView({
  all,
  filtrados,
  regras,
  regraSel,
  sevSel,
  statusSel,
  onToggleRegra,
  onToggleSev,
  onStatusChange,
  onLimpar,
}: AdminSinaisViewProps) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 space-y-6">
      <Link
        to="/admin"
        className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
      >
        <ArrowLeft className="size-3.5" /> voltar
      </Link>
      <header>
        <h1 className="font-display text-4xl">Sinais</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Padrões estatísticos detectados pelo heurístico cidadão sobre os
          dados em cache. São <strong>indícios</strong>, não irregularidades —
          a visão pública vive em{" "}
          <Link to="/anomalias" className="underline">
            /anomalias
          </Link>
          . Aqui você prioriza o que merece virar finding investigado em{" "}
          <Link to="/admin/qualidade" className="underline">
            Qualidade
          </Link>
          .
        </p>
      </header>
      <AdminNav />

      <section className="grid sm:grid-cols-4 gap-3">
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Total
          </div>
          <div className="text-2xl font-display mt-1">{all.length}</div>
        </div>
        {(["alta", "media", "baixa"] as const).map((s) => (
          <div key={s} className="rounded-lg border border-border bg-card p-3">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              {s}
            </div>
            <div className="text-2xl font-display mt-1">
              {contarPorSeveridade(all, s)}
            </div>
          </div>
        ))}
      </section>

      <section className="space-y-2">
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="text-[11px] uppercase tracking-widest text-muted-foreground self-center mr-1">
            Severidade
          </span>
          {(["alta", "media", "baixa"] as const).map((s) => (
            <button
              key={s}
              onClick={() => onToggleSev(s)}
              className={`px-2.5 py-1 rounded-full border transition ${sevSel === s ? "bg-foreground text-background border-foreground" : "bg-card border-border hover:bg-muted"}`}
            >
              {s}{" "}
              <span className="opacity-60 ml-1">
                {contarPorSeveridade(all, s)}
              </span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 text-xs items-center">
          <span className="text-[11px] uppercase tracking-widest text-muted-foreground mr-1">
            Status
          </span>
          <select
            className="rounded-md border border-input bg-background px-2 py-1"
            value={statusSel}
            onChange={(e) => onStatusChange(e.target.value)}
          >
            <option value="">Todos os status</option>
            <option value="aberto">Aberto</option>
            <option value="confirmado">Confirmado</option>
            <option value="reportado">Reportado</option>
            <option value="corrigido_origem">Corrigido na origem</option>
            <option value="falso_positivo">Falso positivo</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="text-[11px] uppercase tracking-widest text-muted-foreground self-center mr-1">
            Regra
          </span>
          {regras.map((r) => (
            <button
              key={r}
              onClick={() => onToggleRegra(r)}
              className={`px-2.5 py-1 rounded-full border transition ${regraSel === r ? "bg-accent text-accent-foreground border-accent" : "bg-card border-border hover:bg-muted"}`}
            >
              {REGRA_LABEL[r] ?? r}{" "}
              <span className="opacity-60 ml-1">{contarPorRegra(all, r)}</span>
            </button>
          ))}
          {(regraSel || sevSel) && (
            <button
              onClick={onLimpar}
              className="px-2.5 py-1 rounded-full border border-border text-muted-foreground hover:bg-muted"
            >
              limpar
            </button>
          )}
        </div>
      </section>

      <section className="space-y-3">
        {filtrados.length === 0 ? (
          <EmptyState
            title="Nenhum sinal para mostrar"
            hint={
              all.length === 0
                ? "Sem dados reais em cache. Importe contratos em /admin/dados para o detector ter base de cálculo."
                : "Nenhum sinal bate com os filtros atuais."
            }
          />
        ) : (
          filtrados.map((f) => (
            <InvestigacaoInline
              key={f.id}
              statusFilter={statusSel || undefined}
              candidato={{
                fonte: "cgu",
                entidade_tipo: f.entidadeTipo,
                entidade_id: f.entidadeId,
                regra: f.regra,
                origem: "sinal",
                severidade: SEV_MAP[f.severidade],
                detalhes: {
                  titulo: f.titulo,
                  entidade_nome: f.entidadeNome,
                  evidencia: f.evidencia,
                  explicacao: f.explicacao,
                },
              }}
              curls={buildCurlsSinal(f)}
            >
              <div
                className={`rounded-md -m-4 p-4 ${SEV_STYLES[f.severidade] ?? ""}`}
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest font-bold">
                      <span>{f.severidade}</span>
                      <span className="opacity-50">·</span>
                      <span>{REGRA_LABEL[f.regra] ?? f.regra}</span>
                    </div>
                    <h3 className="font-display text-lg mt-1 leading-tight text-foreground">
                      {f.titulo}
                    </h3>
                    <p className="text-xs text-foreground/80 mt-1">
                      {f.explicacao}
                    </p>
                    <div className="text-xs text-foreground/80 mt-1">
                      <a
                        href={hrefSinal(f)}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold underline underline-offset-2"
                      >
                        {f.entidadeNome}
                      </a>{" "}
                      <span className="text-muted-foreground">
                        · {f.entidadeTipo} {f.entidadeId}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </InvestigacaoInline>
          ))
        )}
      </section>
    </div>
  );
}