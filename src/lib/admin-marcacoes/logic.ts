import type { listarContestacoesAdmin } from "@/lib/data/marcacoes.functions";

export const STATUS_CONTESTACAO = [
  "aberta",
  "em_analise",
  "respondida",
  "arquivada",
] as const;
export type StatusContestacao = (typeof STATUS_CONTESTACAO)[number];

export const TIPO_CONTESTACAO_LABEL: Record<string, string> = {
  correcao_factual: "Correção factual",
  dado_desatualizado: "Dado desatualizado",
  pii_exposicao: "Exposição de PII",
  classificacao_inadequada: "Classificação inadequada",
  outro: "Outro",
};

export type Contestacao = Awaited<
  ReturnType<typeof listarContestacoesAdmin>
>[number];

export type EntidadeTipo = "orgao" | "fornecedor" | "contrato";
export type Aba = "contestacoes" | "marcacoes";

export function buildCurlsMarcacao(
  entidadeTipo: string,
  entidadeId: string,
) {
  if (entidadeTipo !== "contrato") return undefined;
  return [
    {
      label: "Endpoint /contratos/id (detalhe oficial)",
      url: `https://api.portaldatransparencia.gov.br/swagger-ui/index.html#/Contratos%20do%20Poder%20Executivo%20Federal/contrato`,
      nota: `No Swagger oficial, abra "Contratos > /contratos/id", informe id=${entidadeId} e compare valorInicialCompra/valorFinalCompra com o card.`,
    },
  ];
}

export function severidadeFromVotos(
  votos_score: number,
): "critico" | "aviso" | "info" {
  if (votos_score >= 5) return "critico";
  if (votos_score >= 1) return "aviso";
  return "info";
}

export function hrefEntidade(tipo: string, id: string): string {
  if (tipo === "orgao") return `/orgaos/${id}`;
  if (tipo === "fornecedor") return `/fornecedores/${id}`;
  return `/contratos/${id}`;
}

export function contestacaoDirty(
  item: Pick<Contestacao, "status" | "resposta">,
  status: string,
  resposta: string,
): boolean {
  return status !== item.status || resposta !== (item.resposta ?? "");
}