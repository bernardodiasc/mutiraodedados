import { soDigitos } from "@/lib/cnpj";

/** Ícone serializável do passo (a View resolve para o componente lucide). */
export type IconePassoInvestigacao = "documento" | "empresa" | "busca" | "envio" | "terminal";

export type PassoInvestigacao = {
  titulo: string;
  texto: string;
  link?: string | null;
  linkLabel?: string;
  icone?: IconePassoInvestigacao;
  /** Bloco de código copiável (ex.: comando de reprodução na fonte). */
  codigo?: string;
};

/**
 * Roteiro cidadão de investigação de uma anomalia — extraído do antigo
 * ChecklistInvestigacao. Puro para ser testável; o painel renderiza.
 */
export function passosParaAnomalia(anomalia: {
  entidadeTipo: string;
  entidadeId: string;
}): PassoInvestigacao[] {
  const cnpjLimpo = anomalia.entidadeTipo === "fornecedor" ? soDigitos(anomalia.entidadeId) : "";

  return [
    {
      icone: "documento",
      titulo: "Leia o objeto e a modalidade",
      texto:
        "Volte ao(s) contrato(s) envolvidos. Veja se a descrição é específica e se a modalidade (pregão, dispensa, inexigibilidade) faz sentido para o tipo de despesa.",
    },
    {
      icone: "empresa",
      titulo: "Cheque o quadro do fornecedor",
      texto:
        "Procure pelo CNPJ no Cadastro da Receita e em buscadores públicos. Veja capital social, sócios, data de abertura e atividade principal (CNAE).",
      link: cnpjLimpo ? `https://cnpj.biz/${cnpjLimpo}` : null,
      linkLabel: "Abrir CNPJ.biz",
    },
    {
      icone: "busca",
      titulo: "Compare com pares",
      texto:
        "Outros fornecedores prestam serviço parecido? Compare valores médios entre órgãos da mesma função. Use /buscar para encontrar contratos análogos pelo CNPJ ou palavra-chave do objeto.",
    },
    {
      icone: "envio",
      titulo: "Peça informação via LAI",
      texto:
        "Cidadãos podem solicitar pelo Fala.BR (CGU) o termo de referência, parecer jurídico e justificativa de dispensa. O órgão tem até 20 dias úteis para responder.",
      link: "https://falabr.cgu.gov.br/",
      linkLabel: "Abrir Fala.BR",
    },
    {
      icone: "envio",
      titulo: "Se houver indício forte, denuncie",
      texto:
        "Denúncias ao TCU (controle externo) ou ao Ministério Público Federal são gratuitas. Anomalia estatística não basta — descreva o fato, junte evidências e indique o dispositivo legal aparentemente violado.",
      link: "https://contas.tcu.gov.br/ords/f?p=2300",
      linkLabel: "Ouvidoria do TCU",
    },
  ];
}
