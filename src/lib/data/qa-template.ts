/**
 * Gera texto pronto para denúncia oficial a partir de um finding.
 * O texto é editável no modal antes do envio.
 */
import { canalParaFonte } from "./qa-canais";
import type { AnomaliaInput } from "@/lib/anomalia";

const REGRA_HUMANIZADA: Record<string, string> = {
  valor_final_menor_inicial: "o valor final retornado é menor que o valor inicial do contrato",
  valor_final_truncado_suspeito:
    "o valor final retornado parece truncado (muito menor que o valor inicial)",
  valor_global_menor_inicial: "o valor global do contrato é menor que o valor inicial",
  valor_global_zerado: "o valor global retornado é zero, embora exista valor inicial",
  liquido_maior_documento: "o valor líquido pago é maior que o valor do documento",
  valor_negativo: "o valor reembolsado é negativo",
  repasse_maior_global: "o valor de repasse é maior que o valor global do instrumento",
  valor_revalidado_divergente: "o endpoint de detalhe retorna valor diferente do endpoint de lista",
  valor_negativo_em_conta_positiva: "valor negativo em conta que tipicamente é positiva",
  valor_muito_baixo: "o valor retornado pelo endpoint de lista é suspeitosamente baixo (< R$ 100)",
};

function fmtBRL(n: number | null | undefined): string {
  const v = Number(n ?? 0);
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function gerarTextoReporte(
  anomalia: AnomaliaInput,
  siteOrigin: string,
): {
  assunto: string;
  corpo: string;
} {
  const canal = canalParaFonte(anomalia.fonte);
  const fonteLabel = canal?.fonteLabel ?? anomalia.fonte;
  const explicacao = REGRA_HUMANIZADA[anomalia.regra] ?? `regra ${anomalia.regra}`;

  const assunto = `Inconsistência de dados — ${anomalia.entidade.tipo} ${anomalia.entidade.id} (${fonteLabel})`;

  const linhas: string[] = [];
  linhas.push("Prezados,");
  linhas.push("");
  linhas.push(
    `Identifiquei inconsistência nos dados publicados em ${fonteLabel} para o registro abaixo, em que ${explicacao}:`,
  );
  linhas.push("");
  linhas.push(`- Tipo: ${anomalia.entidade.tipo}`);
  linhas.push(`- Identificador: ${anomalia.entidade.id}`);
  if (anomalia.entidade.url_oficial) {
    linhas.push(`- URL oficial: ${anomalia.entidade.url_oficial}`);
  }
  linhas.push("");
  if (anomalia.comparacao) {
    linhas.push("Discrepância observada:");
    if (anomalia.comparacao.armazenado != null)
      linhas.push(`- Valor obtido via API/lista: ${fmtBRL(anomalia.comparacao.armazenado)}`);
    if (anomalia.comparacao.esperado != null)
      linhas.push(`- Valor esperado / detalhe: ${fmtBRL(anomalia.comparacao.esperado)}`);
    linhas.push("");
  }
  linhas.push(
    "Solicito que o valor correto passe a ser retornado de forma consistente em todos os endpoints e na interface pública.",
  );
  linhas.push("");
  linhas.push(`Caso documentado em: ${siteOrigin}/qualidade/${anomalia.id}`);
  linhas.push(`Detectado em: ${new Date(anomalia.detectado_em).toLocaleDateString("pt-BR")}`);
  linhas.push("");
  linhas.push("Atenciosamente,");

  return { assunto, corpo: linhas.join("\n") };
}
