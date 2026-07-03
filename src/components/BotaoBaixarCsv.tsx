import { Download } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { downloadCSV } from "@/lib/csv";

export type BotaoBaixarCsvProps<T extends Record<string, unknown>> = {
  /** Nome do arquivo sem extensão (".csv" é acrescentado). */
  filename: string;
  /** Linhas a exportar — função para que a montagem só ocorra no clique. */
  obterLinhas: () => T[];
  colunas?: (keyof T)[];
  rotulo?: string;
  disabled?: boolean;
  size?: ButtonProps["size"];
  variant?: ButtonProps["variant"];
  className?: string;
};

/** Primitivo "Baixar CSV": só onde há dados tabulares (nunca em prosa). */
export function BotaoBaixarCsv<T extends Record<string, unknown>>({
  filename,
  obterLinhas,
  colunas,
  rotulo = "Baixar CSV",
  disabled,
  size = "sm",
  variant = "outline",
  className,
}: BotaoBaixarCsvProps<T>) {
  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      className={className}
      disabled={disabled}
      title={rotulo}
      onClick={() => downloadCSV(filename, obterLinhas(), colunas)}
    >
      <Download className="size-3.5" />
      <span>{rotulo}</span>
    </Button>
  );
}
BotaoBaixarCsv.displayName = "BotaoBaixarCsv";
