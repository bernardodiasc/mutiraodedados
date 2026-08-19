/**
 * Agrupamento dos bens declarados ao TSE em categorias legíveis pelo cidadão.
 *
 * Duas camadas, nesta ordem:
 *  1. CD_TIPO_BEM_CANDIDATO (`tipo_bem_cod`) — tabela "Bens e Direitos" da
 *     Receita, em que a DEZENA é o grupo. É o caminho exato.
 *  2. DS_TIPO_BEM_CANDIDATO (`tipo_bem`) — texto livre, casado por palavra-chave.
 *     Fallback para linhas importadas antes de 2026-08 (código NULL) e para
 *     dezenas fora do mapa.
 *
 * Isto mora em `data/tse` e não numa lib de tela porque normalizar tipo de bem é
 * propriedade da FONTE: as server functions importam daqui, e sinais e agregados
 * futuros vão querer o mesmo agrupamento.
 */

export type CategoriaBem = "imoveis" | "veiculos" | "empresas" | "dinheiro" | "creditos" | "outros";

/** Ordem fixa de exibição — é o que mantém as colunas da comparação alinhadas. */
export const CATEGORIAS_BEM_ORDEM: readonly CategoriaBem[] = [
  "imoveis",
  "veiculos",
  "empresas",
  "dinheiro",
  "creditos",
  "outros",
] as const;

export const ROTULO_CATEGORIA_BEM: Record<CategoriaBem, string> = {
  imoveis: "Imóveis",
  veiculos: "Veículos e transporte",
  empresas: "Participação em empresas",
  dinheiro: "Dinheiro, contas e aplicações",
  creditos: "Créditos a receber",
  outros: "Outros bens e direitos",
};

/**
 * CD_TIPO_BEM_CANDIDATO → categoria. Mapa EXATO, não por dezena.
 *
 * Extraído dos 48 códigos distintos que aparecem em `bem_candidato_2026.zip`
 * (Brasil inteiro). A dezena quase funciona como grupo, mas erra em três pontos
 * que justificam o mapa completo:
 *  - há códigos de UM dígito: 1 "Prédio residencial", 2 "Prédio comercial",
 *    3 "Galpão" — todos imóveis. Por dezena, o 2 viraria veículo e o 3, empresa.
 *  - a dezena 2 é "bens móveis", não "veículos": 24 (bem de atividade autônoma),
 *    25 (jóia, arte), 26 (linha telefônica) e 29 não são transporte.
 *  - a dezena 7 (fundos de investimento) não existia nos anos antigos.
 *
 * Ao importar um ano novo, confira com
 * `SELECT DISTINCT tipo_bem_cod, tipo_bem FROM tse_bens_candidato_cache ORDER BY 1`
 * se algum código frequente ficou de fora e caiu em "outros".
 */
const CATEGORIA_POR_CODIGO: Record<string, CategoriaBem> = {
  // Imóveis
  "1": "imoveis", // Prédio residencial
  "2": "imoveis", // Prédio comercial
  "3": "imoveis", // Galpão
  "11": "imoveis", // Apartamento
  "12": "imoveis", // Casa
  "13": "imoveis", // Terreno
  "14": "imoveis", // Terra nua
  "15": "imoveis", // Sala ou conjunto
  "16": "imoveis", // Construção
  "17": "imoveis", // Benfeitorias
  "18": "imoveis", // Loja
  "19": "imoveis", // Outros bens imóveis
  // Transporte
  "21": "veiculos", // Veículo automotor terrestre
  "22": "veiculos", // Aeronave
  "23": "veiculos", // Embarcação
  // Demais bens móveis — não são transporte nem empresa
  "24": "outros", // Bem relacionado com o exercício da atividade autônoma
  "25": "outros", // Jóia, quadro, objeto de arte, de coleção, antiguidade
  "26": "outros", // Linha telefônica
  "29": "outros", // Outros bens móveis
  // Participação em empresas
  "31": "empresas", // Ações
  "32": "empresas", // Quotas ou quinhões de capital
  "39": "empresas", // Outras participações societárias
  // Aplicações e investimentos
  "41": "dinheiro", // Caderneta de poupança
  "45": "dinheiro", // Aplicação de renda fixa (CDB, RDB e outros)
  "46": "dinheiro", // Ouro, ativo financeiro
  "47": "dinheiro", // Mercados futuros, de opções e a termo
  "49": "dinheiro", // Outras aplicações e Investimentos
  // Créditos a receber
  "51": "creditos", // Crédito decorrente de empréstimo
  "52": "creditos", // Crédito decorrente de alienação
  "54": "creditos", // Poupança para construção ou aquisição de bem imóvel
  "59": "creditos", // Outros créditos e poupança vinculados
  // Depósitos e numerário
  "61": "dinheiro", // Depósito bancário em conta corrente no País
  "62": "dinheiro", // Depósito bancário em conta corrente no exterior
  "63": "dinheiro", // Dinheiro em espécie - moeda nacional
  "64": "dinheiro", // Dinheiro em espécie - moeda estrangeira
  "69": "dinheiro", // Outros depósitos à vista e numerário
  // Fundos de investimento
  "71": "dinheiro", // Fundo de Curto Prazo
  "72": "dinheiro", // Fundo de Longo Prazo e FIDC
  "73": "dinheiro", // Fundo de Investimento Imobiliário
  "74": "dinheiro", // Fundos: Ações, Mútuos de Privatização, etc.
  "79": "dinheiro", // Outros fundos
  // Outros bens e direitos
  "91": "outros", // Licença e concessões especiais
  "92": "outros", // Título de clube e assemelhado
  "93": "outros", // Direito de autor, de inventor e patente
  "95": "creditos", // Consórcio não contemplado — é direito a receber
  "96": "outros", // Leasing
  "97": "dinheiro", // VGBL
  "99": "outros", // Outros bens e direitos
};

/**
 * Dezena → categoria, só para códigos futuros fora do mapa acima.
 * A 2 aponta para "outros" (bens móveis em geral), não para veículos: um código
 * 2x desconhecido tem mais chance de ser jóia ou equipamento do que transporte.
 */
const CATEGORIA_POR_DEZENA: Record<string, CategoriaBem> = {
  "1": "imoveis",
  "2": "outros",
  "3": "empresas",
  "4": "dinheiro",
  "5": "creditos",
  "6": "dinheiro",
  "7": "dinheiro",
  "9": "outros",
};

/**
 * Descrições que o código sozinho classificaria mal.
 *
 * "Fundo de comércio" e "empresário individual" descrevem uma EMPRESA, mas o TSE
 * os arquiva fora da dezena 3 em alguns anos — sem esta exceção cairiam em
 * "dinheiro" (por "fundo") ou em "outros". Checada antes do código, de propósito.
 */
const SOBREPOE_DESCRICAO: Array<[RegExp, CategoriaBem]> = [
  [/fundo de comercio|empresario individual|firma individual/, "empresas"],
];

/**
 * Palavra-chave → categoria, PRIMEIRA QUE CASAR VENCE.
 *
 * A ordem é o conteúdo desta lista, não um detalhe: "empresas" e "creditos" vêm
 * antes de "dinheiro" porque "título de capital" casaria com "titulo" e
 * "crédito … em conta corrente" casaria com "conta corrente".
 */
const REGRAS_DESCRICAO: Array<[RegExp, CategoriaBem]> = [
  // \bacoes\b é obrigatório: sem o limite, "aplicacoes" casa com "acoes".
  [/quota|quinha|\bacoes\b|participacao societaria|capital social|titulo de capital/, "empresas"],
  [/credito|emprestimo|direito de aquisic|adiantamento|haveres|alienac/, "creditos"],
  [
    /\bcasa\b|apartamento|terreno|imovel|imoveis|\bsala\b|conjunto|\bloja\b|predio|galpao|terra nua|benfeitoria|construcao|fazenda|sitio|chacara/,
    "imoveis",
  ],
  [/veiculo|automovel|motocicleta|caminhao|aeronave|embarcacao|trator|bicicleta/, "veiculos"],
  [
    /deposito|conta corrente|poupanca|dinheiro em especie|aplicac|renda fixa|\bfundo\b|titulo publico|vgbl|pgbl|previdencia|\bouro\b|cripto|mercado futuro/,
    "dinheiro",
  ],
];

/**
 * Chave de comparação da descrição: sem acento, minúscula, e cortada no primeiro
 * `:` — o TSE escreve "Veículo automotor terrestre: caminhão, automóvel, moto,
 * etc.", e a enumeração depois dos dois-pontos só atrapalha o casamento.
 */
function chaveDescricao(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(":")[0]
    .replace(/\s+/g, " ")
    .trim();
}

/** Categoria de um bem. Nunca lança; o que não casa vira "outros". */
export function categoriaDoBem(
  cod: string | null | undefined,
  tipoBem: string | null | undefined,
): CategoriaBem {
  const chave = tipoBem ? chaveDescricao(tipoBem) : "";

  for (const [regex, categoria] of SOBREPOE_DESCRICAO) {
    if (regex.test(chave)) return categoria;
  }

  // Zeros à esquerda ("09") não aparecem hoje, mas normalizar é barato.
  const digitos = (cod ?? "").replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  if (digitos) {
    const exato = CATEGORIA_POR_CODIGO[digitos];
    if (exato) return exato;
    const porDezena = CATEGORIA_POR_DEZENA[digitos[0]];
    if (porDezena) return porDezena;
  }

  for (const [regex, categoria] of REGRAS_DESCRICAO) {
    if (regex.test(chave)) return categoria;
  }
  return "outros";
}

export type AgregadoCategoria = {
  categoria: CategoriaBem;
  total: number;
  quantidade: number;
};

/**
 * Soma os bens por categoria. Um bem sem valor conta na quantidade mas não no
 * total — some-lo como zero esconderia que a declaração veio incompleta.
 * Devolve só as categorias presentes, na ordem de CATEGORIAS_BEM_ORDEM.
 */
export function agregarPorCategoria(
  bens: Array<{ tipo_bem_cod?: string | null; tipo_bem: string | null; valor: number | null }>,
): AgregadoCategoria[] {
  const acc = new Map<CategoriaBem, AgregadoCategoria>();
  for (const b of bens) {
    const categoria = categoriaDoBem(b.tipo_bem_cod, b.tipo_bem);
    const atual = acc.get(categoria) ?? { categoria, total: 0, quantidade: 0 };
    atual.total += b.valor ?? 0;
    atual.quantidade += 1;
    acc.set(categoria, atual);
  }
  return CATEGORIAS_BEM_ORDEM.filter((c) => acc.has(c)).map((c) => acc.get(c)!);
}
