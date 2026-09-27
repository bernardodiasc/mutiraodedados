/**
 * Páginas estáticas públicas na busca (categoria "Páginas e ajuda").
 *
 * Fonte única da lista: o índice lê a tabela `paginas_publicas`, que é uma
 * cópia desta lista feita pelo botão "Sincronizar páginas" da aba Busca do
 * /admin/dados. Mudou o título, o resumo ou o texto de uma página? Atualize a
 * entrada aqui e, depois do deploy, sincronize.
 *
 * O teste-guarda (`lista.test.ts`) acusa rota pública sem entrada (ou sem
 * motivo em `ROTAS_FORA_DA_BUSCA`), entrada para rota que não existe, âncora
 * que não existe na página e resumo que não aparece mais no código da rota —
 * o resumo de cada página é a `description` do `head` dela.
 */

export type SecaoPublica = {
  /** `id` do elemento na página: o destino é `rota#ancora`. */
  ancora: string;
  /** Título da seção, literal no código da página. */
  titulo: string;
  /** Resumo literal no código da página, quando houver. */
  resumo?: string;
  /** Sinônimos e nomes citados (peso alto na busca). */
  palavras?: string;
};

export type PaginaPublica = {
  rota: string;
  /** Nome da página: título do resultado e valor da faceta "Página". */
  titulo: string;
  /** A `description` do `head` da rota, literal. */
  resumo: string;
  /** Sinônimos e nomes citados (peso alto na busca). */
  palavras?: string;
  /** Títulos das seções e outros termos do corpo (peso baixo). */
  texto?: string;
  secoes?: SecaoPublica[];
};

export const PAGINAS_PUBLICAS: readonly PaginaPublica[] = [
  // Sobre o projeto e regras
  {
    rota: "/sobre",
    titulo: "Sobre o projeto",
    resumo:
      "Observatório cívico de interpretação pública do Estado. Premissas, limites analíticos, fontes e responsabilidades editoriais do Mutirão de Dados.",
    palavras: "quem somos missão observatório cívico",
    texto:
      "Premissa · O que fazemos · O que deliberadamente não fazemos · Limites analíticos · Fontes · Estado de desenvolvimento · Roadmap · Como participar",
  },
  {
    rota: "/contribuir",
    titulo: "Contribuir",
    resumo:
      "Como participar do Mutirão de Dados: lendo dados, revisando sinais, marcando informações ou contribuindo com código no repositório open source.",
    palavras: "participar colaborar voluntário código aberto open source",
    texto: "Uma história curta sobre por que isto existe · Como você pode contribuir",
  },
  {
    rota: "/contestar",
    titulo: "Contestar uma análise",
    resumo:
      "Canal de contestação, correção ou remoção de análises publicadas. Procedimento aberto a órgãos, empresas e cidadãos.",
    palavras: "contestação correção remoção retificação direito de resposta",
    texto: "Quando contestar · Formulário · Prazo · O que não fazemos",
  },
  {
    rota: "/privacidade",
    titulo: "Política de Privacidade",
    resumo:
      "Como o Mutirão de Dados trata dados pessoais. Bases legais, direitos do titular e contato do encarregado.",
    palavras: "LGPD dados pessoais encarregado DPO cookies",
    texto:
      "Dados que tratamos · Bases legais · Compartilhamento · Direitos do titular · Retenção · Segurança · Encarregado (DPO) · Cookies e telemetria",
  },
  {
    rota: "/termos",
    titulo: "Termos de Uso",
    resumo:
      "Condições de uso da plataforma Mutirão de Dados. Natureza experimental, responsabilidades do usuário e limites de interpretação dos dados.",
    palavras: "condições de uso responsabilidade",
    texto:
      "Natureza da plataforma · Conteúdo analítico · Uso responsável · Marcações cidadãs · Propriedade intelectual · Limitação de responsabilidade · Contestação · Foro",
  },
  {
    rota: "/tratamento-de-dados",
    titulo: "Tratamento de Dados Públicos",
    resumo:
      "Como dados públicos são reprocessados pelo Mutirão de Dados, princípio da minimização e o que deliberadamente não republicamos.",
    palavras: "LGPD minimização CPF pessoas físicas",
    texto:
      "A premissa · O que reprocessamos · O que não republicamos · Pessoas físicas mencionadas · Direito de retificação · Fontes oficiais preservadas",
  },

  // Aprender e método
  {
    rota: "/aprender",
    titulo: "Aprender a interpretar",
    resumo:
      "Guia prático: LAI, Lei da Transparência, Lei de Licitações, direitos de fiscalização e como denunciar irregularidades.",
    palavras: "primeiros passos guia cidadão ajuda",
    secoes: [
      {
        ancora: "vocabulario",
        titulo: "Anomalia, indício, irregularidade: o que cada palavra significa",
        resumo:
          "Distinções jurídicas e analíticas que separam um padrão estatístico de uma conclusão sobre conduta.",
        palavras: "vocabulário",
      },
      {
        ancora: "lai",
        titulo: "Lei de Acesso à Informação (12.527/2011)",
        resumo: "Qualquer pessoa pode pedir informação pública — sem precisar justificar.",
        palavras: "LAI pedido de informação e-SIC Fala.BR",
      },
      {
        ancora: "transparencia",
        titulo: "Lei da Transparência (Lei Complementar 131/2009)",
        resumo: "Obriga União, estados e municípios a publicarem dados em tempo real.",
        palavras: "LC 131 portal da transparência",
      },
      {
        ancora: "licitacoes",
        titulo: "Lei de Licitações (14.133/2021)",
        resumo: "Como o governo compra. Regras, exceções e onde mora o risco.",
        palavras: "licitação modalidade pregão dispensa inexigibilidade",
      },
      {
        ancora: "constituicao",
        titulo: "Seus direitos constitucionais de fiscalização",
        resumo: "A Constituição põe o cidadão como agente legítimo de controle social.",
        palavras: "Constituição controle social",
      },
      {
        ancora: "denunciar",
        titulo: "Como denunciar irregularidades",
        resumo: "Um caminho prático, do menos para o mais formal.",
        palavras: "denúncia ouvidoria Ministério Público tribunal de contas",
      },
      {
        ancora: "interpretar",
        titulo: "Como interpretar dados públicos",
        resumo: "Diferença entre anomalia e ilegalidade. Comparar antes de concluir.",
      },
    ],
  },
  {
    rota: "/trilhas",
    titulo: "Trilhas",
    resumo:
      "Rotas de aprendizado metodológico para investigar o Estado: como pensar, o que observar e quais perguntas registrar. O método antes da ferramenta.",
    palavras: "aprender a investigar método auditor",
    secoes: [
      {
        ancora: "primeiro-contrato",
        titulo: "Como ler um contrato público pela primeira vez",
        resumo:
          "Esta trilha não é sobre achar o botão certo — é sobre treinar o olhar. Você vai aprender a distinguir o que é cláusula, o que é metadado e o que é a fonte original, e a desconfiar na medida certa.",
      },
      {
        ancora: "emendas-rastreio",
        titulo: "Como rastrear uma emenda parlamentar",
        resumo:
          "Da promessa ao dinheiro na conta. Aqui você treina a seguir o rastro: aprender a ver onde o discurso vira execução — ou onde ele simplesmente desaparece.",
      },
      {
        ancora: "transparencia-municipio",
        titulo: "Como avaliar a transparência de um município",
        resumo:
          "Transparência se mede pelo que está disponível — e também pelo que deveria estar e não está. Nesta trilha você aprende a ler os silêncios de um ente público.",
        palavras: "relatórios fiscais prefeitura",
      },
    ],
  },
  {
    rota: "/metodologia",
    titulo: "Metodologia",
    resumo:
      "Hub de metodologia: cada regra que gera sinal — de qualidade, lacuna ou investigativa, de qualquer fonte — explicada com hipótese, parâmetros, limites e falsos-positivos.",
    palavras: "critérios regras sinais falso positivo",
    texto: "Princípios · Regras por fonte · Fontes · Versionamento",
  },
  {
    rota: "/referencias",
    titulo: "Referências e projetos similares",
    resumo:
      "Portais oficiais, APIs públicas, fontes de dados e projetos de transparência e mutirão de dados usados ou recomendados pelo Mutirão de Dados.",
    secoes: [
      {
        ancora: "portais",
        titulo: "Portais oficiais",
        palavras:
          "Portal da Transparência Compras.gov.br SICONFI TransfereGov Diário Oficial da União TCU Receita Federal CNPJ IBGE DivulgaCandContas",
      },
      {
        ancora: "apis",
        titulo: "APIs oficiais e de dados abertos",
        resumo: "Interfaces programáticas para consumir dados públicos em escala.",
        palavras: "API BrasilAPI Minha Receita LexML dados abertos",
      },
      {
        ancora: "sites",
        titulo: "Outros sites relevantes",
        palavras: "Fala.BR e-SIC ANPD Open Knowledge Brasil Transparência Brasil Abraji Article 19",
      },
      {
        ancora: "projetos-similares",
        titulo: "Projetos similares",
        palavras:
          "Serenata de Amor Querido Diário Achados e Pedidos Ranking dos Políticos Basômetro Base dos Dados",
      },
    ],
  },
  {
    rota: "/perguntas",
    titulo: "Perguntas",
    resumo: "Modelos de pergunta e investigações públicas. Comece sua pasta de investigação.",
    palavras: "investigações modelos de pergunta",
  },
  {
    rota: "/mapas",
    titulo: "Mapas investigativos",
    resumo:
      "Manual técnico da fiscalização: receitas práticas de cruzamento de dados e sistemas (CNPJ, nota de empenho, convênio) a partir das fontes oficiais brasileiras.",
    palavras: "kit de investigação passo a passo",
  },
  {
    rota: "/tutoriais",
    titulo: "Tutoriais da ferramenta",
    resumo: "Tutoriais práticos sobre como usar as ferramentas do Mutirão de Dados.",
    palavras: "ajuda como usar",
  },
  {
    rota: "/notas",
    titulo: "Notas de campo",
    resumo: "Notas curtas sobre casos, mudanças em fontes e limitações de dados.",
  },

  // Transparência, qualidade e cobertura
  {
    rota: "/cobertura",
    titulo: "Cobertura dos dados",
    resumo:
      "Quanto o Mutirão de Dados já baixou de cada fonte pública: período coberto, frescor da última atualização e lacunas por ano e mês.",
    palavras: "atualização período coberto importação",
  },
  {
    rota: "/qualidade",
    titulo: "Qualidade dos dados",
    resumo:
      "Inconsistências detectadas nas bases públicas, revalidadas contra a fonte oficial e, quando confirmadas, reportadas ao órgão responsável.",
    palavras: "inconsistências erros achados",
  },
  {
    rota: "/lacunas",
    titulo: "Informação que falta",
    resumo:
      "O que ainda não é público sobre o funcionamento do Estado: lacunas de transparência, avaliação, mensuração, documento, instituição e método.",
    palavras: "lacunas",
    texto: "Tipologia · Ciclo de vida de uma lacuna · Lacunas registradas",
  },
  {
    rota: "/anomalias",
    titulo: "Sinais investigativos",
    resumo:
      "Padrões fora do esperado em contratos e gastos federais, com critério, severidade e checklist de investigação.",
    palavras: "anomalias fracionamento concentração de fornecedor",
  },
  {
    rota: "/transparencia-institucional",
    titulo: "Transparência institucional",
    resumo:
      "Índice de Transparência Institucional por órgão: completude, competitividade, diversidade, volume e atualidade dos contratos publicados (Portal CGU e PNCP).",
    palavras: "ranking de órgãos nota",
  },
  {
    rota: "/afirmacoes",
    titulo: "Afirmações públicas",
    resumo:
      "O que foi prometido, declarado ou afirmado publicamente sobre o funcionamento do Estado. Curadoria editorial — sem motor automático.",
    palavras: "promessas declarações",
  },
  {
    rota: "/roadmap",
    titulo: "Roadmap",
    resumo:
      "O que já está no ar, o que está em construção e o que vem a seguir no Mutirão de Dados. Inclui notas de versão por entrega.",
    palavras: "novidades notas de versão",
  },

  // Fontes de dados
  {
    rota: "/portal-cgu",
    titulo: "Portal da Transparência (CGU)",
    resumo:
      "O que o Portal da Transparência da CGU cobre no Mutirão de Dados: contratos, licitações, convênios, emendas e transferências do Executivo Federal.",
    palavras: "CGU Controladoria-Geral da União fonte",
  },
  {
    rota: "/pncp",
    titulo: "Portal Nacional de Contratações Públicas (PNCP)",
    resumo:
      "O que o PNCP cobre no Mutirão de Dados: contratos e licitações sob a Lei 14.133, de todos os entes (União, estados, municípios).",
    palavras: "PNCP fonte",
  },
  {
    rota: "/siconfi",
    titulo: "Sistema de Informações Contábeis e Fiscais (SICONFI)",
    resumo:
      "O que o SICONFI cobre no Mutirão de Dados: relatórios fiscais (RREO, RGF, DCA) padronizados de todos os entes federados, e como ela se conecta às demais fontes.",
    palavras: "SICONFI Tesouro Nacional fonte",
    texto:
      "Como o SICONFI se conecta · SICONFI × Portal da Transparência (CGU) · Fundo a Fundo · Granularidade",
  },
  {
    rota: "/transferegov",
    titulo: "Transferegov",
    resumo:
      "O que o Transferegov cobre no Mutirão de Dados: convênios/contratos de repasse (SICONV) e as transferências diretas da EC 105 (emendas Pix).",
    palavras: "Transferegov SICONV emendas Pix fonte",
  },
  {
    rota: "/tse",
    titulo: "Tribunal Superior Eleitoral (TSE)",
    resumo:
      "O que a fonte TSE cobre no Mutirão de Dados: candidatos, bens declarados, votação e contas de campanha de 1998 em diante — com sinais de qualidade, lacunas e cruzamentos investigativos.",
    palavras: "TSE Justiça Eleitoral fonte",
    texto: "O que significa cada tipo de sinal · Confira com as próprias mãos",
  },
  {
    rota: "/camara",
    titulo: "Câmara dos Deputados",
    resumo:
      "Cadastro, despesas (CEAP) e atividade dos 513 deputados federais — dados abertos da Câmara, organizados para interpretação cidadã.",
    palavras: "CEAP cota parlamentar fonte",
    texto: "O que é CEAP?",
  },
  {
    rota: "/senado",
    titulo: "Senado Federal",
    resumo:
      "Cadastro, despesas (CEAPS), matérias e votações dos 81 senadores — dados abertos do Senado, organizados para interpretação cidadã.",
    palavras: "CEAPS cota parlamentar fonte",
    texto: "O que é CEAPS?",
  },
  {
    rota: "/congresso",
    titulo: "Congresso Nacional",
    resumo:
      "Comparativo Câmara × Senado: parlamentares, despesas reembolsadas e atividade legislativa do Congresso Nacional.",
    texto: "As duas casas · Atalhos por vertical · Como comparar com responsabilidade",
  },

  // Listas por tipo de dado
  {
    rota: "/explorar",
    titulo: "Por estado ou município",
    resumo:
      "Escolha um estado ou município e veja, no mesmo lugar, contratações (PNCP), relatórios fiscais (SICONFI) e convênios recebidos da União.",
    palavras: "explorar estados municípios prefeituras",
  },
  {
    rota: "/orgaos",
    titulo: "Órgãos federais",
    resumo:
      "Órgãos federais com contratos, licitações e convênios públicos, totais contratados e histórico de gastos. Inclui órgãos extintos, com histórico preservado.",
  },
  {
    rota: "/contratos",
    titulo: "Contratos",
    resumo:
      "Contratos públicos do Executivo Federal (Portal CGU) e de todos os entes (PNCP, Lei 14.133).",
  },
  {
    rota: "/licitacoes",
    titulo: "Licitações",
    resumo:
      "Licitações de órgãos do Executivo federal publicadas no Portal da Transparência (CGU).",
  },
  {
    rota: "/fornecedores",
    titulo: "Fornecedores",
    resumo:
      "Empresas que fornecem ao governo federal: busque por nome ou CNPJ e veja contratos, radar de risco e doações de campanha de cada fornecedor.",
    palavras: "empresas CNPJ",
  },
  {
    rota: "/convenios",
    titulo: "Convênios e contratos de repasse",
    resumo:
      "Convênios e contratos de repasse da União com estados e municípios, com dados do Portal da Transparência (CGU).",
  },
  {
    rota: "/emendas",
    titulo: "Emendas parlamentares",
    resumo:
      "Emendas parlamentares com as três fases da despesa — empenho, liquidação e pagamento — do Portal da Transparência (CGU).",
  },
  {
    rota: "/transferencias",
    titulo: "Transferências (repasses)",
    resumo:
      "Repasses da União a estados e municípios, pagamento a pagamento — fonte em preparação no Mutirão de Dados.",
    texto: "Onde estão os dados relacionados · Fundo a Fundo",
  },
  {
    rota: "/relatorios-fiscais",
    titulo: "Relatórios fiscais",
    resumo:
      "Listagem de relatórios fiscais (RREO, RGF e DCA) de todos os entes federados, via SICONFI / Tesouro Nacional.",
  },
  {
    rota: "/eleicoes",
    titulo: "Eleições",
    resumo:
      "Candidatos, bens declarados, votação e contas de campanha das eleições brasileiras de 1998 em diante, com dados oficiais do TSE.",
  },
  {
    rota: "/eleicoes/candidatos",
    titulo: "Candidatos",
    resumo:
      "Busque candidatos por eleição, UF e nome. Cada ficha traz bens declarados, votação por município e histórico eleitoral (dados do TSE).",
  },
  {
    rota: "/camara/deputados",
    titulo: "Deputados federais",
    resumo:
      "Lista navegável dos deputados federais por legislatura, com filtros por UF, partido, situação e legislatura, busca por nome e exportação em CSV.",
  },
  {
    rota: "/camara/proposicoes",
    titulo: "Proposições da Câmara",
    resumo:
      "Projetos de lei, PECs, medidas provisórias e demais proposições apresentadas na Câmara dos Deputados — busca por ementa, tipo e ano.",
  },
  {
    rota: "/camara/votacoes",
    titulo: "Votações da Câmara",
    resumo:
      "Votações nominais em plenário e comissões da Câmara dos Deputados, com resultado, proposição votada e contagem de votos.",
  },
  {
    rota: "/senado/senadores",
    titulo: "Senadores",
    resumo:
      "Lista navegável dos senadores por legislatura, com filtros por UF, partido, situação, participação (titular/suplente) e legislatura, busca por nome e exportação em CSV.",
  },
  {
    rota: "/senado/materias",
    titulo: "Matérias do Senado",
    resumo:
      "Projetos de lei, PECs, medidas provisórias e demais matérias apresentadas no Senado Federal.",
  },
  {
    rota: "/senado/votacoes",
    titulo: "Votações do Senado",
    resumo:
      "Votações nominais em plenário do Senado, com resultado, matéria associada e contagem de votos.",
  },
];

/**
 * Rotas públicas estáticas que ficam fora da busca, com o motivo. Vale para a
 * rota e para as filhas dela.
 */
export const ROTAS_FORA_DA_BUSCA: Readonly<Record<string, string>> = {
  "/": "página inicial: é o ponto de partida, não um destino",
  "/buscar": "a própria busca",
  "/login": "entrada na conta",
  "/caderno": "caderno pessoal, exige conta",
  "/estilo": "guia de estilo para quem desenvolve o site",
};

/** Linha da tabela `paginas_publicas`: uma por página e uma por seção. */
export type LinhaPaginaPublica = {
  id: string;
  rota: string;
  ancora: string | null;
  pagina: string;
  titulo: string;
  resumo: string | null;
  palavras: string | null;
  texto: string | null;
};

export function linhasPaginasPublicas(
  paginas: readonly PaginaPublica[] = PAGINAS_PUBLICAS,
): LinhaPaginaPublica[] {
  return paginas.flatMap((p) => [
    {
      id: p.rota,
      rota: p.rota,
      ancora: null,
      pagina: p.titulo,
      titulo: p.titulo,
      resumo: p.resumo,
      palavras: p.palavras ?? null,
      texto: p.texto ?? null,
    },
    ...(p.secoes ?? []).map((s) => ({
      id: `${p.rota}#${s.ancora}`,
      rota: p.rota,
      ancora: s.ancora,
      pagina: p.titulo,
      titulo: s.titulo,
      resumo: s.resumo ?? null,
      palavras: s.palavras ?? null,
      texto: null,
    })),
  ]);
}
