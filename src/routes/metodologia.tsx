import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Banknote, Landmark, Microscope, Vote } from "lucide-react";

export const Route = createFileRoute("/metodologia")({
  component: MetodologiaPage,
  head: () => ({
    meta: [
      { title: "Metodologia — critérios de todos os sinais — Mutirão de Dados" },
      {
        name: "description",
        content:
          "Hub de metodologia: cada regra que gera sinal — de qualidade, lacuna ou investigativa, de qualquer fonte — explicada com hipótese, parâmetros, limites e falsos-positivos.",
      },
      { property: "og:title", content: "Metodologia — Mutirão de Dados" },
      {
        property: "og:description",
        content:
          "Hipóteses, parâmetros, limites conhecidos e falsos-positivos típicos de cada regra de detecção, organizados por fonte.",
      },
      { property: "og:url", content: "https://mutiraodedados.com.br/metodologia" },
      { property: "og:type", content: "article" },
    ],
    links: [{ rel: "canonical", href: "https://mutiraodedados.com.br/metodologia" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          headline: "Metodologia do Mutirão de Dados",
          description:
            "Hipóteses, parâmetros, limites conhecidos e falsos-positivos típicos de cada regra de detecção.",
          author: { "@type": "Organization", name: "Mutirão de Dados" },
          publisher: { "@type": "Organization", name: "Mutirão de Dados" },
          mainEntityOfPage: "https://mutiraodedados.com.br/metodologia",
        }),
      },
    ],
  }),
});

type TipoSinal = "qualidade" | "lacuna" | "investigativo" | "anomalia";

type Regra = {
  id: string;
  nome: string;
  tipo: TipoSinal;
  hipotese: string;
  parametros: string;
  limites: string;
  falsosPositivos: string;
};

type Secao = {
  id: string;
  icon: React.ReactNode;
  titulo: string;
  resumo: string;
  notas?: React.ReactNode;
  regras: Regra[];
};

const TIPO_LABEL: Record<TipoSinal, { label: string; classe: string }> = {
  qualidade: { label: "Alerta de qualidade", classe: "bg-muted text-foreground border-border" },
  lacuna: { label: "Lacuna", classe: "bg-accent/10 text-accent border-accent/30" },
  investigativo: {
    label: "Sinal investigativo",
    classe: "bg-destructive/10 text-destructive border-destructive/30",
  },
  anomalia: {
    label: "Sinal investigativo (derivado)",
    classe: "bg-destructive/10 text-destructive border-destructive/30",
  },
};

const SECOES: Secao[] = [
  {
    id: "contratos-cgu",
    icon: <Banknote className="size-5" />,
    titulo: "Contratos e gastos federais (Portal CGU)",
    resumo:
      "Sinais derivados dos contratos do Executivo federal — calculados sobre o conjunto carregado, aparecem em /anomalias.",
    regras: [
      {
        id: "crescimento_abrupto",
        nome: "Crescimento abrupto de fornecedor",
        tipo: "anomalia",
        hipotese:
          "Crescimentos repentinos na receita pública anual de uma empresa podem refletir captura, mas também expansão legítima após vitória em pregão grande, mudança de portfólio ou aquisição.",
        parametros:
          "Receita pública ≥ 3× a do ano anterior, com base ≥ R$ 500 mil. Limiares calibrados para evitar amplificar variações irrelevantes em fornecedores pequenos.",
        limites:
          "Não distingue setores. Empresas em mercados de baixa frequência (obras, equipamentos) variam naturalmente. Não considera reajuste contratual.",
        falsosPositivos:
          "Aditivos contratuais grandes; entrega plurianual concentrada em um exercício; primeira renovação de licitação vencida no ano anterior.",
      },
      {
        id: "fracionamento",
        nome: "Fracionamento artificial de despesa",
        tipo: "anomalia",
        hipotese:
          "Sucessão de dispensas de licitação logo abaixo do teto legal sugere segmentação intencional para evitar procedimento competitivo — vedado pela Lei 14.133/2021.",
        parametros:
          "≥ 5 contratos por dispensa, mesmo órgão + mesmo fornecedor + mesmo ano, todos abaixo do teto vigente (R$ 17.600 para bens e serviços comuns).",
        limites:
          "Não acessa o termo de referência. Não diferencia objeto distinto contratado em sequência (compras avulsas legítimas) de fracionamento real.",
        falsosPositivos:
          "Pequenas compras avulsas em órgãos descentralizados; suprimentos de uso contínuo onde o legislador permite múltiplas dispensas.",
      },
      {
        id: "concentracao",
        nome: "Concentração excessiva de fornecedor",
        tipo: "anomalia",
        hipotese:
          "Quando um único fornecedor responde por parcela majoritária do contratado de um órgão, há risco de dependência, captura ou mercado pouco competitivo.",
        parametros:
          "Um fornecedor concentra > 60% do contratado por um órgão em um ano, com volume agregado > R$ 2 milhões.",
        limites:
          "Não considera estrutura natural de mercado (monopólios legítimos: TI especializada, fornecedores únicos de medicamentos).",
        falsosPositivos:
          "Órgãos pequenos com poucos contratos; setores legalmente concentrados; inexigibilidade fundamentada.",
      },
      {
        id: "outlier_valor",
        nome: "Outlier de valor",
        tipo: "anomalia",
        hipotese:
          "Contratos com valor muito acima da média da série podem indicar superfaturamento, escopo mal definido ou apenas aquisição estruturante legítima.",
        parametros: "Valor ≥ 3 desvios-padrão acima da média da amostra.",
        limites:
          "Distribuições de contratos públicos são tipicamente assimétricas — desvio-padrão tem poder limitado nesses casos.",
        falsosPositivos:
          "Obras de infraestrutura; aquisição de equipamentos de grande porte; contratos plurianuais.",
      },
      {
        id: "fornecedor_recente_alto",
        nome: "Fornecedor recém-criado com contrato alto",
        tipo: "anomalia",
        hipotese:
          "Empresas com pouco tempo de constituição que recebem contratos de grande valor merecem checagem societária — pode haver legitimidade (spin-off, especialização) ou interposição.",
        parametros:
          "Primeira aparição no histórico há menos de 1 ano e contrato unitário ≥ R$ 1 milhão.",
        limites:
          "Usa data da primeira aparição nos dados carregados, não a data de constituição CNPJ real. A próxima fase integrará a Receita Federal.",
        falsosPositivos:
          "Empresas migrando de outra razão social; ingressantes legítimos em pregão.",
      },
      {
        id: "descricao_generica",
        nome: "Descrição contratual opaca",
        tipo: "anomalia",
        hipotese:
          "Objetos contratuais vagos ('serviços diversos', 'apoio operacional') comprometem o controle social — não é possível avaliar adequação de preço sem saber o que se contrata.",
        parametros: "Objeto < 30 caracteres ou contendo termos-bandeira, para valor ≥ R$ 200 mil.",
        limites: "Não acessa termo de referência ou anexos. Avaliação puramente textual.",
        falsosPositivos:
          "Cabeçalhos sintéticos cujo detalhamento real está no termo de referência anexo.",
      },
      {
        id: "dispensa_recorrente",
        nome: "Padrão recorrente de dispensa",
        tipo: "anomalia",
        hipotese:
          "Sucessivas dispensas com o mesmo fornecedor sugerem que o objeto deveria estar sob contrato licitado — a recorrência descaracteriza o caráter excepcional da dispensa.",
        parametros:
          "≥ 3 dispensas/ano com o mesmo órgão + fornecedor, repetidas por 2 anos consecutivos.",
        limites: "Não considera hipóteses legais específicas (calamidade, segurança nacional).",
        falsosPositivos:
          "Renovação anual de pequenos contratos legítimos com fornecedor exclusivo regional.",
      },
      {
        id: "crescimento_orgao",
        nome: "Crescimento abrupto do gasto do órgão",
        tipo: "anomalia",
        hipotese:
          "Saltos no gasto anual de um órgão podem indicar mudança de política pública, demanda real ou expansão problemática.",
        parametros: "Gasto anual ≥ 2× a mediana dos 3 anos anteriores, com baseline ≥ R$ 1 milhão.",
        limites:
          "Não distingue investimento de custeio. Não considera macroeconomia (inflação, câmbio).",
        falsosPositivos:
          "Anos com obra estruturante; resposta a emergência sanitária ou climática; reestruturação institucional.",
      },
      {
        id: "valor_corrigido_listagem",
        nome: "Valor truncado corrigido (contratos CGU)",
        tipo: "qualidade",
        hipotese:
          "A API da CGU tem um defeito conhecido de escala (÷100/1000/10000) que trunca valores tanto na listagem quanto no detalhe. Conferimos cada contrato contra o endpoint de detalhe e gravamos sempre o valor não-truncado.",
        parametros:
          "Razão ≥ 100× entre as duas leituras do mesmo contrato → grava o maior (que bate com o documento oficial) e registra o alerta já resolvido.",
        limites:
          "Depende de as duas leituras estarem disponíveis; contratos antigos podem não ter detalhe.",
        falsosPositivos:
          "Aditivos/rescisões reais que mudam o valor entre leituras (raros nessa magnitude).",
      },
    ],
  },
  {
    id: "eleicoes-tse",
    icon: <Vote className="size-5" />,
    titulo: "Eleições (TSE)",
    resumo:
      "Candidatos, bens, votação e contas de campanha de 2014 em diante — com os três tipos de sinal: qualidade, lacunas e cruzamentos investigativos.",
    notas: (
      <div className="text-sm text-muted-foreground space-y-2">
        <p>
          <strong className="text-foreground">Janela temporal:</strong> eleições de 2014 em diante
          (formatos anteriores a 2014 são muito diferentes e ficaram fora do escopo). Contas de
          2014/2016 vêm em layout legado da própria origem.
        </p>
        <p>
          <strong className="text-foreground">Agregação de resultados:</strong> a votação é agregada
          por município (somamos as zonas eleitorais); resultados por seção/zona não são
          armazenados.
        </p>
        <p>
          <strong className="text-foreground">Mascaramento na origem:</strong> o CPF de doadores
          pessoa física já chega mascarado do TSE (***.NNN.NNN-**) — cruzamentos com pessoas físicas
          são impossíveis por desenho. Apenas CNPJs (14 dígitos) participam de cruzamentos.
        </p>
        <p>
          <strong className="text-foreground">Limitações conhecidas:</strong> declarações de bens
          são autodeclaradas; recursos estimáveis dependem de estimativa do próprio candidato; a
          ponte parlamentar↔candidato usa CPF na Câmara e nome+UF no Senado (vínculos por nome
          carregam aviso e fila de revisão).
        </p>
      </div>
    ),
    regras: [
      {
        id: "tse_cpf_cnpj_invalido",
        nome: "CPF/CNPJ com dígito verificador inválido",
        tipo: "qualidade",
        hipotese:
          "Documento não mascarado que não passa na validação de dígito verificador é defeito de digitação/captura na origem.",
        parametros:
          "Validação de DV padrão de CPF (11 dígitos) e CNPJ (14 dígitos); documentos mascarados (***) não são validados.",
        limites: "Não verifica existência na Receita Federal — só consistência matemática.",
        falsosPositivos: "Praticamente nenhum: DV inválido é sempre defeito do dado.",
      },
      {
        id: "tse_valor_invalido",
        nome: "Valor impossível em doação/despesa/bem",
        tipo: "qualidade",
        hipotese: "Valores negativos não existem em doações, despesas ou bens declarados.",
        parametros: "valor < 0 após normalização da vírgula decimal.",
        limites: "Valores absurdamente altos (mas positivos) não são flagrados por esta regra.",
        falsosPositivos: "Nenhum conhecido.",
      },
      {
        id: "tse_data_impossivel",
        nome: "Data fora da janela da eleição",
        tipo: "qualidade",
        hipotese:
          "Receita ou despesa de campanha datada muito antes/depois do ciclo eleitoral indica erro de digitação na prestação.",
        parametros: "Ano da data fora do intervalo [ano da eleição − 1, ano da eleição + 1].",
        limites: "Prestações retificadoras podem ter lançamentos tardios legítimos.",
        falsosPositivos: "Acertos contábeis pós-eleição registrados com a data do acerto.",
      },
      {
        id: "tse_sentinela_nao_tratada",
        nome: "Sentinela vazando para campo normalizado",
        tipo: "qualidade",
        hipotese:
          "Os CSVs do TSE usam sentinelas (#NULO#, #NE, -1, -3, NÃO DIVULGÁVEL) para 'não informado'. Se uma delas aparece num campo já normalizado, o parser falhou.",
        parametros: "Padrão textual das sentinelas em qualquer campo string pós-normalização.",
        limites: "É um autoteste do nosso pipeline, não um defeito da origem.",
        falsosPositivos: "Texto legítimo que contenha a substring (raríssimo).",
      },
      {
        id: "tse_duplicata_importacao",
        nome: "Duplicata no lote de importação",
        tipo: "qualidade",
        hipotese:
          "Duas linhas com a mesma chave natural (ou mesmo hash determinístico, em 2014/2016) no mesmo lote indicam duplicação na origem ou colisão de hash.",
        parametros:
          "Colisão de id dentro do lote. Em 2018+ o id é o SQ_RECEITA/SQ_DESPESA oficial; em 2014/2016, hash de (candidato, ano, data, documento, valor, recibo).",
        limites: "Duplicatas entre lotes diferentes são absorvidas silenciosamente pelo upsert.",
        falsosPositivos:
          "Duas doações legítimas idênticas (mesmo doador, dia, valor) sem número de recibo, em 2014/2016.",
      },
      {
        id: "tse_encoding_suspeito",
        nome: "Encoding suspeito",
        tipo: "qualidade",
        hipotese:
          "Caractere de substituição (�) após decodificar Latin-1 indica byte corrompido na origem ou encoding diferente do declarado.",
        parametros: "Presença de U+FFFD em qualquer campo textual.",
        limites: "Não corrige — apenas sinaliza.",
        falsosPositivos: "Nenhum conhecido.",
      },
      {
        id: "tse_eleito_sem_prestacao",
        nome: "Eleito sem prestação de contas",
        tipo: "lacuna",
        hipotese:
          "Todo candidato eleito é obrigado por lei a prestar contas finais. Eleito com zero receitas E zero despesas no cache é uma ausência que deveria ser impossível.",
        parametros:
          "situacao_totalizacao começando com 'eleito' + nenhuma linha de receita/despesa + confirmação na API DivulgaCandContas antes de publicar. Se a API mostra gasto que não temos, o achado vira alerta de qualidade (falha da NOSSA importação) em vez de lacuna.",
        limites:
          "Depende de receitas/despesas do (ano, UF) terem sido importadas; a confirmação via API é limitada por rodada.",
        falsosPositivos:
          "Importação parcial das contas do estado (por isso a dupla checagem na API antes de publicar).",
      },
      {
        id: "tse_candidato_sem_bens",
        nome: "Candidato sem declaração de bens",
        tipo: "lacuna",
        hipotese:
          "A declaração de bens é obrigatória no registro de candidatura — mesmo 'sem bens' deveria gerar registro; ausência total é lacuna.",
        parametros:
          "Candidato apto sem nenhuma linha de bens no ano. Regra desativada por padrão até confirmarmos, ano a ano, se 'sem bens' gera registro no CSV.",
        limites:
          "O comportamento da origem varia por ano — por isso a ativação é manual e auditada.",
        falsosPositivos: "Anos em que declaração vazia legitimamente não gera linha no CSV.",
      },
      {
        id: "tse_serie_historica",
        nome: "Série histórica incompleta",
        tipo: "lacuna",
        hipotese:
          "Para cada eleição importada, esperamos candidatos em todas as UFs. (Ano, UF) sem nenhum registro é buraco na série.",
        parametros:
          "Zero candidatos no (ano, UF) de um ano com dados. Distinguimos a causa: varredura incompleta = falha NOSSA (alerta de qualidade, reimportar); varredura completa e vazia = ausência na origem (lacuna).",
        limites: "Só roda sobre anos já iniciados — backlog de importação não vira lacuna.",
        falsosPositivos: "UF legitimamente sem eleição naquele recorte (ex.: BR em municipais).",
      },
      {
        id: "tse_parlamentar_sem_match",
        nome: "Parlamentar sem candidatura vinculada",
        tipo: "lacuna",
        hipotese:
          "Todo parlamentar em exercício se elegeu — não ter nenhuma candidatura vinculada na ponte é impossível; ou falta o ano no cache ou o matcher não encontrou.",
        parametros:
          "Parlamentar do roster atual sem linha em tse_parlamentar_candidato (após a ponte rodar).",
        limites: "Depende do matcher (CPF na Câmara; nome+UF no Senado).",
        falsosPositivos: "Nome civil muito diferente do nome de urna; troca recente de suplente.",
      },
      {
        id: "doador_virou_fornecedor",
        nome: "Doador de campanha que virou fornecedor",
        tipo: "investigativo",
        hipotese:
          "O mesmo CNPJ que financiou a campanha de um parlamentar e depois fatura contratos públicos configura um padrão que merece verificação humana — doação e contrato são, isoladamente, legais.",
        parametros:
          "CNPJ doador (≥ R$ 1.000, corta ruído simbólico) de candidatura vinculada a parlamentar em exercício + presença do mesmo CNPJ como fornecedor em contratos no cache. O sinal grava valor doado, maior contrato, quantidade de contratos e intervalo em meses.",
        limites:
          "Não estabelece influência do parlamentar sobre o órgão contratante — isso é trabalho de apuração humana. CPFs (pessoas físicas) não cruzam por virem mascarados da origem.",
        falsosPositivos:
          "Fornecedores tradicionais do governo que também doam; doações pequenas de empresas com contratos antigos e recorrentes.",
      },
      {
        id: "evolucao_patrimonial_atipica",
        nome: "Evolução patrimonial atípica",
        tipo: "investigativo",
        hipotese:
          "Crescimento muito acelerado dos bens declarados entre duas eleições merece contexto — pode ser herança, venda de empresa ou enriquecimento a explicar.",
        parametros:
          "Mesmo CPF em duas eleições com bens_total ≥ 10× o anterior e valor final ≥ R$ 500 mil.",
        limites:
          "Declarações são autodeclaradas e sem auditoria do TSE; candidato pode ter declarado incompleto na primeira eleição.",
        falsosPositivos:
          "Correção de subdeclaração anterior; herança e partilha; valorização imobiliária concentrada.",
      },
      {
        id: "fornecedor_campanha_concentrado",
        nome: "Fornecedor de campanha concentrado",
        tipo: "investigativo",
        hipotese:
          "Um fornecedor que absorve fração alta do gasto de muitos candidatos do mesmo partido/UF pode indicar contratação coletiva legítima do diretório — ou direcionamento do fundo.",
        parametros:
          "≥ 10 candidatos do mesmo (partido, UF, ano) atendidos e ≥ 40% do gasto do grupo concentrado no CNPJ.",
        limites: "Não diferencia contrato coletivo negociado (legítimo e comum) de direcionamento.",
        falsosPositivos:
          "Gráficas e produtoras contratadas centralizadamente pelo diretório estadual.",
      },
    ],
  },
  {
    id: "outras-fontes",
    icon: <Landmark className="size-5" />,
    titulo: "Demais fontes (PNCP, Câmara, Senado, Transferegov, SICONFI)",
    resumo:
      "Alertas de qualidade que rodam na importação de cada fonte — defeitos do próprio dado, não padrões de gasto.",
    regras: [
      {
        id: "cgu_licitacoes_regras",
        nome: "Licitações (CGU): certame sem desfecho, data ausente, valor negativo",
        tipo: "qualidade",
        hipotese:
          "Licitações revogadas/anuladas/fracassadas/desertas representam gasto planejado que não se concretizou; datas ausentes e valores negativos são defeitos de origem.",
        parametros:
          "situação contendo revogada/anulada/fracassada/deserta; dataAbertura ausente ou ano fora de [1988, atual+1]; valor < 0.",
        limites: "Não acessa o processo administrativo para saber o motivo do insucesso.",
        falsosPositivos: "Revogação legítima por perda do objeto.",
      },
      {
        id: "cgu_emendas_regras",
        nome: "Emendas (CGU): pago > empenhado, liquidado > empenhado, valor negativo",
        tipo: "qualidade",
        hipotese:
          "Não se paga mais do que se reservou (empenhou) — violações indicam defeito no espelho de dados.",
        parametros: "pago > empenhado×1.001; liquidado > empenhado×1.001; valores negativos.",
        limites: "Tolerância de 0,1% para arredondamentos.",
        falsosPositivos: "Restos a pagar de exercícios anteriores mal consolidados na origem.",
      },
      {
        id: "convenios_transferegov_regras",
        nome: "Convênios (CGU/Transferegov): liberado > global, valores truncados",
        tipo: "qualidade",
        hipotese:
          "Repasse liberado acima do valor global pactuado, ou valores ínfimos (< R$ 100), indicam erro de escala/parse na origem.",
        parametros: "liberado > global×1.001; 0 < global < 100.",
        limites: "Aditivos podem elevar o global sem refletir imediatamente no espelho.",
        falsosPositivos: "Termos aditivos recentes ainda não espelhados.",
      },
      {
        id: "ceap_ceaps_regras",
        nome: "Cota parlamentar (Câmara/Senado): líquido > documento, valores negativos",
        tipo: "qualidade",
        hipotese: "Reembolso maior que o valor do documento fiscal é impossível.",
        parametros:
          "valor_liquido > valor_documento×1.01 (Câmara); valor_reembolsado < 0 (Senado).",
        limites: "Glosas parciais podem gerar diferenças legítimas pequenas (daí a tolerância).",
        falsosPositivos: "Ajustes contábeis de devolução registrados como negativo.",
      },
      {
        id: "siconfi_regras",
        nome: "SICONFI: valor negativo em conta de receita",
        tipo: "qualidade",
        hipotese:
          "Contas de receita/transferência não deveriam ser negativas nos relatórios fiscais.",
        parametros: "valor < 0 em contas contendo 'receita' ou 'transferência'.",
        limites: "Deduções intraorçamentárias legítimas podem aparecer como negativos.",
        falsosPositivos: "Linhas de dedução (FUNDEB) — por isso a severidade é apenas aviso.",
      },
    ],
  },
];

function MetodologiaPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      <span className="inline-block text-xs font-semibold tracking-widest text-accent uppercase">
        Transparência metodológica
      </span>
      <h1 className="font-display text-5xl leading-[0.95] mt-2">Metodologia</h1>
      <p className="mt-6 text-lg text-muted-foreground">
        O Mutirão de Dados opera com regras explicáveis. Esta página é o hub de metodologia do
        projeto: <strong className="text-foreground">toda regra que gera sinal</strong> — de
        qualquer fonte — está documentada aqui com hipótese, parâmetros, limites e falsos-positivos
        típicos. Quem fiscaliza precisa ser fiscalizável.
      </p>

      <section className="mt-10 prose-civic">
        <h2 className="font-display text-2xl">Princípios</h2>
        <ul className="mt-3 space-y-2 text-muted-foreground">
          <li>
            <strong className="text-foreground">Explicabilidade.</strong> Nenhuma regra opera como
            caixa-preta. Toda flag traz a explicação do critério em português.
          </li>
          <li>
            <strong className="text-foreground">Reversibilidade.</strong> Análises podem ser
            contestadas, corrigidas ou retiradas a pedido do interessado (veja{" "}
            <Link to="/contestar" className="text-accent underline">
              Contestar
            </Link>
            ).
          </li>
          <li>
            <strong className="text-foreground">Prudência.</strong> Anomalia estatística não
            equivale a irregularidade. A plataforma sinaliza padrões; a interpretação cabe ao
            leitor, à imprensa e aos órgãos de controle.
          </li>
          <li>
            <strong className="text-foreground">Minimização.</strong> Dados pessoais identificáveis
            presentes em campos livres são mascarados antes da exibição.
          </li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-2xl flex items-center gap-2">
          <Microscope className="size-5 text-accent" /> Os três tipos de sinal
        </h2>
        <p className="text-sm text-muted-foreground mt-2">
          Tudo o que a plataforma detecta pertence a um de três tipos.{" "}
          <strong className="text-foreground">Alerta de qualidade</strong>: defeito técnico do
          próprio dado (dígito verificador inválido, valor negativo).{" "}
          <strong className="text-foreground">Lacuna</strong>: algo que deveria existir e não é
          encontrado na fonte (eleito sem prestação de contas).{" "}
          <strong className="text-foreground">Sinal investigativo</strong>: padrão revelado por
          cruzamento de dados corretos e completos — nunca é acusação. A regra de classificação:
          cruzou dados → investigativo; ausência esperada → lacuna; defeito do registro → qualidade.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-2xl">Regras por fonte</h2>
        <p className="text-sm text-muted-foreground mt-2">
          Navegue por seção. Para cada regra: hipótese, parâmetros, limites conhecidos e classes
          típicas de falsos-positivos. Calibragens são revisadas conforme a amostra cresce.
        </p>
        <div className="mt-6 space-y-3">
          {SECOES.map((s) => (
            <Accordion key={s.id} type="single" collapsible>
              <AccordionItem value={s.id} className="border border-border rounded-xl bg-card px-5">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-start gap-3 text-left">
                    <div className="size-9 rounded-md bg-accent/10 text-accent flex items-center justify-center shrink-0">
                      {s.icon}
                    </div>
                    <div>
                      <div className="font-display text-lg leading-tight">{s.titulo}</div>
                      <div className="text-sm text-muted-foreground mt-0.5 font-normal">
                        {s.resumo}
                      </div>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-2 space-y-4">
                  {s.notas}
                  {s.regras.map((r) => (
                    <article
                      key={r.id}
                      className="border border-border rounded-xl p-5 bg-background"
                    >
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <h3 className="font-display text-lg">{r.nome}</h3>
                        <span
                          className={`text-[11px] border rounded-full px-2 py-0.5 shrink-0 ${TIPO_LABEL[r.tipo].classe}`}
                        >
                          {TIPO_LABEL[r.tipo].label}
                        </span>
                      </div>
                      <dl className="mt-3 text-sm space-y-2">
                        <div>
                          <dt className="text-xs uppercase tracking-wider text-muted-foreground">
                            Hipótese
                          </dt>
                          <dd className="mt-1">{r.hipotese}</dd>
                        </div>
                        <div>
                          <dt className="text-xs uppercase tracking-wider text-muted-foreground">
                            Parâmetros
                          </dt>
                          <dd className="mt-1 text-muted-foreground">{r.parametros}</dd>
                        </div>
                        <div>
                          <dt className="text-xs uppercase tracking-wider text-muted-foreground">
                            Limites
                          </dt>
                          <dd className="mt-1 text-muted-foreground">{r.limites}</dd>
                        </div>
                        <div>
                          <dt className="text-xs uppercase tracking-wider text-muted-foreground">
                            Falsos-positivos típicos
                          </dt>
                          <dd className="mt-1 text-muted-foreground">{r.falsosPositivos}</dd>
                        </div>
                      </dl>
                    </article>
                  ))}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          ))}
        </div>
      </section>

      <section className="mt-10 prose-civic">
        <h2 className="font-display text-2xl">Fontes</h2>
        <p className="mt-3 text-muted-foreground">
          Contratos, licitações, emendas e convênios do Executivo federal: API do Portal da
          Transparência (CGU). Contratações da Lei 14.133: PNCP. Parlamento: APIs da Câmara e do
          Senado. Repasses: Transferegov. Relatórios fiscais: SICONFI. Eleições: dados abertos do
          TSE (CKAN) com revalidação pontual na API DivulgaCandContas. Toda página de detalhe
          preserva o link para o documento oficial.
        </p>
      </section>

      <section className="mt-10 prose-civic">
        <h2 className="font-display text-2xl">Versionamento</h2>
        <p className="mt-3 text-muted-foreground">
          Mudanças relevantes nos parâmetros das regras são registradas aqui com data e
          justificativa. 2026-07: página reorganizada como hub por fonte; entram as regras da fonte
          TSE (qualidade, lacunas e os cruzamentos doador↔fornecedor, evolução patrimonial e
          fornecedor concentrado) e a taxonomia explícita dos três tipos de sinal.
        </p>
      </section>
    </article>
  );
}
