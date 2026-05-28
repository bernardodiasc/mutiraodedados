import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/metodologia")({
  component: MetodologiaPage,
  head: () => ({
    meta: [
      { title: "Critérios dos sinais — Auditoria Cidadã" },
      { name: "description", content: "Como as regras de detecção da Auditoria Cidadã são construídas, calibradas e limitadas. Transparência metodológica integral." },
      { property: "og:title", content: "Critérios dos sinais — Auditoria Cidadã" },
      { property: "og:description", content: "Hipóteses, parâmetros, limites conhecidos e falsos-positivos típicos de cada regra de detecção." },
      { property: "og:url", content: "https://auditoriacidada.ia.br/metodologia" },
      { property: "og:type", content: "article" },
    ],
    links: [{ rel: "canonical", href: "https://auditoriacidada.ia.br/metodologia" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          headline: "Metodologia da Auditoria Cidadã",
          description: "Hipóteses, parâmetros, limites conhecidos e falsos-positivos típicos de cada regra de detecção.",
          author: { "@type": "Organization", name: "Auditoria Cidadã" },
          publisher: { "@type": "Organization", name: "Auditoria Cidadã" },
          mainEntityOfPage: "https://auditoriacidada.ia.br/metodologia",
        }),
      },
    ],
  }),
});

type Regra = {
  id: string;
  nome: string;
  hipotese: string;
  parametros: string;
  limites: string;
  falsosPositivos: string;
};

const REGRAS: Regra[] = [
  {
    id: "crescimento_abrupto",
    nome: "Crescimento abrupto de fornecedor",
    hipotese: "Crescimentos repentinos na receita pública anual de uma empresa podem refletir captura, mas também expansão legítima após vitória em pregão grande, mudança de portfólio ou aquisição.",
    parametros: "Receita pública ≥ 3× a do ano anterior, com base ≥ R$ 500 mil. Limiares calibrados para evitar amplificar variações irrelevantes em fornecedores pequenos.",
    limites: "Não distingue setores. Empresas em mercados de baixa frequência (obras, equipamentos) variam naturalmente. Não considera reajuste contratual.",
    falsosPositivos: "Aditivos contratuais grandes; entrega plurianual concentrada em um exercício; primeira renovação de licitação vencida no ano anterior.",
  },
  {
    id: "fracionamento",
    nome: "Fracionamento artificial de despesa",
    hipotese: "Sucessão de dispensas de licitação logo abaixo do teto legal sugere segmentação intencional para evitar procedimento competitivo — vedado pela Lei 14.133/2021.",
    parametros: "≥ 5 contratos por dispensa, mesmo órgão + mesmo fornecedor + mesmo ano, todos abaixo do teto vigente (R$ 17.600 para bens e serviços comuns).",
    limites: "Não acessa o termo de referência. Não diferencia objeto distinto contratado em sequência (compras avulsas legítimas) de fracionamento real.",
    falsosPositivos: "Pequenas compras avulsas em órgãos descentralizados; suprimentos de uso contínuo onde o legislador permite múltiplas dispensas.",
  },
  {
    id: "concentracao",
    nome: "Concentração excessiva de fornecedor",
    hipotese: "Quando um único fornecedor responde por parcela majoritária do contratado de um órgão, há risco de dependência, captura ou mercado pouco competitivo.",
    parametros: "Um fornecedor concentra > 60% do contratado por um órgão em um ano, com volume agregado > R$ 2 milhões.",
    limites: "Não considera estrutura natural de mercado (monopólios legítimos: TI especializada, fornecedores únicos de medicamentos).",
    falsosPositivos: "Órgãos pequenos com poucos contratos; setores legalmente concentrados; inexigibilidade fundamentada.",
  },
  {
    id: "outlier_valor",
    nome: "Outlier de valor",
    hipotese: "Contratos com valor muito acima da média da série podem indicar superfaturamento, escopo mal definido ou apenas aquisição estruturante legítima.",
    parametros: "Valor ≥ 3 desvios-padrão acima da média da amostra.",
    limites: "Distribuições de contratos públicos são tipicamente assimétricas — desvio-padrão tem poder limitado nesses casos.",
    falsosPositivos: "Obras de infraestrutura; aquisição de equipamentos de grande porte; contratos plurianuais.",
  },
  {
    id: "fornecedor_recente_alto",
    nome: "Fornecedor recém-criado com contrato alto",
    hipotese: "Empresas com pouco tempo de constituição que recebem contratos de grande valor merecem checagem societária — pode haver legitimidade (spin-off, especialização) ou interposição.",
    parametros: "Primeira aparição no histórico há menos de 1 ano e contrato unitário ≥ R$ 1 milhão.",
    limites: "Usa data da primeira aparição nos dados carregados, não a data de constituição CNPJ real. A próxima fase integrará a Receita Federal.",
    falsosPositivos: "Empresas migrando de outra razão social; ingressantes legítimos em pregão.",
  },
  {
    id: "descricao_generica",
    nome: "Descrição contratual opaca",
    hipotese: "Objetos contratuais vagos ('serviços diversos', 'apoio operacional') comprometem o controle social — não é possível avaliar adequação de preço sem saber o que se contrata.",
    parametros: "Objeto < 30 caracteres ou contendo termos-bandeira, para valor ≥ R$ 200 mil.",
    limites: "Não acessa termo de referência ou anexos. Avaliação puramente textual.",
    falsosPositivos: "Cabeçalhos sintéticos cujo detalhamento real está no termo de referência anexo.",
  },
  {
    id: "dispensa_recorrente",
    nome: "Padrão recorrente de dispensa",
    hipotese: "Sucessivas dispensas com o mesmo fornecedor sugerem que o objeto deveria estar sob contrato licitado — a recorrência descaracteriza o caráter excepcional da dispensa.",
    parametros: "≥ 3 dispensas/ano com o mesmo órgão + fornecedor, repetidas por 2 anos consecutivos.",
    limites: "Não considera hipóteses legais específicas (calamidade, segurança nacional).",
    falsosPositivos: "Renovação anual de pequenos contratos legítimos com fornecedor exclusivo regional.",
  },
  {
    id: "crescimento_orgao",
    nome: "Crescimento abrupto do gasto do órgão",
    hipotese: "Saltos no gasto anual de um órgão podem indicar mudança de política pública, demanda real ou expansão problemática.",
    parametros: "Gasto anual ≥ 2× a mediana dos 3 anos anteriores, com baseline ≥ R$ 1 milhão.",
    limites: "Não distingue investimento de custeio. Não considera macroeconomia (inflação, câmbio).",
    falsosPositivos: "Anos com obra estruturante; resposta a emergência sanitária ou climática; reestruturação institucional.",
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
        A Auditoria Cidadã opera com regras explicáveis. Cada indicador descrito abaixo é
        publicado integralmente, com seus parâmetros, suas hipóteses e — sobretudo — seus
        limites. Quem fiscaliza precisa ser fiscalizável.
      </p>

      <section className="mt-10 prose-civic">
        <h2 className="font-display text-2xl">Princípios</h2>
        <ul className="mt-3 space-y-2 text-muted-foreground">
          <li><strong className="text-foreground">Explicabilidade.</strong> Nenhuma regra opera como caixa-preta. Toda flag traz a explicação do critério em português.</li>
          <li><strong className="text-foreground">Reversibilidade.</strong> Análises podem ser contestadas, corrigidas ou retiradas a pedido do interessado (veja <Link to="/contestar" className="text-accent underline">Contestar</Link>).</li>
          <li><strong className="text-foreground">Prudência.</strong> Anomalia estatística não equivale a irregularidade. A plataforma sinaliza padrões; a interpretação cabe ao leitor, à imprensa e aos órgãos de controle.</li>
          <li><strong className="text-foreground">Minimização.</strong> Dados pessoais identificáveis presentes em campos livres são mascarados antes da exibição.</li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-2xl">Regras de detecção</h2>
        <p className="text-sm text-muted-foreground mt-2">
          Para cada regra, documentamos hipótese, parâmetros, limites conhecidos e classes
          típicas de falsos-positivos. Calibragens são revisadas periodicamente conforme a
          amostra cresce.
        </p>
        <div className="mt-6 space-y-6">
          {REGRAS.map(r => (
            <article key={r.id} className="border border-border rounded-xl p-5 bg-card">
              <h3 className="font-display text-xl">{r.nome}</h3>
              <dl className="mt-3 text-sm space-y-2">
                <div>
                  <dt className="text-xs uppercase tracking-wider text-muted-foreground">Hipótese</dt>
                  <dd className="mt-1">{r.hipotese}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wider text-muted-foreground">Parâmetros</dt>
                  <dd className="mt-1 text-muted-foreground">{r.parametros}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wider text-muted-foreground">Limites</dt>
                  <dd className="mt-1 text-muted-foreground">{r.limites}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wider text-muted-foreground">Falsos-positivos típicos</dt>
                  <dd className="mt-1 text-muted-foreground">{r.falsosPositivos}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-10 prose-civic">
        <h2 className="font-display text-2xl">Fontes</h2>
        <p className="mt-3 text-muted-foreground">
          Contratos do Executivo federal: API do Portal da Transparência (Controladoria-Geral
          da União). Catálogo de órgãos: Sistema de Informações Organizacionais do Governo
          Federal (SIORG). Cota parlamentar, dados do Judiciário e do Ministério Público
          dependem de APIs próprias e estão no roadmap. Toda página de detalhe preserva o
          link para o documento oficial.
        </p>
      </section>

      <section className="mt-10 prose-civic">
        <h2 className="font-display text-2xl">Versionamento</h2>
        <p className="mt-3 text-muted-foreground">
          Mudanças relevantes nos parâmetros das regras serão registradas aqui com data e
          justificativa. A versão atual desta metodologia corresponde ao estado experimental
          da plataforma — refinamentos são esperados à medida que a amostra de contratos
          cresce e a calibragem se estabiliza.
        </p>
      </section>
    </article>
  );
}
