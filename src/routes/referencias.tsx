import { createFileRoute, Link } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";

export const Route = createFileRoute("/referencias")({
  component: Referencias,
  head: () => ({
    meta: [
      { title: "Referências e projetos similares — Mutirão de Dados" },
      {
        name: "description",
        content:
          "Portais oficiais, APIs públicas, fontes de dados e projetos de transparência e mutirão de dados usados ou recomendados pelo Mutirão de Dados.",
      },
      { property: "og:title", content: "Referências — Mutirão de Dados" },
      {
        property: "og:description",
        content:
          "Fontes oficiais, APIs públicas e outros projetos de transparência. Quanto mais gente usando dados abertos, melhor.",
      },
      { property: "og:url", content: "https://mutiraodedados.com.br/referencias" },
      { property: "og:type", content: "article" },
    ],
    links: [{ rel: "canonical", href: "https://mutiraodedados.com.br/referencias" }],
  }),
});

type Ref = { titulo: string; url: string; descricao: string };

const PORTAIS_OFICIAIS: Ref[] = [
  {
    titulo: "Portal da Transparência (CGU)",
    url: "https://portaldatransparencia.gov.br",
    descricao:
      "Portal central do Executivo federal. Despesas, contratos, convênios, servidores, sanções, benefícios sociais.",
  },
  {
    titulo: "Portal Nacional de Contratações Públicas (PNCP)",
    url: "https://pncp.gov.br",
    descricao:
      "Repositório obrigatório de contratações públicas dos três poderes e três esferas, conforme Lei 14.133/2021.",
  },
  {
    titulo: "Compras.gov.br",
    url: "https://www.gov.br/compras",
    descricao:
      "Sistema de compras do Executivo federal: licitações, pregões, atas, fornecedores cadastrados (SICAF).",
  },
  {
    titulo: "SICONFI — Tesouro Nacional",
    url: "https://siconfi.tesouro.gov.br",
    descricao:
      "Relatórios fiscais obrigatórios (RREO, RGF, DCA) de União, estados, DF e municípios.",
  },
  {
    titulo: "TransfereGov",
    url: "https://www.gov.br/transferegov",
    descricao:
      "Sistema federal de transferências voluntárias: convênios, contratos de repasse e termos de fomento.",
  },
  {
    titulo: "Diário Oficial da União (Imprensa Nacional)",
    url: "https://www.in.gov.br",
    descricao: "Publicação oficial de atos normativos, nomeações, contratos e extratos do Executivo federal.",
  },
  {
    titulo: "Câmara dos Deputados — Dados Abertos",
    url: "https://dadosabertos.camara.leg.br",
    descricao: "Deputados, proposições, votações, despesas da cota parlamentar (CEAP), discursos.",
  },
  {
    titulo: "Senado Federal — Dados Abertos",
    url: "https://www12.senado.leg.br/dados-abertos",
    descricao: "Senadores, matérias, votações, comissões e atividade legislativa do Senado.",
  },
  {
    titulo: "Tribunal de Contas da União (TCU)",
    url: "https://portal.tcu.gov.br",
    descricao: "Acórdãos, fiscalizações, contas de governo e jurisprudência sobre gestão pública federal.",
  },
  {
    titulo: "Receita Federal — CNPJ aberto",
    url: "https://dadosabertos.rfb.gov.br/CNPJ",
    descricao: "Base completa de empresas brasileiras (matriz, filiais, sócios, atividades) publicada mensalmente.",
  },
  {
    titulo: "IBGE",
    url: "https://www.ibge.gov.br",
    descricao: "Estatísticas demográficas, econômicas e sociais. Base geográfica oficial dos municípios.",
  },
  {
    titulo: "Tribunal Superior Eleitoral (TSE) — Repositório de Dados",
    url: "https://dadosabertos.tse.jus.br",
    descricao: "Candidaturas, prestação de contas, resultados eleitorais e filiação partidária.",
  },
  {
    titulo: "DivulgaCandContas (TSE)",
    url: "https://divulgacandcontas.tse.jus.br",
    descricao: "Consulta pública a candidaturas, prestação de contas eleitorais e propaganda de todos os cargos e eleições.",
  },
  {
    titulo: "DivulgaSPCA (TSE)",
    url: "https://divulgaspca.tse.jus.br",
    descricao: "Divulgação das prestações de contas anuais dos diretórios partidários (nacional, estaduais e municipais), por exercício.",
  },
  {
    titulo: "ComunicaBR (Presidência da República)",
    url: "https://comunicabr.presidencia.gov.br",
    descricao: "Portal oficial de comunicação do governo federal: notícias, informes e divulgação institucional.",
  },
];

const APIS_OFICIAIS: Ref[] = [
  {
    titulo: "API do Portal da Transparência",
    url: "https://api.portaldatransparencia.gov.br",
    descricao: "API REST oficial da CGU. Requer cadastro de e-mail para obter chave de acesso.",
  },
  {
    titulo: "API do PNCP",
    url: "https://pncp.gov.br/api/consulta/swagger-ui/index.html",
    descricao: "Consulta pública de contratações, atas e contratos publicados no PNCP.",
  },
  {
    titulo: "API SICONFI",
    url: "https://apidatalake.tesouro.gov.br/docs/siconfi/",
    descricao: "Acesso programático aos relatórios fiscais entregues por entes federativos.",
  },
  {
    titulo: "API da Câmara dos Deputados",
    url: "https://dadosabertos.camara.leg.br/swagger/api.html",
    descricao: "API REST com toda a atividade parlamentar da Câmara.",
  },
  {
    titulo: "API do Senado Federal",
    url: "https://legis.senado.leg.br/dadosabertos/docs/",
    descricao: "Serviços abertos do Senado em XML/JSON.",
  },
  {
    titulo: "BrasilAPI",
    url: "https://brasilapi.com.br",
    descricao: "Agregador comunitário de APIs brasileiras: CEP, CNPJ, bancos, feriados, FIPE, IBGE.",
  },
  {
    titulo: "Minha Receita",
    url: "https://minhareceita.org",
    descricao: "API pública e gratuita de consulta a CNPJ, mantida pela Open Knowledge Brasil.",
  },
  {
    titulo: "LexML",
    url: "https://www.lexml.gov.br",
    descricao: "Rede de informação legislativa e jurídica brasileira com identificadores estáveis (URN LEX).",
  },
];

const SITES_RELEVANTES: Ref[] = [
  {
    titulo: "Lei de Acesso à Informação (LAI)",
    url: "https://www.gov.br/acessoainformacao",
    descricao: "Portal oficial da Lei 12.527/2011. Cadastro de pedidos via Fala.BR.",
  },
  {
    titulo: "Fala.BR",
    url: "https://falabr.cgu.gov.br",
    descricao: "Plataforma integrada de ouvidoria e acesso à informação do governo federal.",
  },
  {
    titulo: "e-SIC dos entes federativos",
    url: "https://www.gov.br/acessoainformacao/pt-br/lai-para-sic/guia-rapido-para-busca-de-informacoes",
    descricao: "Diretório de Sistemas Eletrônicos de Informação ao Cidadão em estados e municípios.",
  },
  {
    titulo: "ANPD — Autoridade Nacional de Proteção de Dados",
    url: "https://www.gov.br/anpd",
    descricao: "Regulador da LGPD. Guias, decisões e orientações sobre tratamento de dados pessoais.",
  },
  {
    titulo: "Open Knowledge Brasil",
    url: "https://ok.org.br",
    descricao: "Organização da sociedade civil dedicada a dados abertos, transparência e tecnologia cívica.",
  },
  {
    titulo: "Transparência Brasil",
    url: "https://www.transparencia.org.br",
    descricao: "ONG focada em monitoramento de gestão pública, contratações e integridade.",
  },
  {
    titulo: "Abraji — Associação Brasileira de Jornalismo Investigativo",
    url: "https://www.abraji.org.br",
    descricao: "Capacitação, ferramentas e advocacy em jornalismo de dados e LAI.",
  },
  {
    titulo: "Article 19 Brasil",
    url: "https://artigo19.org",
    descricao: "Atuação em liberdade de expressão e acesso à informação pública.",
  },
];

const PROJETOS_SIMILARES: Ref[] = [
  {
    titulo: "Operação Serenata de Amor",
    url: "https://serenata.ai",
    descricao:
      "Pioneiro brasileiro em auditoria automatizada de despesas parlamentares (CEAP) por IA. Inspiração metodológica direta.",
  },
  {
    titulo: "Querido Diário (Open Knowledge Brasil)",
    url: "https://queridodiario.ok.org.br",
    descricao: "Coleta e disponibiliza diários oficiais municipais em formato aberto e pesquisável.",
  },
  {
    titulo: "Achados e Pedidos",
    url: "https://achadosepedidos.org.br",
    descricao: "Buscador de pedidos de LAI já respondidos por órgãos públicos federais e estaduais.",
  },
  {
    titulo: "Ranking dos Políticos",
    url: "https://www.rankingdospoliticos.com.br",
    descricao: "Avaliação automatizada de parlamentares com base em produção legislativa e ficha-limpa.",
  },
  {
    titulo: "Basômetro (Estadão)",
    url: "https://www.estadao.com.br/politica/basometro",
    descricao: "Mede a fidelidade de parlamentares ao governo a partir de votações nominais.",
  },
  {
    titulo: "Cuidando do Meu Bairro",
    url: "https://cuidando.vc",
    descricao: "Visualiza o orçamento de São Paulo georreferenciado por bairro.",
  },
  {
    titulo: "Onde Meu Dinheiro Está",
    url: "https://www.transparencia.org.br/projetos/excelencias-i",
    descricao: "Iniciativa histórica da Transparência Brasil sobre rastreio do gasto público.",
  },
  {
    titulo: "Volt Data Lab — A Pública / Truco",
    url: "https://apublica.org",
    descricao: "Jornalismo investigativo brasileiro com forte uso de dados públicos.",
  },
  {
    titulo: "Base dos Dados",
    url: "https://basedosdados.org",
    descricao:
      "Datalake público com dezenas de bases governamentais tratadas e consultáveis via BigQuery, Python e R.",
  },
  {
    titulo: "Atlas da Notícia (Volt Data Lab)",
    url: "https://www.atlas.jor.br",
    descricao: "Mapeia desertos de notícias em municípios brasileiros.",
  },
];

function RefList({ items }: { items: Ref[] }) {
  return (
    <ul className="mt-4 space-y-4 not-prose">
      {items.map((r) => (
        <li key={r.url} className="border-l-2 border-border pl-4">
          <a
            href={r.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-1.5 text-base font-semibold text-foreground hover:text-accent"
          >
            {r.titulo}
            <ExternalLink className="h-3.5 w-3.5 opacity-60 group-hover:opacity-100" />
          </a>
          <p className="mt-1 text-sm text-muted-foreground">{r.descricao}</p>
        </li>
      ))}
    </ul>
  );
}

function Referencias() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 prose-civic">
      <span className="inline-block text-xs font-semibold tracking-widest text-accent uppercase">
        Sobre o projeto
      </span>
      <h1 className="font-display text-5xl leading-[0.95] mt-2">Referências</h1>

      <p className="mt-6 text-lg text-muted-foreground">
        Esta página reúne as fontes oficiais que alimentam o Mutirão de Dados, as APIs públicas que
        usamos ou recomendamos, e outras iniciativas de transparência e auditoria pública. Quanto
        mais pessoas trabalhando com dados públicos brasileiros, melhor — mesmo que os projetos
        fiquem parecidos.
      </p>

      <h2 id="portais" className="font-display text-2xl mt-12">
        Portais oficiais
      </h2>
      <p className="mt-3 text-sm text-muted-foreground">
        Fontes primárias do Estado brasileiro. Tudo que publicamos pode ser conferido nesses
        portais.
      </p>
      <RefList items={PORTAIS_OFICIAIS} />

      <h2 id="apis" className="font-display text-2xl mt-12">
        APIs oficiais e de dados abertos
      </h2>
      <p className="mt-3 text-sm text-muted-foreground">
        Interfaces programáticas para consumir dados públicos em escala.
      </p>
      <RefList items={APIS_OFICIAIS} />

      <h2 id="sites" className="font-display text-2xl mt-12">
        Outros sites relevantes
      </h2>
      <p className="mt-3 text-sm text-muted-foreground">
        Reguladores, ferramentas de acesso à informação e organizações que defendem transparência.
      </p>
      <RefList items={SITES_RELEVANTES} />

      <h2 id="projetos-similares" className="font-display text-2xl mt-16">
        Projetos similares
      </h2>
      <p className="mt-3 text-muted-foreground">
        Transparência pública não é zona de competição — é bem comum. Listamos abaixo projetos
        brasileiros que usam dados públicos para devolver interpretação ao cidadão. Se você está
        pensando em criar algo parecido com o Mutirão de Dados, <strong className="text-foreground">faça</strong>.
        Os dados são os mesmos e estão disponíveis. Quanto mais leituras independentes, mais difícil
        é capturar a narrativa pública. Se sua iniciativa não está aqui e deveria estar,{" "}
        <Link
          to="/contestar"
          className="text-accent underline-offset-4 hover:underline"
        >
          escreva para a gente
        </Link>
        .
      </p>
      <RefList items={PROJETOS_SIMILARES} />

      <p className="mt-12 text-sm text-muted-foreground">
        Última revisão: maio de 2026. Esta lista é curada manualmente e não é exaustiva.
      </p>
    </article>
  );
}