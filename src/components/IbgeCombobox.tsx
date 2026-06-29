import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";
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
import { UF_LIST, PRESETS, type Ente } from "@/lib/admin-entes/logic";

/**
 * Combobox de UF/Município por código IBGE. Exceção semântica: este widget é
 * autônomo (carrega lista do IBGE sob demanda) e é tratado como primitivo de
 * UI, análogo a `ui/calendar` do shadcn.
 */
export function IbgeCombobox({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (cod: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [municipios, setMunicipios] = useState<Ente[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  useEffect(() => {
    if (!open || municipios.length > 0 || loadingList) return;
    setLoadingList(true);
    fetch("https://servicodados.ibge.gov.br/api/v1/localidades/municipios")
      .then((r) => r.json())
      .then(
        (
          arr: Array<{
            id: number;
            nome: string;
            microrregiao?: { mesorregiao?: { UF?: { sigla?: string } } };
          }>,
        ) => {
          setMunicipios(
            arr.map((m) => ({
              codigo: String(m.id),
              nome: m.nome,
              uf: m.microrregiao?.mesorregiao?.UF?.sigla,
              tipo: "Município" as const,
            })),
          );
        },
      )
      .catch(() => toast.error("Falha ao baixar lista de municípios do IBGE."))
      .finally(() => setLoadingList(false));
  }, [open, municipios.length, loadingList]);

  const all = useMemo<Ente[]>(() => [...UF_LIST, ...municipios], [municipios]);
  const selected =
    all.find((e) => e.codigo === value) ?? PRESETS.find((p) => p.codigo === value);

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
              {selected.nome}
              {selected.uf && selected.tipo === "Município" ? ` / ${selected.uf}` : ""}
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
        <Command
          filter={(val, search) => (val.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}
        >
          <CommandInput
            placeholder={loadingList ? "Carregando municípios…" : "Buscar por nome, UF ou código IBGE…"}
          />
          <CommandList className="max-h-[320px]">
            <CommandEmpty>{loadingList ? "Carregando…" : "Nada encontrado."}</CommandEmpty>
            <CommandGroup heading="Estados (UF — 2 dígitos)">
              {UF_LIST.map((e) => (
                <CommandItem
                  key={e.codigo}
                  value={`${e.codigo} ${e.nome} ${e.uf ?? ""}`}
                  onSelect={() => {
                    onChange(e.codigo);
                    setOpen(false);
                  }}
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
                    onSelect={() => {
                      onChange(e.codigo);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("mr-2 size-4", value === e.codigo ? "opacity-100" : "opacity-0")} />
                    <span className="font-mono text-xs text-muted-foreground w-16">{e.codigo}</span>
                    <span className="ml-2">
                      {e.nome}
                      {e.uf ? ` / ${e.uf}` : ""}
                    </span>
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