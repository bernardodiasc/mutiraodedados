import * as React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PainelExplicar } from "@/components/PainelExplicar";
import { FONTE_SINAL_LABEL, type SinalCatalogo, type SinalTipo } from "@/lib/sinais-catalogo";

const TIPO_BADGE: Record<SinalTipo, { label: string; classe: string }> = {
  qualidade: { label: "Qualidade", classe: "bg-muted text-foreground border-border" },
  lacuna: { label: "Lacuna", classe: "bg-accent/10 text-accent border-accent/30" },
  investigativo: {
    label: "Investigativo",
    classe: "bg-destructive/10 text-destructive border-destructive/30",
  },
};

/**
 * Box colapsável "Como ler esta página" — tabela completa das regras de sinal
 * relevantes à página, alimentada pelo catálogo central (src/lib/sinais-catalogo).
 * Puramente apresentacional (sem I/O); o shell colapsável é o `PainelExplicar`.
 * Fica entre a apresentação e o conteúdo de /qualidade, /lacunas e /anomalias.
 */
export function BoxComoLerSinais({
  titulo,
  descricao,
  sinais,
  abertoInicial = false,
  avisoSinais = true,
  children,
}: {
  titulo: string;
  descricao?: React.ReactNode;
  sinais: SinalCatalogo[];
  abertoInicial?: boolean;
  /** Rodapé "sinais ≠ acusações" do PainelExplicar; padrão ligado nas páginas de sinais. */
  avisoSinais?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <PainelExplicar titulo={titulo} abertoInicial={abertoInicial} avisoSinais={avisoSinais}>
      {descricao && <div className="space-y-2 max-w-3xl">{descricao}</div>}
      <div className="overflow-x-auto rounded-md border border-border">
        <Table className="min-w-[860px]">
          <TableHeader>
            <TableRow className="text-[11px] uppercase tracking-wider">
              <TableHead className="w-[220px]">Sinal</TableHead>
              <TableHead className="w-[110px]">Tipo</TableHead>
              <TableHead className="w-[150px]">Fonte</TableHead>
              <TableHead>O que detecta</TableHead>
              <TableHead className="w-[220px]">Limiares</TableHead>
              <TableHead className="w-[150px]">Severidade</TableHead>
              <TableHead className="w-[130px]">Onde roda</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sinais.map((s) => {
              const tipo = TIPO_BADGE[s.tipo];
              return (
                <TableRow key={`${s.slug}-${s.fontes.join("-")}`} className="align-top">
                  <TableCell className="align-top">
                    <div className="font-medium text-foreground">{s.label}</div>
                    <code className="text-[11px] text-muted-foreground">{s.slug}</code>
                    {!s.ativa && (
                      <span className="ml-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                        (aposentada)
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="align-top">
                    <span
                      className={`inline-block rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${tipo.classe}`}
                    >
                      {tipo.label}
                    </span>
                  </TableCell>
                  <TableCell className="align-top text-xs">
                    {s.fontes.map((f) => FONTE_SINAL_LABEL[f] ?? f).join(", ")}
                  </TableCell>
                  <TableCell className="align-top text-xs">{s.oQueDetecta}</TableCell>
                  <TableCell className="align-top text-xs">{s.limiares}</TableCell>
                  <TableCell className="align-top text-xs">{s.severidade}</TableCell>
                  <TableCell className="align-top text-xs">{s.ondeRoda}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {children}
    </PainelExplicar>
  );
}
