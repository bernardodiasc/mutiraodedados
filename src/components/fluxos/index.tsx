import * as React from "react";
import { FluxoContratoPNCP } from "./FluxoContratoPNCP";

export type FluxoMeta = {
  nome: string;
  titulo: string;
  descricao: string;
  Componente: React.ComponentType;
};

/**
 * Biblioteca central de fluxos/ilustrações.
 * Adicione novos diagramas como componentes React em src/components/fluxos/
 * e registre aqui. Eles ficam embutíveis nos artigos via shortcode markdown:
 *
 *     :::fluxo{nome="contrato-pncp"}:::
 */
export const FLUXOS: Record<string, FluxoMeta> = {
  "contrato-pncp": {
    nome: "contrato-pncp",
    titulo: "Caminho de um contrato no PNCP",
    descricao:
      "Da publicação do edital à execução: como um contrato federal aparece nos dados públicos.",
    Componente: FluxoContratoPNCP,
  },
};

export function FluxoEmbed({ nome }: { nome: string }) {
  const meta = FLUXOS[nome];
  if (!meta) {
    return (
      <div className="my-6 rounded-lg border border-dashed border-destructive/40 bg-destructive/5 p-4 text-xs text-destructive">
        Fluxo desconhecido: <code>{nome}</code>
      </div>
    );
  }
  const C = meta.Componente;
  return (
    <figure className="my-8 rounded-xl border border-border bg-card/60 p-5">
      <C />
      <figcaption className="mt-3 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{meta.titulo}</span> — {meta.descricao}
      </figcaption>
    </figure>
  );
}