import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Database, Check, ChevronsUpDown, Search } from "lucide-react";
import { toast } from "sonner";
import { importarContratosPNCP } from "@/lib/data/pncp/ingest.functions";
import { importarRelatorioSICONFI } from "@/lib/data/siconfi/ingest.functions";
import { importarConveniosTransferegov } from "@/lib/data/transferegov/ingest.functions";
import {
  importarTransferenciasEspeciais,
  importarTransferenciasFinalidade,
} from "@/lib/data/transferegov/emendas-ingest.functions";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

const UFS = ["","AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"];

type Ente = { codigo: string; nome: string; uf?: string; tipo: "UF" | "Município" };

const PRESETS: Ente[] = [
  { codigo: "35", nome: "São Paulo (estado)", uf: "SP", tipo: "UF" },
  { codigo: "3550308", nome: "São Paulo (capital)", uf: "SP", tipo: "Município" },
  { codigo: "2611606", nome: "Recife", uf: "PE", tipo: "Município" },
  { codigo: "33", nome: "Rio de Janeiro (estado)", uf: "RJ", tipo: "UF" },
  { codigo: "3304557", nome: "Rio de Janeiro (capital)", uf: "RJ", tipo: "Município" },
  { codigo: "53", nome: "Distrito Federal", uf: "DF", tipo: "UF" },
];

const UF_LIST: Ente[] = [
  ["11","Rondônia","RO"],["12","Acre","AC"],["13","Amazonas","AM"],["14","Roraima","RR"],
  ["15","Pará","PA"],["16","Amapá","AP"],["17","Tocantins","TO"],["21","Maranhão","MA"],
  ["22","Piauí","PI"],["23","Ceará","CE"],["24","Rio Grande do Norte","RN"],["25","Paraíba","PB"],
  ["26","Pernambuco","PE"],["27","Alagoas","AL"],["28","Sergipe","SE"],["29","Bahia","BA"],
  ["31","Minas Gerais","MG"],["32","Espírito Santo","ES"],["33","Rio de Janeiro","RJ"],
  ["35","São Paulo","SP"],["41","Paraná","PR"],["42","Santa Catarina","SC"],["43","Rio Grande do Sul","RS"],
  ["50","Mato Grosso do Sul","MS"],["51","Mato Grosso","MT"],["52","Goiás","GO"],["53","Distrito Federal","DF"],
].map(([codigo, nome, uf]) => ({ codigo, nome: `${nome} (estado)`, uf, tipo: "UF" as const }));

function IbgeCombobox({
  value, onChange, disabled,
}: { value: string; onChange: (cod: string) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [municipios, setMunicipios] = useState<Ente[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  useEffect(() => {
    if (!open || municipios.length > 0 || loadingList) return;
    setLoadingList(true);
    fetch("https://servicodados.ibge.gov.br/api/v1/localidades/municipios")
      .then((r) => r.json())
      .then((arr: Array<{ id: number; nome: string; microrregiao?: { mesorregiao?: { UF?: { sigla?: string } } } }>) => {
        setMunicipios(
          arr.map((m) => ({
            codigo: String(m.id),
            nome: m.nome,
            uf: m.microrregiao?.mesorregiao?.UF?.sigla,
            tipo: "Município" as const,
          })),
        );
      })
      .catch(() => toast.error("Falha ao baixar lista de municípios do IBGE."))
      .finally(() => setLoadingList(false));
  }, [open, municipios.length, loadingList]);

  const all = useMemo<Ente[]>(() => [...UF_LIST, ...municipios], [municipios]);
  const selected = all.find((e) => e.codigo === value) ?? PRESETS.find((p) => p.codigo === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          disabled={disabled}
          className="w-[320px] justify-between font-normal hover:bg-muted hover:text-foreground"
        >
          {selected ? (
            <span className="truncate text-left">
              <span className="font-mono text-xs text-muted-foreground mr-2">{selected.codigo}</span>
              {selected.nome}{selected.uf && selected.tipo === "Município" ? ` / ${selected.uf}` : ""}
            </span>
          ) : value ? (
            <span className="font-mono text-xs">{value}</span>
          ) : (
            <span className="text-muted-foreground">Selecione UF ou município…</span>
          )}
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[420px] p-0" align="start">
        <Command filter={(val, search) => (val.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}>
          <CommandInput placeholder={loadingList ? "Carregando municípios…" : "Buscar por nome, UF ou código IBGE…"} />
          <CommandList className="max-h-[320px]">
            <CommandEmpty>{loadingList ? "Carregando…" : "Nada encontrado."}</CommandEmpty>
            <CommandGroup heading="Estados (UF — 2 dígitos)">
              {UF_LIST.map((e) => (
                <CommandItem
                  key={e.codigo}
                  value={`${e.codigo} ${e.nome} ${e.uf ?? ""}`}
                  onSelect={() => { onChange(e.codigo); setOpen(false); }}
                >
                  <Check className={cn("mr-2 size-4", value === e.codigo ? "opacity-100" : "opacity-0")} />
                  <span className="font-mono text-xs text-muted-foreground w-12">{e.codigo}</span>
                  <span className="ml-2">{e.nome}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            {municipios.length > 0 && (
              <CommandGroup heading={`Municípios (${municipios.length.toLocaleString("pt-BR")})`}>
                {municipios.map((e) => (
                  <CommandItem
                    key={e.codigo}
                    value={`${e.codigo} ${e.nome} ${e.uf ?? ""}`}
                    onSelect={() => { onChange(e.codigo); setOpen(false); }}
                  >
                    <Check className={cn("mr-2 size-4", value === e.codigo ? "opacity-100" : "opacity-0")} />
                    <span className="font-mono text-xs text-muted-foreground w-16">{e.codigo}</span>
                    <span className="ml-2">{e.nome}{e.uf ? ` / ${e.uf}` : ""}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function monthRange(year: number, month: number) {
  const last = new Date(year, month, 0).getDate();
  const mm = String(month).padStart(2, "0");
  return { ini: `${year}-${mm}-01`, fim: `${year}-${mm}-${String(last).padStart(2, "0")}` };
}

export function EntesPanel({ ano, mes }: { ano: number; mes: number }) {
  const pncp = useServerFn(importarContratosPNCP);
  const siconfi = useServerFn(importarRelatorioSICONFI);
  const transf = useServerFn(importarConveniosTransferegov);
  const transfEsp = useServerFn(importarTransferenciasEspeciais);
  const transfFin = useServerFn(importarTransferenciasFinalidade);

  const [uf, setUf] = useState("");
  const [ibge, setIbge] = useState("");
  const [tipoRel, setTipoRel] = useState<"RREO"|"RGF"|"DCA">("RREO");
  const [periodo, setPeriodo] = useState(1);
  const [exer, setExer] = useState(ano);
  const [loading, setLoading] = useState<string | null>(null);

  const { ini, fim } = monthRange(ano, mes);

  async function run(label: string, fn: () => Promise<{ importados?: number; aviso?: string }>) {
    setLoading(label);
    try {
      const r = await fn();
      toast.success(`${label}: ${r.importados ?? 0} registros${r.aviso ? ` — ${r.aviso}` : ""}`);
    } catch (e) {
      toast.error(`${label}: ${(e as Error).message}`);
    } finally {
      setLoading(null);
    }
  }

  const busy = (k: string) => loading === k;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Search className="size-4 text-accent" />
          <h3 className="font-display text-lg">Ente federativo</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          O código IBGE identifica a UF (2 dígitos, ex.: <code>35</code>) ou o município (7 dígitos, ex.: <code>3550308</code>). Use o seletor para buscar por nome — a lista completa é carregada do IBGE na primeira vez que você abrir.
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
            <Input value={ibge} onChange={(e) => setIbge(e.target.value.replace(/\D/g, "").slice(0, 7))} placeholder="manual" className="mt-1 w-40 font-mono" />
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
            <select value={uf} onChange={(e) => setUf(e.target.value)} className="block rounded-md border bg-background px-3 py-2 text-sm">
              {UFS.map((u) => <option key={u} value={u}>{u || "Todas"}</option>)}
            </select>
          </div>
          <Button disabled={!!loading} onClick={() => run("PNCP", () => pncp({ data: { dataInicial: ini, dataFinal: fim, uf: uf || undefined, maxPaginas: 3 } }))}>
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
            <Input type="number" value={exer} onChange={(e) => setExer(Number(e.target.value))} className="w-28" />
          </div>
          <div>
            <Label className="text-xs">Relatório</Label>
            <select value={tipoRel} onChange={(e) => setTipoRel(e.target.value as "RREO"|"RGF"|"DCA")} className="block rounded-md border bg-background px-3 py-2 text-sm">
              <option value="RREO">RREO</option>
              <option value="RGF">RGF</option>
              <option value="DCA">DCA</option>
            </select>
          </div>
          {tipoRel !== "DCA" && (
            <div>
              <Label className="text-xs">Período</Label>
              <Input type="number" value={periodo} onChange={(e) => setPeriodo(Number(e.target.value))} className="w-20" />
            </div>
          )}
          <Button
            disabled={!!loading || !ibge}
            onClick={() =>
              run("SICONFI", () =>
                siconfi({
                  data: {
                    codIbge: ibge,
                    exercicio: exer,
                    periodo: tipoRel === "DCA" ? undefined : periodo,
                    tipoRelatorio: tipoRel,
                  },
                }),
              )
            }
          >
            {busy("SICONFI") ? <Loader2 className="size-4 animate-spin" /> : "Importar SICONFI"}
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h3 className="font-display text-lg flex items-center gap-2">
          <Database className="size-4 text-accent" /> Transferegov — Convênios
        </h3>
        <p className="text-sm text-muted-foreground">
          Convênios e contratos de repasse em {ini} → {fim} (via Portal CGU). Filtra pelo município selecionado acima (apenas para códigos de 7 dígitos).
        </p>
        <div className="flex flex-wrap gap-2 items-end">
          <Button
            disabled={!!loading}
            onClick={() =>
              run("Transferegov", () =>
                transf({
                  data: {
                    dataInicial: ini,
                    dataFinal: fim,
                    codigoIbgeMunicipio: ibge && ibge.length === 7 ? ibge : undefined,
                    maxPaginas: 3,
                  },
                }),
              )
            }
          >
            {busy("Transferegov") ? <Loader2 className="size-4 animate-spin" /> : "Importar Convênios"}
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h3 className="font-display text-lg flex items-center gap-2">
          <Database className="size-4 text-accent" /> Transferegov — Emendas (EC 105/2019)
        </h3>
        <p className="text-sm text-muted-foreground">
          Disponibilizações de recursos de emendas individuais (Transferências
          Especiais e com Finalidade Definida) direto da API oficial do
          Transferegov. A importação é <strong>anual</strong> — usa o ano {ano}
          {" "}selecionado acima (mês é ignorado). Filtros por UF/município são
          aplicados depois, ao consultar os dados.
        </p>
        <div className="flex flex-wrap gap-2 items-end">
          <Button
            disabled={!!loading}
            onClick={() =>
              run("Transf. Especiais", () =>
                transfEsp({ data: { ano, maxPaginas: 6 } }),
              )
            }
          >
            {busy("Transf. Especiais") ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              `Importar Especiais — ${ano}`
            )}
          </Button>
          <Button
            disabled={!!loading}
            variant="outline"
            onClick={() =>
              run("Transf. Finalidade", () =>
                transfFin({ data: { ano, maxPaginas: 6 } }),
              )
            }
          >
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