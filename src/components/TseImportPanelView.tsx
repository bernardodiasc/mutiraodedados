import { Download, Loader2, RefreshCw, Vote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fmtNum } from "@/lib/fmt";
import {
  ANOS_TSE,
  TIPOS_TSE,
  UFS_TSE,
  rotuloTipo,
  type ProgressoResumo,
} from "@/lib/tse-import/logic";
import type { TseTipoArquivo } from "@/lib/data/tse/client-ckan";

export type TseImportPanelViewProps = {
  tipo: TseTipoArquivo;
  ano: number;
  uf: string;
  autoContinuar: boolean;
  busy: boolean;
  statusAtual: string | null;
  progresso: ProgressoResumo[];
  carregandoProgresso: boolean;
  ponteBusy: "camara" | "senado" | null;
  sinaisBusy: "investigativos" | "lacunas" | null;
  onAlterar: (
    patch: Partial<{ tipo: TseTipoArquivo; ano: number; uf: string; autoContinuar: boolean }>,
  ) => void;
  onImportar: () => void;
  onCancelar: () => void;
  onAtualizarProgresso: () => void;
  onContinuarPendentes: (tipo: TseTipoArquivo, ano: number, ufs: string[]) => void;
  onSincronizarPonte: (casa: "camara" | "senado") => void;
  onRodarSinais: (grupo: "investigativos" | "lacunas") => void;
};

export function TseImportPanelView(p: TseImportPanelViewProps) {
  const tipoSel = TIPOS_TSE.find((t) => t.id === p.tipo);
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="font-display text-lg flex items-center gap-2">
          <Vote className="size-4 text-accent" />
          Importar dados do TSE
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Os dados vêm dos CSVs oficiais do CKAN do TSE, lidos em streaming direto do CDN. Cada
          rodada processa <strong>um arquivo (ano × UF)</strong>; arquivos grandes
          (receitas/despesas) são retomáveis — use o auto-continuar. Importe{" "}
          <strong>candidatos primeiro</strong> (as demais entidades referenciam o catálogo).
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="text-sm grid gap-1">
            <span className="text-muted-foreground">O que importar</span>
            <select
              className="border border-border rounded-md bg-background px-2 py-1.5"
              value={p.tipo}
              onChange={(e) => p.onAlterar({ tipo: e.target.value as TseTipoArquivo })}
              disabled={p.busy}
            >
              {TIPOS_TSE.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm grid gap-1">
            <span className="text-muted-foreground">Eleição</span>
            <select
              className="border border-border rounded-md bg-background px-2 py-1.5"
              value={p.ano}
              onChange={(e) => p.onAlterar({ ano: Number(e.target.value) })}
              disabled={p.busy}
            >
              {ANOS_TSE.map((a) => (
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
              value={p.uf}
              onChange={(e) => p.onAlterar({ uf: e.target.value })}
              disabled={p.busy}
            >
              <option value="TODAS">Todas as UFs</option>
              {UFS_TSE.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm flex items-center gap-2 pb-2">
            <input
              type="checkbox"
              checked={p.autoContinuar}
              onChange={(e) => p.onAlterar({ autoContinuar: e.target.checked })}
              disabled={p.busy}
            />
            <span className="text-muted-foreground">Auto-continuar até completar</span>
          </label>
          {p.busy ? (
            <Button variant="outline" onClick={p.onCancelar}>
              Cancelar
            </Button>
          ) : (
            <Button onClick={p.onImportar}>
              <Download className="size-4 mr-2" />
              Importar
            </Button>
          )}
        </div>
        {tipoSel && <p className="text-xs text-muted-foreground mt-2">{tipoSel.nota}</p>}
        {p.busy && p.statusAtual && (
          <p className="text-sm mt-3 flex items-center gap-2">
            <Loader2 className="size-4 animate-spin text-accent" />
            {p.statusAtual}
          </p>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="font-display text-lg">Ponte parlamentar ↔ candidato</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Vincula deputados e senadores em exercício às candidaturas do cache TSE — por CPF (Câmara,
          via detalhe da API) ou por nome + UF (Senado). Vínculos de baixa confiança entram na fila
          de revisão em <code>/admin/qualidade</code>. Rode <strong>depois</strong> de importar
          candidatos.
        </p>
        <div className="mt-3 flex gap-2 flex-wrap">
          <Button
            variant="outline"
            disabled={p.ponteBusy !== null || p.busy}
            onClick={() => p.onSincronizarPonte("camara")}
          >
            {p.ponteBusy === "camara" && <Loader2 className="size-4 mr-2 animate-spin" />}
            Vincular deputados
          </Button>
          <Button
            variant="outline"
            disabled={p.ponteBusy !== null || p.busy}
            onClick={() => p.onSincronizarPonte("senado")}
          >
            {p.ponteBusy === "senado" && <Loader2 className="size-4 mr-2 animate-spin" />}
            Vincular senadores
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="font-display text-lg">Sinais da fonte TSE</h3>
        <p className="text-sm text-muted-foreground mt-1">
          <strong>Lacunas</strong> (eleito sem prestação de contas — confirmado na API antes de
          gravar —, série histórica incompleta, parlamentar sem vínculo) e{" "}
          <strong>sinais investigativos</strong> (doador que virou fornecedor, evolução patrimonial
          atípica, fornecedor de campanha concentrado). Usam o ano selecionado acima; rode após
          importar candidatos, bens e contas.
        </p>
        <div className="mt-3 flex gap-2 flex-wrap">
          <Button
            variant="outline"
            disabled={p.sinaisBusy !== null || p.busy}
            onClick={() => p.onRodarSinais("lacunas")}
          >
            {p.sinaisBusy === "lacunas" && <Loader2 className="size-4 mr-2 animate-spin" />}
            Detectar lacunas ({p.ano})
          </Button>
          <Button
            variant="outline"
            disabled={p.sinaisBusy !== null || p.busy}
            onClick={() => p.onRodarSinais("investigativos")}
          >
            {p.sinaisBusy === "investigativos" && <Loader2 className="size-4 mr-2 animate-spin" />}
            Rodar sinais investigativos ({p.ano})
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h3 className="font-display text-lg">Progresso das varreduras</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={p.onAtualizarProgresso}
            disabled={p.carregandoProgresso}
          >
            {p.carregandoProgresso ? (
              <Loader2 className="size-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="size-4 mr-2" />
            )}
            Atualizar
          </Button>
        </div>
        {p.progresso.length === 0 ? (
          <p className="text-sm text-muted-foreground mt-3">
            Nenhuma varredura iniciada ainda. Escolha um ano e clique em Importar.
          </p>
        ) : (
          <ul className="grid gap-2 mt-3">
            {p.progresso.map((g) => (
              <li
                key={`${g.tipo}-${g.ano}`}
                className="border border-border rounded-md p-3 bg-background flex items-center justify-between gap-3 flex-wrap"
              >
                <div>
                  <span className="font-medium">{rotuloTipo(g.tipo)}</span>{" "}
                  <span className="font-mono text-sm text-muted-foreground">{g.ano}</span>
                  <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                    {g.ufsCompletas}/{g.ufsIniciadas} UFs completas · {fmtNum(g.importados)}{" "}
                    registros
                    {g.pendentes.length > 0 && ` · pendentes: ${g.pendentes.join(", ")}`}
                  </p>
                </div>
                {g.pendentes.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={p.busy}
                    onClick={() => p.onContinuarPendentes(g.tipo, g.ano, g.pendentes)}
                  >
                    Continuar pendentes
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
TseImportPanelView.displayName = "TseImportPanelView";
