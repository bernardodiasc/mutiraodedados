import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Database, Search } from "lucide-react";
import { IbgeCombobox } from "@/components/IbgeCombobox";
import { UFS, PRESETS, sanitizeIbge } from "@/lib/admin-entes/logic";

export type AdminEntesViewProps = {
  ano: number;
  ini: string;
  fim: string;
  uf: string;
  setUf: (v: string) => void;
  ibge: string;
  setIbge: (v: string) => void;
  tipoRel: "RREO" | "RGF" | "DCA";
  setTipoRel: (v: "RREO" | "RGF" | "DCA") => void;
  periodo: number;
  setPeriodo: (v: number) => void;
  exer: number;
  setExer: (v: number) => void;
  loading: string | null;
  busy: (k: string) => boolean;
  onImportPncp: () => void;
  onImportSiconfi: () => void;
  onImportTransferegov: () => void;
  onImportTransfEspeciais: () => void;
  onImportTransfFinalidade: () => void;
};

export function AdminEntesView(props: AdminEntesViewProps) {
  const {
    ano,
    ini,
    fim,
    uf,
    setUf,
    ibge,
    setIbge,
    tipoRel,
    setTipoRel,
    periodo,
    setPeriodo,
    exer,
    setExer,
    loading,
    busy,
    onImportPncp,
    onImportSiconfi,
    onImportTransferegov,
    onImportTransfEspeciais,
    onImportTransfFinalidade,
  } = props;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Search className="size-4 text-accent" />
          <h3 className="font-display text-lg">Ente federativo</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          O código IBGE identifica a UF (2 dígitos, ex.: <code>35</code>) ou o município (7 dígitos,
          ex.: <code>3550308</code>). Use o seletor para buscar por nome — a lista completa é
          carregada do IBGE na primeira vez que você abrir.
        </p>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <Label className="text-xs">Buscar ente</Label>
            <div className="mt-1">
              <IbgeCombobox value={ibge} onChange={setIbge} disabled={!!loading} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Código IBGE</Label>
            <Input
              value={ibge}
              onChange={(e) => setIbge(sanitizeIbge(e.target.value))}
              placeholder="manual"
              className="mt-1 w-40 font-mono"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 pt-1">
          <span className="text-xs text-muted-foreground mr-1 self-center">Atalhos:</span>
          {PRESETS.map((p) => (
            <Button
              key={p.codigo}
              type="button"
              size="sm"
              variant={ibge === p.codigo ? "default" : "outline"}
              className="h-7 px-2 text-xs"
              onClick={() => setIbge(p.codigo)}
            >
              {p.nome}
            </Button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h3 className="font-display text-lg flex items-center gap-2">
          <Database className="size-4 text-accent" /> PNCP — Contratações Públicas
        </h3>
        <p className="text-sm text-muted-foreground">
          Importa contratos publicados em {ini} → {fim}. Filtre por UF opcionalmente.
        </p>
        <div className="flex flex-wrap gap-2 items-end">
          <div>
            <Label className="text-xs">UF</Label>
            <select
              value={uf}
              onChange={(e) => setUf(e.target.value)}
              className="block rounded-md border bg-background px-3 py-2 text-sm"
            >
              {UFS.map((u) => (
                <option key={u} value={u}>
                  {u || "Todas"}
                </option>
              ))}
            </select>
          </div>
          <Button disabled={!!loading} onClick={onImportPncp}>
            {busy("PNCP") ? <Loader2 className="size-4 animate-spin" /> : "Importar PNCP"}
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h3 className="font-display text-lg flex items-center gap-2">
          <Database className="size-4 text-accent" /> SICONFI — Relatórios Fiscais
        </h3>
        <p className="text-sm text-muted-foreground">
          Importa RREO/RGF/DCA do ente selecionado acima.
        </p>
        <div className="flex flex-wrap gap-2 items-end">
          <div>
            <Label className="text-xs">Exercício</Label>
            <Input
              type="number"
              value={exer}
              onChange={(e) => setExer(Number(e.target.value))}
              className="w-28"
            />
          </div>
          <div>
            <Label className="text-xs">Relatório</Label>
            <select
              value={tipoRel}
              onChange={(e) => setTipoRel(e.target.value as "RREO" | "RGF" | "DCA")}
              className="block rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="RREO">RREO</option>
              <option value="RGF">RGF</option>
              <option value="DCA">DCA</option>
            </select>
          </div>
          {tipoRel !== "DCA" && (
            <div>
              <Label className="text-xs">Período</Label>
              <Input
                type="number"
                value={periodo}
                onChange={(e) => setPeriodo(Number(e.target.value))}
                className="w-20"
              />
            </div>
          )}
          <Button disabled={!!loading || !ibge} onClick={onImportSiconfi}>
            {busy("SICONFI") ? <Loader2 className="size-4 animate-spin" /> : "Importar SICONFI"}
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h3 className="font-display text-lg flex items-center gap-2">
          <Database className="size-4 text-accent" /> Transferegov — Convênios
        </h3>
        <p className="text-sm text-muted-foreground">
          Convênios e contratos de repasse em {ini} → {fim} (via Portal CGU). Filtra pelo município
          selecionado acima (apenas para códigos de 7 dígitos).
        </p>
        <div className="flex flex-wrap gap-2 items-end">
          <Button disabled={!!loading} onClick={onImportTransferegov}>
            {busy("Transferegov") ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              "Importar Convênios"
            )}
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h3 className="font-display text-lg flex items-center gap-2">
          <Database className="size-4 text-accent" /> Transferegov — Emendas (EC 105/2019)
        </h3>
        <p className="text-sm text-muted-foreground">
          Disponibilizações de recursos de emendas individuais (Transferências Especiais e com
          Finalidade Definida) direto da API oficial do Transferegov. A importação é{" "}
          <strong>anual</strong> — usa o ano {ano} selecionado acima (mês é ignorado). Filtros por
          UF/município são aplicados depois, ao consultar os dados.
        </p>
        <div className="flex flex-wrap gap-2 items-end">
          <Button disabled={!!loading} onClick={onImportTransfEspeciais}>
            {busy("Transf. Especiais") ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              `Importar Especiais — ${ano}`
            )}
          </Button>
          <Button disabled={!!loading} variant="outline" onClick={onImportTransfFinalidade}>
            {busy("Transf. Finalidade") ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              `Importar Finalidade Definida — ${ano}`
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}