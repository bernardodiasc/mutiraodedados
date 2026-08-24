import { Link } from "@tanstack/react-router";
import { Loader2, Users } from "lucide-react";
import { ControlePaginacao } from "@/components/ControlePaginacao";
import { EmptyState } from "@/components/EmptyState";
import { SeletorItensPorPagina } from "@/components/SeletorItensPorPagina";
import { SeletorOrdenacao } from "@/components/SeletorOrdenacao";
import { fmtBRL } from "@/lib/fmt";
import type { OpcaoOrdem } from "@/lib/listagem/logic";
import type { CandidatoItem, Estado } from "@/lib/candidatos-lista/logic";
import { classeSituacao } from "@/lib/candidatos-lista/logic";

export type CandidatosListaFiltros = {
  ano: number;
  anos: number[];
  uf: string;
  ufs: string[];
  partido: string;
  q: string;
};

export type CandidatosListaViewProps = {
  estado: Estado;
  itens: CandidatoItem[];
  total: number;
  filtros: CandidatosListaFiltros;
  ordem: string;
  ordens: ReadonlyArray<OpcaoOrdem>;
  pagina: number;
  itensPorPagina: number;
  /** Search completo de uma página — preserva filtros; links compartilháveis. */
  montarSearch: (pagina: number) => Record<string, unknown>;
  onAlterarFiltro: (
    patch: Partial<Pick<CandidatosListaFiltros, "ano" | "uf" | "partido" | "q">> & {
      ordem?: string;
      itensPorPagina?: number;
    },
  ) => void;
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
  ordem,
  ordens,
  pagina,
  itensPorPagina,
  montarSearch,
  onAlterarFiltro,
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
        <label className="text-sm grid gap-1 w-24">
          <span className="text-muted-foreground">Partido</span>
          <input
            className="border border-border rounded-md bg-background px-2 py-1.5"
            placeholder="Sigla"
            value={filtros.partido}
            onChange={(e) => onAlterarFiltro({ partido: e.target.value })}
          />
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
        <label className="text-sm grid gap-1">
          <span className="text-muted-foreground">Ordenar por</span>
          <SeletorOrdenacao
            opcoes={ordens}
            valor={ordem}
            aoMudar={(v) => onAlterarFiltro({ ordem: v })}
          />
        </label>
        <SeletorItensPorPagina
          valor={itensPorPagina}
          aoMudar={(n) => onAlterarFiltro({ itensPorPagina: n })}
        />
      </div>

      <ControlePaginacao
        pagina={pagina}
        itens={itensPorPagina}
        total={estado === "pronto" ? total : 0}
        to="/eleicoes/candidatos"
        montarSearch={montarSearch}
      />

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
          hint="Mude o ano, a UF, o partido ou o nome buscado. Os dados de cada eleição entram no acervo aos poucos."
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
                    {c.cargo} · {c.uf} ·{" "}
                    <Link
                      to="/eleicoes/partidos/$sigla"
                      params={{ sigla: c.partido }}
                      className="hover:text-accent underline-offset-2 hover:underline"
                    >
                      {c.partido}
                    </Link>{" "}
                    · {c.ano}
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

      {estado === "pronto" && (
        <ControlePaginacao
          pagina={pagina}
          itens={itensPorPagina}
          total={total}
          to="/eleicoes/candidatos"
          montarSearch={montarSearch}
        />
      )}
    </div>
  );
}
CandidatosListaView.displayName = "CandidatosListaView";
