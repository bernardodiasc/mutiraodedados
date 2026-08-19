import type { Anomalia } from "@/lib/data/types";

export const SEV_MAP = { alta: "critico", media: "aviso", baixa: "info" } as const;

export const SEV_ORDER: Record<string, number> = { alta: 0, media: 1, baixa: 2 };

export const SEV_STYLES: Record<string, string> = {
  alta: "bg-destructive/10 text-destructive border-destructive/30",
  media: "bg-muted text-foreground border-border",
  baixa: "bg-muted text-muted-foreground border-border",
};

import { REGRA_LABEL_MEMORIA } from "@/lib/sinais-catalogo";

// Derivado do catálogo central de sinais — fonte única dos labels.
export const REGRA_LABEL: Record<string, string> = REGRA_LABEL_MEMORIA;

export type Curl = { label: string; url: string; nota?: string };

const SWAGGER = "https://api.portaldatransparencia.gov.br/swagger-ui/index.html";

export function anoDeEvidencia(e: Record<string, string | number>, now: Date = new Date()): number {
  return Number(e.ano ?? e.ano_anterior ?? now.getFullYear());
}

export function buildCurlsSinal(f: Anomalia, now: Date = new Date()): Curl[] | undefined {
  if (f.entidadeTipo === "contrato") {
    return [
      {
        label: "Endpoint /contratos/id (detalhe oficial)",
        url: `${SWAGGER}#/Contratos%20do%20Poder%20Executivo%20Federal/contrato`,
        nota: `No Swagger, abra "Contratos > /contratos/id", informe id=${f.entidadeId} e clique em "Try it out". Compare valorInicialCompra e valorFinalCompra com o card.`,
      },
    ];
  }
  if (f.entidadeTipo === "orgao") {
    const ano = anoDeEvidencia(f.evidencia, now);
    return [
      {
        label: `Endpoint /contratos do órgão em ${ano}`,
        url: `${SWAGGER}#/Contratos%20do%20Poder%20Executivo%20Federal/contratos`,
        nota: `No Swagger, abra "Contratos > /contratos", preencha codigoOrgao=${f.entidadeId}, dataInicial=01/01/${ano}, dataFinal=31/12/${ano}, pagina=1.`,
      },
    ];
  }
  const contratoAlto = f.evidencia.contrato_alto;
  if (contratoAlto) {
    return [
      {
        label: "Endpoint /contratos/id do contrato citado",
        url: `${SWAGGER}#/Contratos%20do%20Poder%20Executivo%20Federal/contrato`,
        nota: `No Swagger, abra "Contratos > /contratos/id" e informe id=${contratoAlto}.`,
      },
    ];
  }
  return undefined;
}

export function ordenarPorSeveridade(items: Anomalia[]): Anomalia[] {
  return [...items].sort((a, b) => (SEV_ORDER[a.severidade] ?? 9) - (SEV_ORDER[b.severidade] ?? 9));
}

export function filtrarSinais(
  items: Anomalia[],
  regraSel: string | null,
  sevSel: string | null,
): Anomalia[] {
  return items.filter(
    (f) => (!regraSel || f.regra === regraSel) && (!sevSel || f.severidade === sevSel),
  );
}

export function hrefSinal(f: Anomalia): string {
  return f.entidadeTipo === "orgao"
    ? `/orgaos/${f.entidadeId}`
    : f.entidadeTipo === "fornecedor"
      ? `/fornecedores/${f.entidadeId}`
      : `/contratos/${f.entidadeId}`;
}

export function regrasUnicas(items: Anomalia[]): string[] {
  return Array.from(new Set(items.map((f) => f.regra)));
}

export function contarPorSeveridade(items: Anomalia[], sev: string): number {
  return items.filter((f) => f.severidade === sev).length;
}

export function contarPorRegra(items: Anomalia[], regra: string): number {
  return items.filter((f) => f.regra === regra).length;
}
