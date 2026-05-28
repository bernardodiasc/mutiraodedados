import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/sobre")({
  component: Sobre,
  head: () => ({ meta: [
    { title: "Sobre — Auditoria Cidadã" },
    { name: "description", content: "Observatório cívico de interpretação pública do Estado. Premissas, limites analíticos, fontes e responsabilidades editoriais da Auditoria Cidadã." },
    { property: "og:title", content: "Sobre — Auditoria Cidadã" },
    { property: "og:description", content: "Quem somos, o que fazemos, o que deliberadamente não fazemos." },
    { property: "og:url", content: "https://auditoriacidada.ia.br/sobre" },
    { property: "og:type", content: "article" },
  ],
    links: [{ rel: "canonical", href: "https://auditoriacidada.ia.br/sobre" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          headline: "Sobre a Auditoria Cidadã",
          description: "Observatório cívico de interpretação pública do Estado. Premissas, limites analíticos, fontes e responsabilidades editoriais.",
          author: { "@type": "Organization", name: "Auditoria Cidadã" },
          publisher: { "@type": "Organization", name: "Auditoria Cidadã" },
          mainEntityOfPage: "https://auditoriacidada.ia.br/sobre",
        }),
      },
    ],
  }),
});

function Sobre() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 prose-civic">
      <span className="inline-block text-xs font-semibold tracking-widest text-accent uppercase">Sobre o projeto</span>
      <h1 className="font-display text-5xl leading-[0.95] mt-2">Um observatório cívico</h1>

      <p className="mt-6 text-lg text-muted-foreground">
        Auditoria Cidadã é uma plataforma independente de pesquisa em transparência pública.
        Trabalhamos com uma premissa: transparência não é a publicação de dados. É a
        possibilidade de interpretá-los.
      </p>

      <h2 className="font-display text-2xl mt-10">Premissa</h2>
      <p className="mt-3 text-muted-foreground">
        Dados administrativos isolados informam pouco. Um valor contratado, fora de série
        histórica e de comparação entre pares, é cifra sem sentido público. A camada faltante
        — e que tribunais de contas, imprensa e cidadãos têm pouco tempo de produzir
        cotidianamente — é a <strong className="text-foreground">camada interpretativa</strong>: contexto,
        agregação, comparação, narrativa metodológica.
      </p>
      <p className="mt-3 text-muted-foreground">
        Essa é a função da plataforma. Reorganizar dados públicos do Executivo federal,
        aplicar regras explicáveis para sinalizar padrões e devolver ao leitor um conjunto
        de leituras possíveis — sob responsabilidade declarada.
      </p>

      <h2 className="font-display text-2xl mt-10">O que fazemos</h2>
      <ul className="mt-3 space-y-2 text-muted-foreground">
        <li>Coletamos contratos do Executivo federal via API do Portal da Transparência (CGU).</li>
        <li>Construímos séries históricas, agregações por órgão e por função de governo.</li>
        <li>Aplicamos regras estatísticas explicáveis que sinalizam padrões merecedores de checagem.</li>
        <li>Apresentamos contexto comparativo — mediana de pares, sazonalidade, concentração.</li>
        <li>Documentamos integralmente nossa <Link to="/metodologia" className="text-accent underline">metodologia</Link>.</li>
      </ul>

      <h2 className="font-display text-2xl mt-10">O que deliberadamente não fazemos</h2>
      <ul className="mt-3 space-y-2 text-muted-foreground">
        <li>Não atribuímos responsabilidade a pessoas físicas ou jurídicas. Sinais não são acusações.</li>
        <li>Não construímos rankings nominais de servidores ou parlamentares.</li>
        <li>Não republicamos dados pessoais identificáveis — CPF, endereço, contatos pessoais — ainda que apareçam em documentos públicos. Ver <Link to="/tratamento-de-dados" className="text-accent underline">Tratamento de Dados</Link>.</li>
        <li>Não substituímos órgãos oficiais de controle. Operamos como camada complementar.</li>
        <li>Não fazemos jornalismo investigativo. Oferecemos pontos de partida para quem faz.</li>
      </ul>

      <h2 className="font-display text-2xl mt-10">Limites analíticos</h2>
      <p className="mt-3 text-muted-foreground">
        Toda análise automatizada tem ponto cego. Regras estatísticas presumem regularidade —
        e o setor público brasileiro tem heterogeneidades estruturais que regras genéricas
        capturam mal. Mercados monopolistas legítimos, contratos plurianuais concentrados,
        emergências sanitárias e mudanças de política pública geram sinais que parecem
        anômalos sem serem irregulares.
      </p>
      <p className="mt-3 text-muted-foreground">
        Por isso a plataforma trabalha com vocabulário de <em>sinal investigativo</em>, não
        de <em>indício</em> ou <em>denúncia</em>. A diferença é jurídica e editorial — e está
        descrita na seção <Link to="/aprender" className="text-accent underline">Aprender</Link>.
      </p>

      <h2 className="font-display text-2xl mt-10">Fontes</h2>
      <p className="mt-3 text-muted-foreground">
        Contratos: API do Portal da Transparência (Controladoria-Geral da União). Catálogo
        de órgãos: SIORG. Cota parlamentar (CEAP/CEAPS), Judiciário (STF, STJ, CNJ) e
        Ministério Público têm APIs próprias e estão no roadmap — o catálogo já sinaliza
        esses órgãos como pendentes. Normalizações futuras por deflator e per capita usarão
        séries do IBGE e do IPEA. Toda análise preserva o vínculo com a fonte oficial.
      </p>

      <h2 className="font-display text-2xl mt-10">Estado de desenvolvimento</h2>
      <p className="mt-3 text-muted-foreground">
        A plataforma é <strong className="text-foreground">experimental</strong>. Funcionalidades estão em
        amadurecimento e a calibragem das regras será revisada conforme a amostra cresce.
        Apoios, críticas e contestações são bem-vindos — ver <Link to="/contestar" className="text-accent underline">Contestar</Link>.
      </p>

      <h2 className="font-display text-2xl mt-10">Roadmap</h2>
      <p className="mt-3 text-muted-foreground">
        O que já está no ar, o que vem a seguir e as notas de cada entrega ficam em{" "}
        <Link to="/roadmap" className="text-accent underline">Roadmap & novidades</Link>.
      </p>
    </article>
  );
}
