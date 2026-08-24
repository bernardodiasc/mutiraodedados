import { ehCnpj, ehCpfMascarado, formatarCnpj, soDigitos } from "@/lib/cnpj";

/**
 * Vínculo entre registros de fontes diferentes — o item padronizado que a
 * `SecaoVinculos` renderiza. Conectar dados de fontes distintas é
 * funcionalidade central do projeto; todo vínculo na UI passa por aqui para
 * ter o mesmo visual e o mesmo aviso quando o match é deduzido.
 */
export type VinculoItem = {
  chave: string;
  titulo: string;
  subtitulo?: string;
  /** Valor já formatado (ex.: fmtBRL) exibido à direita. */
  valorFmt?: string;
  /** Rota interna (com $params) — vira <Link> do router. */
  to?: string;
  params?: Record<string, string>;
  search?: Record<string, unknown>;
  /** Link externo (fonte oficial) — usado só quando não há rota interna. */
  href?: string;
  /** Match deduzido (nome, sigla) — exibe aviso de homônimo. */
  inferido?: boolean;
};

/**
 * Vínculo "este documento é um fornecedor" — CNPJ vira link para a ficha.
 * CPF (inclusive mascarado pela origem) não cruza: retorna null e o chamador
 * mantém o texto puro.
 */
export function vinculoDeCnpj(
  documento: string,
  nome: string,
  valorFmt?: string,
): VinculoItem | null {
  if (ehCpfMascarado(documento) || !ehCnpj(documento)) return null;
  const formatado = formatarCnpj(soDigitos(documento));
  return {
    chave: `cnpj-${soDigitos(documento)}`,
    titulo: nome,
    subtitulo: formatado,
    valorFmt,
    // A ficha usa o CNPJ formatado na URL (chave de fornecedores_cache).
    to: "/fornecedores/$cnpj",
    params: { cnpj: formatado },
  };
}

/**
 * Rota interna da ficha de uma entidade citada (ex.: nos alertas de
 * qualidade). Tipos fora do mapa retornam null — o chamador mantém texto.
 */
export function rotaDaEntidade(
  tipo: string,
  id: string,
): Pick<VinculoItem, "to" | "params"> | null {
  switch (tipo) {
    case "contrato":
      return { to: "/contratos/$id", params: { id } };
    case "licitacao":
      return { to: "/licitacoes/$id", params: { id } };
    case "convenio":
      return { to: "/convenios/$id", params: { id } };
    case "emenda":
      return { to: "/emendas/$id", params: { id } };
    case "fornecedor":
      return { to: "/fornecedores/$cnpj", params: { cnpj: formatarCnpj(id) } };
    case "orgao":
      return { to: "/orgaos/$cod", params: { cod: id } };
    case "deputado":
      return { to: "/camara/deputados/$id", params: { id } };
    case "senador":
      return { to: "/senado/senadores/$id", params: { id } };
    case "candidato":
      return { to: "/eleicoes/candidatos/$sq", params: { sq: id } };
    default:
      return null;
  }
}

/**
 * Nome de parlamentar normalizado para match exato entre fontes (autor de
 * emenda × cadastro da Câmara/Senado): sem acentos, caixa alta, espaços
 * únicos. Match por nome é sempre `inferido: true` na UI.
 */
export function normalizarNomeParlamentar(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}
