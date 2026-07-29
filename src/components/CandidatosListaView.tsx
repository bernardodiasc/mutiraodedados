import { Link } from "@tanstack/react-router";
import { Loader2, Users } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { fmtBRL, fmtNum } from "@/lib/fmt";
import type { CandidatoItem, Estado } from "@/lib/candidatos-lista/logic";
import { classeSituacao } from "@/lib/candidatos-lista/logic";

export type CandidatosListaFiltros = {
  ano: number;
  anos: number[];
  uf: string;
  ufs: string[];
  q: string;
};

export type CandidatosListaViewProps = {
  estado: Estado;
  itens: CandidatoItem[];
  total: number;
  filtros: CandidatosListaFiltros;
  onAlterarFiltro: (patch: Partial<Pick<CandidatosListaFiltros, "ano" | "uf" | "q">>) => void;
  onCarregarMais: () => void;
  temMais: boolean;
  carregandoMais: boolean;
};

const CLASSE_BADGE: Record<ReturnType<typeof classeSituacao>, string> = {
  eleito: "bg-primary/10 text-primary border-primary/30",
  "nao-eleito": "bg-muted text-muted-foreground border-border",
  outro: "bg-muted/50 text-muted-foreground border-border",
};

export function CandidatosListaView({
  estado,
  itens,
  total,
  filtros,
  onAlterarFiltro,
  onCarregarMais,
  temMais,
  carregandoMais,
}: CandidatosListaViewProps) {
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm grid gap-1">
          <span className="text-muted-foreground">Eleição</span>
          <select
            className="border border-border rounded-md bg-background px-2 py-1.5"
            value={filtros.ano}
            onChange={(e) => onAlterarFiltro({ ano: Number(e.target.value) })}
          >
            {filtros.anos.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm grid gap-1">
          <span className="text-muted-foreground">UF</span>
          <select
            className="border border-border rounded-md bg-background px-2 py-1.5"
            value={filtros.uf}
            onChange={(e) => onAlterarFiltro({ uf: e.target.value })}
          >
            <option value="">Todas</option>
            {filtros.ufs.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm grid gap-1 grow max-w-xs">
          <span className="text-muted-foreground">Nome</span>
          <input
            className="border border-border rounded-md bg-background px-2 py-1.5"
            placeholder="Nome do candidato ou nome de urna"
            value={filtros.q}
            onChange={(e) => onAlterarFiltro({ q: e.target.value })}
          />
        </label>
        {estado === "pronto" && (
          <span className="text-sm text-muted-foreground font-mono ml-auto">
            {fmtNum(total)} candidaturas
          </span>
        )}
      </div>

      {estado === "carregando" && (
        <div className="flex items-center gap-2 text-muted-foreground py-10 justify-center">
          <Loader2 className="size-4 animate-spin" /> Carregando candidatos…
        </div>
      )}
      {estado === "erro" && (
        <div className="text-destructive py-10 text-center">
          Não consegui carregar os candidatos.
        </div>
      )}
      {estado === "vazio" && (
        <EmptyState
          title="Nenhum candidato para esses filtros"
          hint="Mude o ano, a UF ou o nome buscado. Se a eleição ainda não foi importada, ela não aparece aqui."
        />
      )}

      {estado === "pronto" && (
        <ul className="grid gap-2">
          {itens.map((c) => (
            <li key={`${c.sq}-${c.ano}`} className="border border-border rounded-xl p-4 bg-card">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <Link
                    to="/eleicoes/candidatos/$sq"
                    params={{ sq: c.sq }}
                    search={{ ano: c.ano }}
                    className="font-medium hover:text-accent flex items-center gap-2"
                  >
                    <Users className="size-4 text-accent" />
                    {c.nomeUrna}
                    {c.numero && (
                      <span className="font-mono text-xs text-muted-foreground">nº {c.numero}</span>
                    )}
                  </Link>
                  <p className="text-xs text-muted-foreground mt-1">
                    {c.cargo} · {c.uf} · {c.partido} · {c.ano}
                  </p>
                </div>
                <div className="text-right grid gap-1 justify-items-end">
                  {c.situacao && (
                    <span
                      className={`text-xs border rounded-full px-2 py-0.5 ${CLASSE_BADGE[classeSituacao(c.situacao)]}`}
                    >
                      {c.situacao}
                    </span>
                  )}
                  {c.bensTotal != null && c.bensTotal > 0 && (
                    <span className="text-xs font-mono text-muted-foreground">
                      bens: {fmtBRL(c.bensTotal)}
                    </span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {estado === "pronto" && temMais && (
        <button
          type="button"
          onClick={onCarregarMais}
          disabled={carregandoMais}
          className="border border-border rounded-md px-4 py-2 text-sm hover:bg-muted disabled:opacity-50 justify-self-center"
        >
          {carregandoMais ? "Carregando…" : "Carregar mais"}
        </button>
      )}
    </div>
  );
}
CandidatosListaView.displayName = "CandidatosListaView";
