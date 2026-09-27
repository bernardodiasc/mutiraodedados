import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { categoriaBusca } from "@/lib/busca/categorias";
import { CATEGORIA_DA_COLECAO } from "@/lib/busca/desatualizadas";
import type { LinhaDiagnostico, SituacaoColecao } from "@/lib/diagnostico-busca/logic";

export type RecorteReindexar = { colecao: string; idsTexto: string };

export type DiagnosticoBuscaViewProps = {
  estado: "carregando" | "erro" | "pronto";
  linhas: LinhaDiagnostico[];
  mensagemErro: string | null;
  atualizando: boolean;
  onAtualizar: () => void;
  /** Formulário de "reindexar recorte" aberto (uma coleção por vez). */
  recorte: RecorteReindexar | null;
  onAbrirRecorte: (colecao: string) => void;
  onIdsTexto: (texto: string) => void;
  onCancelarRecorte: () => void;
  onReindexar: () => void;
  reindexando: boolean;
  /** Resultado da última reindexação, para mostrar ao lado da coleção. */
  resultado: { colecao: string; texto: string } | null;
};

const ROTULO_SITUACAO: Record<SituacaoColecao, string> = {
  conciliada: "conciliada",
  faltam: "faltam no índice",
  sobram: "sobram no índice",
  indisponivel: "indisponível",
};

const CLASSE_SITUACAO: Record<SituacaoColecao, string> = {
  conciliada: "bg-primary/10 text-foreground",
  faltam: "bg-destructive/15 text-destructive",
  sobram: "bg-destructive/15 text-destructive",
  indisponivel: "bg-muted text-muted-foreground",
};

const fmt = (n: number | null) => (n === null ? "indisponível" : n.toLocaleString("pt-BR"));

const fmtData = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "nunca";

/**
 * Diagnóstico de busca por coleção: o que está no cache, o que a projeção
 * publica, o que está no índice e a defasagem da importação.
 */
export function DiagnosticoBuscaView(p: DiagnosticoBuscaViewProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-display text-lg">Diagnóstico da busca</h3>
        <Button
          size="sm"
          variant="ghost"
          onClick={p.onAtualizar}
          disabled={p.atualizando || p.estado === "carregando"}
        >
          <RefreshCw className="size-4" aria-hidden />
          {p.atualizando ? "Atualizando…" : "Atualizar"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground max-w-3xl">
        Por coleção do índice: linhas no cache, linhas que a projeção publica (fora ficam rascunho,
        despublicado e dado pessoal) e linhas no índice. Os gatilhos mantêm o índice igual aos
        publicáveis; diferença indica gatilho que falhou ou coleção ainda não reconstruída — use
        &ldquo;Reindexar&rdquo;. Contagem que passa do tempo aparece como indisponível.
      </p>

      {p.estado === "carregando" && (
        <p className="text-sm text-muted-foreground">Contando as coleções…</p>
      )}
      {p.estado === "erro" && (
        <p role="alert" className="text-sm text-destructive">
          {p.mensagemErro}
        </p>
      )}

      {p.estado === "pronto" && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-left text-muted-foreground">
              <tr>
                <th className="p-2 font-medium">Coleção</th>
                <th className="p-2 font-medium text-right">Cache</th>
                <th className="p-2 font-medium text-right">Publicáveis</th>
                <th className="p-2 font-medium text-right">No índice</th>
                <th className="p-2 font-medium">Conciliação</th>
                <th className="p-2 font-medium">Importação conferida</th>
                <th className="p-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {p.linhas.map((l) => {
                const categoria = CATEGORIA_DA_COLECAO[l.colecao] ?? "artigos";
                const aberto = p.recorte?.colecao === l.colecao;
                return (
                  <tr key={l.colecao} className="align-top">
                    <td className="p-2">
                      <div className="font-mono">{l.colecao}</div>
                      <div className="text-muted-foreground">
                        {categoriaBusca(categoria)?.rotulo ?? categoria}
                      </div>
                    </td>
                    <td className="p-2 text-right tabular-nums">{fmt(l.medidas.cache)}</td>
                    <td className="p-2 text-right tabular-nums">
                      {fmt(l.medidas.publicaveis)}
                      {l.foraDaBusca !== null && l.foraDaBusca > 0 && (
                        <div className="text-muted-foreground">
                          {l.foraDaBusca.toLocaleString("pt-BR")} fora da busca
                        </div>
                      )}
                    </td>
                    <td className="p-2 text-right tabular-nums">{fmt(l.medidas.indice)}</td>
                    <td className="p-2">
                      <span className={`rounded px-1.5 py-0.5 ${CLASSE_SITUACAO[l.situacao]}`}>
                        {ROTULO_SITUACAO[l.situacao]}
                        {l.diferenca !== null && l.diferenca !== 0 && (
                          <> ({Math.abs(l.diferenca).toLocaleString("pt-BR")})</>
                        )}
                      </span>
                    </td>
                    <td className="p-2">
                      {l.fontes.length === 0 && (
                        <span className="text-muted-foreground">conteúdo editorial</span>
                      )}
                      <ul className="space-y-0.5">
                        {l.fontes.map((f) => (
                          <li key={f.titulo}>
                            {f.titulo}: {fmtData(f.ultima)}
                            {f.defasagemDias !== null && (
                              <span className="text-muted-foreground">
                                {" "}
                                ({f.defasagemDias} {f.defasagemDias === 1 ? "dia" : "dias"})
                              </span>
                            )}
                            {f.desatualizada && (
                              <span className="ml-1 rounded bg-destructive/15 px-1 text-[10px] uppercase tracking-wider text-destructive">
                                desatualizada
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="p-2 w-64">
                      {!aberto && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => p.onAbrirRecorte(l.colecao)}
                          disabled={p.reindexando}
                        >
                          Reindexar
                        </Button>
                      )}
                      {aberto && (
                        <div className="space-y-1.5">
                          <label className="block text-muted-foreground" htmlFor="ids-recorte">
                            Ids de origem (vazio = coleção inteira)
                          </label>
                          <textarea
                            id="ids-recorte"
                            value={p.recorte!.idsTexto}
                            onChange={(e) => p.onIdsTexto(e.target.value)}
                            rows={3}
                            className="w-full rounded border bg-background p-1 font-mono"
                          />
                          <div className="flex gap-1.5">
                            <Button size="sm" onClick={p.onReindexar} disabled={p.reindexando}>
                              {p.reindexando ? "Reindexando…" : "Reindexar"}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={p.onCancelarRecorte}
                              disabled={p.reindexando}
                            >
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      )}
                      {p.resultado?.colecao === l.colecao && (
                        <p role="status" className="mt-1 text-muted-foreground">
                          {p.resultado.texto}
                        </p>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
