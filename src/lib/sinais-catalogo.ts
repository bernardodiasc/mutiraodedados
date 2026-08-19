/**
 * CATÁLOGO CENTRAL DE SINAIS — fonte única das descrições públicas de todas as
 * regras de detecção da plataforma, nos três tipos da taxonomia
 * (docs/qualidade-dados.md): alerta de qualidade, lacuna e sinal investigativo.
 *
 * Consumido por: os boxes "Como ler esta página" de /qualidade, /lacunas e
 * /anomalias (BoxComoLerSinais), pelos filtros dessas páginas e do admin, e
 * pela /metodologia (labels/tipos; a prosa longa continua lá).
 *
 * Módulo puro e client-safe: NÃO importar nada de *.server / *.functions.
 * As regras de detecção em si vivem em src/lib/data/qa.ts, src/lib/anomalias.ts
 * e src/lib/data/tse/{qualidade,lacunas,investigativos}.ts — toda regra nova
 * deve ganhar uma entrada aqui (o teste do catálogo cobra isso).
 */

export type SinalTipo = "qualidade" | "lacuna" | "investigativo";

export type SinalOndeRoda =
  | "importação"
  | "pós-importação"
  | "revalidação"
  | "em memória na página";

export type SinalCatalogo = {
  /** Slug da regra, como aparece em qa_findings.regra (ou em /anomalias). */
  slug: string;
  label: string;
  tipo: SinalTipo;
  /** Fontes onde a regra roda (slugs de QaFonte; "contratos" p/ as em memória). */
  fontes: string[];
  /** Frase cidadã: o que a regra detecta. */
  oQueDetecta: string;
  /** Limiares/parâmetros objetivos da detecção. */
  limiares: string;
  /** Severidade com que o sinal nasce. */
  severidade: string;
  ondeRoda: SinalOndeRoda;
  /** "banco" = persistido em qa_findings; "memoria" = calculado na página. */
  persistencia: "banco" | "memoria";
  /** false = regra aposentada (documentada porque pode existir no banco). */
  ativa: boolean;
};

export const FONTE_SINAL_LABEL: Record<string, string> = {
  cgu: "Contratos (CGU)",
  cgu_licitacoes: "Licitações (CGU)",
  cgu_emendas: "Emendas (CGU)",
  cgu_convenios: "Convênios (CGU)",
  pncp: "PNCP",
  camara_ceap: "Câmara (CEAP)",
  senado_ceaps: "Senado (CEAPS)",
  transferegov: "Transferegov",
  siconfi: "SICONFI",
  tse: "TSE",
  "tse-cruzamento": "TSE (cruzamentos)",
  contratos: "Contratos (derivado em memória)",
};

export const SINAIS_CATALOGO: SinalCatalogo[] = [
  // ---------------------------------------------------------------------
  // Alertas de qualidade — Contratos (Portal CGU)
  // ---------------------------------------------------------------------
  {
    slug: "valor_corrigido_listagem",
    label: "Valor truncado corrigido",
    tipo: "qualidade",
    fontes: ["cgu"],
    oQueDetecta:
      "A API da CGU devolveu o valor do contrato truncado por escala (÷100/1000/10000) na listagem ou no detalhe; gravamos o valor não-truncado, que bate com o documento oficial.",
    limiares:
      "Razão ≥ 100× entre as leituras da listagem e do detalhe do mesmo contrato; evidência bruta (leituras + horários) fica no alerta.",
    severidade: "info — já nasce resolvido (corrigido automaticamente)",
    ondeRoda: "importação",
    persistencia: "banco",
    ativa: true,
  },
  {
    slug: "fornecedor_ausente",
    label: "Fornecedor sigiloso ou ausente",
    tipo: "qualidade",
    fontes: ["cgu"],
    oQueDetecta:
      "Contrato sem CNPJ/CPF do fornecedor na API (sigiloso ou ausente). O contrato é salvo mesmo assim, com marcador, para investigação.",
    limiares: "Nenhum documento de fornecedor presente no registro da API.",
    severidade: "aviso",
    ondeRoda: "importação",
    persistencia: "banco",
    ativa: true,
  },
  {
    slug: "discrepancia_extrema_inicial_final",
    label: "Discrepância extrema inicial × final",
    tipo: "qualidade",
    fontes: ["cgu"],
    oQueDetecta:
      "Valor inicial e final do mesmo contrato diferem em 1000× ou mais — provável erro de escala/digitação em um dos campos.",
    limiares:
      "inicial ≥ 1000× o final (aviso — redução pode ser legítima) ou final ≥ 1000× o inicial (crítico).",
    severidade: "crítico ou aviso, conforme a direção",
    ondeRoda: "importação",
    persistencia: "banco",
    ativa: true,
  },
  {
    slug: "valor_muito_baixo",
    label: "Valor muito baixo",
    tipo: "qualidade",
    fontes: ["cgu"],
    oQueDetecta:
      "Contrato com valor oficial abaixo de R$ 100 — pode ser contrato pequeno real ou defeito persistente da fonte; a re-checagem desambigua.",
    limiares: "0 < valor final < R$ 100.",
    severidade: "aviso",
    ondeRoda: "importação",
    persistencia: "banco",
    ativa: true,
  },
  // ---------------------------------------------------------------------
  // Licitações / Emendas / Convênios (CGU) e Transferegov
  // ---------------------------------------------------------------------
  {
    slug: "licitacao_sem_desfecho",
    label: "Certame sem desfecho",
    tipo: "investigativo",
    fontes: ["cgu_licitacoes"],
    oQueDetecta:
      "Licitação revogada, anulada, fracassada ou deserta — gasto planejado que não se concretizou. O dado está correto; o padrão é que merece atenção.",
    limiares: "Situação da compra contém revogada/anulada/fracassada/deserta.",
    severidade: "aviso",
    ondeRoda: "importação",
    persistencia: "banco",
    ativa: true,
  },
  {
    slug: "data_abertura_ausente",
    label: "Data de abertura ausente",
    tipo: "qualidade",
    fontes: ["cgu_licitacoes"],
    oQueDetecta: "Licitação sem data de abertura — não é posicionável na linha do tempo.",
    limiares: "Campo dataAbertura vazio.",
    severidade: "aviso",
    ondeRoda: "importação",
    persistencia: "banco",
    ativa: true,
  },
  {
    slug: "ano_invalido",
    label: "Ano implausível",
    tipo: "qualidade",
    fontes: ["cgu_licitacoes"],
    oQueDetecta: "Licitação datada antes de 1988 ou depois do ano que vem.",
    limiares: "ano < 1988 ou ano > ano atual + 1.",
    severidade: "aviso",
    ondeRoda: "importação",
    persistencia: "banco",
    ativa: true,
  },
  {
    slug: "valor_negativo",
    label: "Valor negativo",
    tipo: "qualidade",
    fontes: ["cgu_licitacoes", "cgu_emendas", "cgu_convenios", "senado_ceaps"],
    oQueDetecta:
      "Valor negativo onde é impossível (licitação, fases da emenda, convênio, reembolso da cota do Senado).",
    limiares: "valor < 0 (Senado: aviso — pode ser estorno; demais: crítico).",
    severidade: "crítico (CGU) / aviso (Senado)",
    ondeRoda: "importação",
    persistencia: "banco",
    ativa: true,
  },
  {
    slug: "valor_truncado_suspeito",
    label: "Valor ínfimo (suspeita de truncamento)",
    tipo: "qualidade",
    fontes: ["cgu_licitacoes", "cgu_emendas", "cgu_convenios", "transferegov"],
    oQueDetecta:
      "Valor entre R$ 0 e R$ 100 em registro que normalmente vale milhares — assinatura do mesmo bug de escala da CGU nas entidades sem endpoint de detalhe para conferência.",
    limiares:
      "0 < valor < R$ 100 (licitações: valor; emendas: empenhado; convênios/Transferegov: global).",
    severidade: "aviso",
    ondeRoda: "importação",
    persistencia: "banco",
    ativa: true,
  },
  {
    slug: "pago_maior_empenhado",
    label: "Pago maior que empenhado",
    tipo: "qualidade",
    fontes: ["cgu_emendas"],
    oQueDetecta: "Emenda com valor pago acima do empenhado — não se paga o que não se reservou.",
    limiares: "pago > empenhado × 1,001 (tolerância de 0,1% para arredondamento).",
    severidade: "crítico",
    ondeRoda: "importação",
    persistencia: "banco",
    ativa: true,
  },
  {
    slug: "liquidado_maior_empenhado",
    label: "Liquidado maior que empenhado",
    tipo: "qualidade",
    fontes: ["cgu_emendas"],
    oQueDetecta: "Emenda com valor liquidado acima do empenhado.",
    limiares: "liquidado > empenhado × 1,001.",
    severidade: "aviso",
    ondeRoda: "importação",
    persistencia: "banco",
    ativa: true,
  },
  {
    slug: "liberado_maior_global",
    label: "Liberado maior que o global",
    tipo: "qualidade",
    fontes: ["cgu_convenios"],
    oQueDetecta: "Convênio com repasse liberado acima do valor global pactuado.",
    limiares: "liberado > global × 1,001.",
    severidade: "aviso",
    ondeRoda: "importação",
    persistencia: "banco",
    ativa: true,
  },
  {
    slug: "repasse_maior_global",
    label: "Repasse maior que o global",
    tipo: "qualidade",
    fontes: ["transferegov"],
    oQueDetecta: "Instrumento com repasse acima do valor global pactuado.",
    limiares: "repasse > global × 1,01.",
    severidade: "crítico",
    ondeRoda: "importação",
    persistencia: "banco",
    ativa: true,
  },
  // ---------------------------------------------------------------------
  // PNCP / Câmara / SICONFI
  // ---------------------------------------------------------------------
  {
    slug: "valor_global_menor_inicial",
    label: "Global menor que o inicial",
    tipo: "qualidade",
    fontes: ["pncp"],
    oQueDetecta: "Contrato PNCP com valor global menor que metade do inicial.",
    limiares: "global < inicial × 0,5 (com ambos > 0).",
    severidade: "crítico",
    ondeRoda: "importação",
    persistencia: "banco",
    ativa: true,
  },
  {
    slug: "valor_global_zerado",
    label: "Global zerado",
    tipo: "qualidade",
    fontes: ["pncp"],
    oQueDetecta: "Contrato PNCP com valor global zerado apesar de valor inicial positivo.",
    limiares: "global = 0 com inicial > 0.",
    severidade: "aviso",
    ondeRoda: "importação",
    persistencia: "banco",
    ativa: true,
  },
  {
    slug: "liquido_maior_documento",
    label: "Líquido maior que o documento",
    tipo: "qualidade",
    fontes: ["camara_ceap"],
    oQueDetecta:
      "Reembolso da cota parlamentar maior que o valor do documento fiscal — impossível.",
    limiares: "valor líquido > valor do documento × 1,01 (tolerância para glosas).",
    severidade: "crítico",
    ondeRoda: "importação",
    persistencia: "banco",
    ativa: true,
  },
  {
    slug: "valor_negativo_em_conta_positiva",
    label: "Receita negativa",
    tipo: "qualidade",
    fontes: ["siconfi"],
    oQueDetecta:
      "Valor negativo em conta de receita ou transferência nos relatórios fiscais (RREO/RGF/DCA).",
    limiares: "valor < 0 em conta contendo 'receita' ou 'transfer'.",
    severidade: "aviso — deduções (ex.: FUNDEB) podem ser legítimas",
    ondeRoda: "importação",
    persistencia: "banco",
    ativa: true,
  },
  // ---------------------------------------------------------------------
  // TSE — alertas de qualidade
  // ---------------------------------------------------------------------
  {
    slug: "cpf_cnpj_invalido",
    label: "CPF/CNPJ inválido",
    tipo: "qualidade",
    fontes: ["tse"],
    oQueDetecta:
      "Documento não mascarado que não passa na validação de dígito verificador — defeito de captura na origem.",
    limiares: "DV padrão de CPF (11 dígitos) e CNPJ (14); mascarados (***) não são validados.",
    severidade: "aviso",
    ondeRoda: "importação",
    persistencia: "banco",
    ativa: true,
  },
  {
    slug: "valor_invalido",
    label: "Valor impossível",
    tipo: "qualidade",
    fontes: ["tse"],
    oQueDetecta: "Valor negativo em doação, despesa ou bem declarado.",
    limiares: "valor < 0 após normalização da vírgula decimal.",
    severidade: "crítico",
    ondeRoda: "importação",
    persistencia: "banco",
    ativa: true,
  },
  {
    slug: "data_impossivel",
    label: "Data fora da janela da eleição",
    tipo: "qualidade",
    fontes: ["tse"],
    oQueDetecta: "Receita/despesa de campanha datada muito antes ou depois do ciclo eleitoral.",
    limiares: "ano da data fora de [ano da eleição − 1, ano da eleição + 1].",
    severidade: "aviso",
    ondeRoda: "importação",
    persistencia: "banco",
    ativa: true,
  },
  {
    slug: "sentinela_nao_tratada",
    label: "Sentinela não tratada",
    tipo: "qualidade",
    fontes: ["tse"],
    oQueDetecta:
      "Sentinela do TSE (#NULO#, #NE, NÃO DIVULGÁVEL…) vazando para campo já normalizado — autoteste do nosso parser.",
    limiares: "Padrão textual das sentinelas em campo pós-normalização.",
    severidade: "aviso",
    ondeRoda: "importação",
    persistencia: "banco",
    ativa: true,
  },
  {
    slug: "duplicata_importacao",
    label: "Duplicata no lote",
    tipo: "qualidade",
    fontes: ["tse"],
    oQueDetecta: "Duas linhas com a mesma chave natural no mesmo lote de importação.",
    limiares: "Colisão de id dentro do lote (2018+: SQ oficial; 2014/2016: hash determinístico).",
    severidade: "aviso",
    ondeRoda: "importação",
    persistencia: "banco",
    ativa: true,
  },
  {
    slug: "encoding_suspeito",
    label: "Encoding suspeito",
    tipo: "qualidade",
    fontes: ["tse"],
    oQueDetecta:
      "Caractere de substituição (�) após decodificar Latin-1 — byte corrompido na origem.",
    limiares: "Presença de U+FFFD em qualquer campo textual.",
    severidade: "info",
    ondeRoda: "importação",
    persistencia: "banco",
    ativa: true,
  },
  {
    slug: "ponte_baixa_confianca",
    label: "Vínculo parlamentar↔candidato de baixa confiança",
    tipo: "qualidade",
    fontes: ["tse"],
    oQueDetecta:
      "Vínculo entre parlamentar e candidatura derivado por nome (não CPF) com confiança baixa — fica em fila de revisão.",
    limiares: "confiança do matcher < 0,8.",
    severidade: "info",
    ondeRoda: "pós-importação",
    persistencia: "banco",
    ativa: true,
  },
  {
    slug: "divergencia_api_csv",
    label: "Divergência API × CSV",
    tipo: "qualidade",
    fontes: ["tse"],
    oQueDetecta:
      "O cache (importado do CSV) diverge da API DivulgaCandContas na revalidação pontual (situação de totalização, nome de urna).",
    limiares: "Comparação campo a campo na revalidação de um candidato.",
    severidade: "aviso",
    ondeRoda: "revalidação",
    persistencia: "banco",
    ativa: true,
  },
  // ---------------------------------------------------------------------
  // TSE — lacunas
  // ---------------------------------------------------------------------
  {
    slug: "eleito_sem_prestacao_contas",
    label: "Eleito sem prestação de contas",
    tipo: "lacuna",
    fontes: ["tse"],
    oQueDetecta:
      "Candidato eleito sem nenhuma receita/despesa — a lei exige prestação de contas final. Confirmado na API antes de publicar; se a API mostra gasto que não temos, vira alerta de qualidade (falha da nossa importação).",
    limiares:
      "Situação 'eleito' + zero receitas e despesas no cache + confirmação na API DivulgaCandContas.",
    severidade: "aviso",
    ondeRoda: "pós-importação",
    persistencia: "banco",
    ativa: true,
  },
  {
    slug: "candidato_sem_bens",
    label: "Candidato sem declaração de bens",
    tipo: "lacuna",
    fontes: ["tse"],
    oQueDetecta:
      "Candidato sem nenhuma linha de bens — a declaração é obrigatória no registro; mesmo 'sem bens' deveria gerar registro.",
    limiares:
      "Zero linhas de bens no (candidato, ano). Pode ser desligada num ano em que 'sem bens' não gere linha no CSV.",
    severidade: "info",
    ondeRoda: "pós-importação",
    persistencia: "banco",
    ativa: true,
  },
  {
    slug: "serie_historica_incompleta",
    label: "Série histórica incompleta",
    tipo: "lacuna",
    fontes: ["tse"],
    oQueDetecta:
      "(Ano, UF) sem nenhum candidato num ano com dados. Varredura incompleta = falha nossa (vira alerta de qualidade); varredura completa e vazia = ausência na origem (lacuna).",
    limiares: "Zero candidatos no (ano, UF), considerando só anos já iniciados.",
    severidade: "aviso (falha nossa) / info (ausência na origem)",
    ondeRoda: "pós-importação",
    persistencia: "banco",
    ativa: true,
  },
  {
    slug: "parlamentar_sem_match",
    label: "Parlamentar sem candidatura vinculada",
    tipo: "lacuna",
    fontes: ["tse"],
    oQueDetecta:
      "Parlamentar em exercício sem nenhuma candidatura na ponte — impossível (todo parlamentar se elegeu); falta ano no cache ou o matcher não encontrou.",
    limiares: "Roster atual sem linha em tse_parlamentar_candidato após a ponte rodar.",
    severidade: "aviso",
    ondeRoda: "pós-importação",
    persistencia: "banco",
    ativa: true,
  },
  // ---------------------------------------------------------------------
  // TSE — sinais investigativos (cruzamentos, persistidos)
  // ---------------------------------------------------------------------
  {
    slug: "doador_virou_fornecedor",
    label: "Doador que virou fornecedor",
    tipo: "investigativo",
    fontes: ["tse-cruzamento"],
    oQueDetecta:
      "O mesmo CNPJ que doou para a campanha de um parlamentar em exercício aparece como fornecedor de contratos públicos. Doação e contrato são, isoladamente, legais — o cruzamento merece verificação humana.",
    limiares:
      "Doação ≥ R$ 1.000 de candidatura vinculada a parlamentar + mesmo CNPJ fornecedor no cache de contratos; grava valores, quantidade e intervalo em meses.",
    severidade: "aviso (sempre — sinais investigativos nunca nascem críticos)",
    ondeRoda: "pós-importação",
    persistencia: "banco",
    ativa: true,
  },
  {
    slug: "evolucao_patrimonial_atipica",
    label: "Evolução patrimonial atípica",
    tipo: "investigativo",
    fontes: ["tse-cruzamento"],
    oQueDetecta:
      "Bens declarados cresceram 10× ou mais entre duas eleições do mesmo CPF — pode ser herança, venda de empresa ou enriquecimento a explicar.",
    limiares: "bens ≥ 10× o da eleição anterior e valor final ≥ R$ 500 mil.",
    severidade: "aviso",
    ondeRoda: "pós-importação",
    persistencia: "banco",
    ativa: true,
  },
  {
    slug: "fornecedor_campanha_concentrado",
    label: "Fornecedor de campanha concentrado",
    tipo: "investigativo",
    fontes: ["tse-cruzamento"],
    oQueDetecta:
      "Um fornecedor absorve fração alta do gasto de campanha de muitos candidatos do mesmo partido/UF — pode ser contratação coletiva legítima do diretório ou direcionamento.",
    limiares: "≥ 10 candidatos do (partido, UF, ano) e ≥ 40% do gasto do grupo no mesmo CNPJ.",
    severidade: "aviso",
    ondeRoda: "pós-importação",
    persistencia: "banco",
    ativa: true,
  },
  // ---------------------------------------------------------------------
  // Sinais investigativos de contratos — derivados EM MEMÓRIA (/anomalias)
  // ---------------------------------------------------------------------
  {
    slug: "crescimento_abrupto",
    label: "Crescimento abrupto (fornecedor)",
    tipo: "investigativo",
    fontes: ["contratos"],
    oQueDetecta:
      "Receita pública anual de um fornecedor cresceu 3× ou mais sobre o ano anterior — pode ser captura ou expansão legítima.",
    limiares: "Receita ≥ 3× a do ano anterior, com base ≥ R$ 500 mil.",
    severidade: "média/alta conforme o salto",
    ondeRoda: "em memória na página",
    persistencia: "memoria",
    ativa: true,
  },
  {
    slug: "fracionamento",
    label: "Fracionamento de despesa",
    tipo: "investigativo",
    fontes: ["contratos"],
    oQueDetecta:
      "Sucessão de dispensas de licitação logo abaixo do teto legal, mesmo órgão + fornecedor + ano — sugere segmentação para evitar licitação.",
    limiares:
      "≥ 5 dispensas abaixo do teto de dispensa vigente na data do contrato (Lei 8.666/Decreto 9.412 até mar/2021; Lei 14.133 com valores atualizados por decreto depois).",
    severidade: "alta",
    ondeRoda: "em memória na página",
    persistencia: "memoria",
    ativa: true,
  },
  {
    slug: "concentracao",
    label: "Concentração de fornecedor",
    tipo: "investigativo",
    fontes: ["contratos"],
    oQueDetecta:
      "Um único fornecedor responde pela maior parte do contratado de um órgão no ano — risco de dependência ou mercado pouco competitivo.",
    limiares: "> 60% do gasto do órgão no ano, com total > R$ 2 milhões.",
    severidade: "média",
    ondeRoda: "em memória na página",
    persistencia: "memoria",
    ativa: true,
  },
  {
    slug: "outlier_valor",
    label: "Outlier de valor",
    tipo: "investigativo",
    fontes: ["contratos"],
    oQueDetecta: "Contrato com valor muito acima do padrão da amostra carregada.",
    limiares: "z-score ≥ 3 (média e desvio da amostra; amostras com ≤ 5 contratos não rodam).",
    severidade: "média",
    ondeRoda: "em memória na página",
    persistencia: "memoria",
    ativa: true,
  },
  {
    slug: "fornecedor_recente_alto",
    label: "Fornecedor recém-chegado",
    tipo: "investigativo",
    fontes: ["contratos"],
    oQueDetecta:
      "Empresa cuja primeira aparição no histórico é recente e que já recebe contrato de grande valor.",
    limiares: "Primeira aparição ≤ 365 dias e contrato ≥ R$ 1 milhão.",
    severidade: "média",
    ondeRoda: "em memória na página",
    persistencia: "memoria",
    ativa: true,
  },
  {
    slug: "descricao_generica",
    label: "Descrição genérica",
    tipo: "investigativo",
    fontes: ["contratos"],
    oQueDetecta:
      "Objeto contratual vago ('serviços diversos', 'apoio operacional') em contrato de valor relevante — compromete o controle social.",
    limiares: "Objeto < 30 caracteres ou termo-bandeira, com valor ≥ R$ 200 mil.",
    severidade: "baixa",
    ondeRoda: "em memória na página",
    persistencia: "memoria",
    ativa: true,
  },
  {
    slug: "dispensa_recorrente",
    label: "Dispensa recorrente",
    tipo: "investigativo",
    fontes: ["contratos"],
    oQueDetecta:
      "Sucessivas dispensas com o mesmo órgão + fornecedor, ano após ano — a recorrência descaracteriza a excepcionalidade da dispensa.",
    limiares: "≥ 3 dispensas/ano repetidas por 2 anos consecutivos.",
    severidade: "média",
    ondeRoda: "em memória na página",
    persistencia: "memoria",
    ativa: true,
  },
  {
    slug: "crescimento_orgao",
    label: "Crescimento do órgão",
    tipo: "investigativo",
    fontes: ["contratos"],
    oQueDetecta:
      "Gasto anual de um órgão saltou em relação ao seu histórico recente — mudança de política, demanda real ou expansão problemática.",
    limiares: "Gasto ≥ 2× a mediana dos 3 anos anteriores com dados, baseline ≥ R$ 1 milhão.",
    severidade: "média",
    ondeRoda: "em memória na página",
    persistencia: "memoria",
    ativa: true,
  },
  {
    slug: "transparencia_baixa",
    label: "Transparência baixa (ITI)",
    tipo: "investigativo",
    fontes: ["contratos"],
    oQueDetecta:
      "Órgão com Índice de Transparência Institucional na faixa baixa movimentando volume alto de contratos.",
    limiares: "ITI faixa 'baixa' com volume ≥ R$ 5 milhões.",
    severidade: "média",
    ondeRoda: "em memória na página",
    persistencia: "memoria",
    ativa: true,
  },
  // ---------------------------------------------------------------------
  // Regras aposentadas (podem existir no banco; documentadas por honestidade)
  // ---------------------------------------------------------------------
  {
    slug: "possivel_ponto_fixo",
    label: "Possível ponto-fixo (aposentada)",
    tipo: "qualidade",
    fontes: ["cgu"],
    oQueDetecta:
      "Heurística antiga sobre a listagem para inferir o bug ÷10000. Substituída pela conferência de cada contrato contra o endpoint de detalhe (valor_corrigido_listagem).",
    limiares: "—",
    severidade: "crítico (histórico)",
    ondeRoda: "importação",
    persistencia: "banco",
    ativa: false,
  },
  {
    slug: "valor_precisao_suspeita",
    label: "Precisão suspeita (aposentada)",
    tipo: "qualidade",
    fontes: ["cgu"],
    oQueDetecta:
      "Heurística antiga de sub-centavo na listagem. Substituída pela conferência por detalhe.",
    limiares: "—",
    severidade: "aviso (histórico)",
    ondeRoda: "importação",
    persistencia: "banco",
    ativa: false,
  },
  {
    slug: "valor_final_truncado_suspeito",
    label: "Final truncado suspeito (aposentada)",
    tipo: "qualidade",
    fontes: ["cgu"],
    oQueDetecta:
      "Heurística antiga (final < R$ 100 com inicial > R$ 1.000). Substituída pela conferência por detalhe.",
    limiares: "—",
    severidade: "aviso (histórico)",
    ondeRoda: "importação",
    persistencia: "banco",
    ativa: false,
  },
];

// ---------------------------------------------------------------------------
// Derivações (fonte única para filtros e labels da UI)
// ---------------------------------------------------------------------------

export function sinaisPorTipo(
  tipo: SinalTipo,
  opts?: { incluirInativas?: boolean },
): SinalCatalogo[] {
  return SINAIS_CATALOGO.filter((s) => s.tipo === tipo && (opts?.incluirInativas || s.ativa));
}

export function sinaisPorFonte(fonte: string): SinalCatalogo[] {
  return SINAIS_CATALOGO.filter((s) => s.ativa && s.fontes.includes(fonte));
}

/** Label curto de uma regra (fallback: o próprio slug). */
export function labelDaRegra(slug: string): string {
  return SINAIS_CATALOGO.find((s) => s.slug === slug)?.label ?? slug;
}

/** Fontes com regras persistidas ativas — alimenta o filtro de /qualidade. */
export const FONTES_QA_CATALOGO: string[] = Array.from(
  new Set(
    SINAIS_CATALOGO.filter((s) => s.ativa && s.persistencia === "banco").flatMap((s) => s.fontes),
  ),
);

/** Slugs únicos das regras persistidas (ativas + aposentadas, que ainda podem
 * existir no banco) — alimenta os filtros de regra do público e do admin. */
export const REGRAS_PERSISTIDAS: string[] = Array.from(
  new Set(SINAIS_CATALOGO.filter((s) => s.persistencia === "banco").map((s) => s.slug)),
);

/** Labels das 9 regras em memória de /anomalias (compat com REGRA_LABEL). */
export const REGRA_LABEL_MEMORIA: Record<string, string> = Object.fromEntries(
  SINAIS_CATALOGO.filter((s) => s.persistencia === "memoria").map((s) => [s.slug, s.label]),
);
