import { createFileRoute, Link } from "@tanstack/react-router";
import { HeartHandshake, Eye, Flag, Bookmark, PenLine, Code2, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/contribuir")({
  component: Contribuir,
  head: () => ({
    meta: [
      { title: "Contribuir — Auditoria Cidadã" },
      { name: "description", content: "Como participar da Auditoria Cidadã: lendo dados, revisando sinais, marcando informações ou contribuindo com código no repositório open source." },
      { property: "og:title", content: "Contribuir — Auditoria Cidadã" },
      { property: "og:description", content: "Open data, open source e participação cidadã: caminhos para colaborar com o projeto." },
      { property: "og:url", content: "https://auditoriacidada.ia.br/contribuir" },
      { property: "og:type", content: "article" },
    ],
    links: [{ rel: "canonical", href: "https://auditoriacidada.ia.br/contribuir" }],
  }),
});

function Contribuir() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 prose-civic">
      <span className="inline-flex items-center gap-2 text-xs font-semibold tracking-widest text-accent uppercase">
        <HeartHandshake className="size-3.5" /> Contribuir
      </span>
      <h1 className="font-display text-5xl leading-[0.95] mt-2">
        Este projeto se faz com gente
      </h1>
      <p className="mt-6 text-lg text-muted-foreground">
        A Auditoria Cidadã não nasceu de uma empresa nem de um governo. Nasceu de
        um movimento mais antigo, internacional e teimoso, que entende que
        informação pública pertence ao público — e que tecnologia também.
      </p>

      <h2 className="font-display text-2xl mt-12">Uma história curta sobre por que isto existe</h2>
      <p className="mt-3 text-muted-foreground">
        No fim dos anos 1990 e ao longo dos anos 2000, dois movimentos cresceram
        em paralelo fora do Brasil. De um lado, o <strong className="text-foreground">software livre e o
        open source</strong>: pessoas defendendo que o código que move o mundo
        precisa poder ser lido, copiado, estudado e melhorado por qualquer um.
        De outro, o <strong className="text-foreground">open data</strong>: pesquisadores, jornalistas e
        ativistas defendendo que dados produzidos com dinheiro público — orçamento,
        contratos, votações, indicadores — precisam ser publicados em formato
        aberto, legível por máquinas, para que a sociedade possa interpretá-los.
      </p>
      <p className="mt-3 text-muted-foreground">
        Os dois movimentos compartilham a mesma intuição: transparência não é
        favor, é infraestrutura. E participação voluntária — gente que doa tempo
        para revisar, traduzir, documentar, denunciar — é o que dá vida a essa
        infraestrutura.
      </p>
      <p className="mt-3 text-muted-foreground">
        Essas ideias chegaram ao Brasil com atraso e enfrentaram resistência. A
        Lei de Acesso à Informação (Lei 12.527) só foi sancionada em{" "}
        <strong className="text-foreground">2011</strong>, depois de anos de pressão de
        organizações da sociedade civil. O Portal da Transparência, o PNCP, o
        Transferegov, as APIs da Câmara e do Senado — tudo o que esta plataforma
        consome — são fruto direto dessa luta. Não caíram do céu. Foram
        conquistados.
      </p>
      <p className="mt-3 text-muted-foreground">
        Manter esses dados úteis exige uso, crítica e cobrança constante. É aí
        que entra você.
      </p>

      <h2 className="font-display text-2xl mt-12">Como você pode contribuir</h2>
      <p className="mt-3 text-muted-foreground">
        Não precisa ser programador. Não precisa ser jornalista. Não precisa nem
        criar conta para começar.
      </p>

      <div className="mt-6 space-y-4 not-prose">
        <Card icon={Eye} titulo="Ler e investigar">
          A contribuição mais simples é também a mais valiosa: usar a
          plataforma. Navegue por{" "}
          <Link to="/orgaos" className="text-accent underline">órgãos</Link>,{" "}
          <Link to="/pncp" className="text-accent underline">contratos</Link>,{" "}
          <Link to="/convenios" className="text-accent underline">convênios</Link>{" "}
          ou <Link to="/anomalias" className="text-accent underline">sinais
          investigativos</Link>. Olhar com curiosidade já é controle social.
        </Card>

        <Card icon={Flag} titulo="Revisar alertas e contestar">
          Nossos sinais são automáticos e falham. Se algo parece errado, abra a{" "}
          <Link to="/contestar" className="text-accent underline">página de
          contestação</Link> e nos conte. Cada revisão humana melhora a calibragem
          do que mostramos a quem vier depois.
        </Card>

        <Card icon={Bookmark} titulo="Marcar dados">
          Crie uma conta para salvar contratos, parlamentares e órgãos em{" "}
          <Link to="/login" className="text-accent underline">marcações
          pessoais</Link>. Marcações públicas viram pistas para outros leitores
          e ajudam nossa equipe a entender o que merece destaque.
        </Card>

        <Card icon={PenLine} titulo="Revisar conteúdo">
          Textos explicativos, glossários, tutoriais e páginas conceituais são
          continuamente revisados. Se encontrar erro factual, link quebrado ou
          linguagem confusa, escreva pela{" "}
          <Link to="/contestar" className="text-accent underline">página de
          contato</Link>.
        </Card>

        <Card icon={Code2} titulo="Contribuir com código">
          O projeto inteiro é open source, sob licença AGPL-3.0. O repositório
          fica em:
          <div className="mt-3">
            <a
              href="https://github.com/bernardodiasc/auditoriacidada/"
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 text-accent underline break-all"
            >
              github.com/bernardodiasc/auditoriacidada
              <ExternalLink className="size-3.5 shrink-0" />
            </a>
          </div>
          <p className="mt-3 text-sm">
            Issues, sugestões de melhoria e pull requests são bem-vindos. Veja o{" "}
            <code className="text-xs">CONTRIBUTING.md</code> no repositório para
            o fluxo de PR.
          </p>
        </Card>
      </div>

      <h2 className="font-display text-2xl mt-12">Por que pedimos isto</h2>
      <p className="mt-3 text-muted-foreground">
        Porque uma plataforma cívica que ninguém usa é só um banco de dados
        bonito. E porque a história mostra que direitos de transparência que
        deixam de ser exercidos enfraquecem. Cada leitura, cada contestação,
        cada commit é uma forma pequena e concreta de manter essa
        infraestrutura viva.
      </p>
      <p className="mt-3 text-muted-foreground">
        Obrigado por chegar até aqui.
      </p>
    </article>
  );
}

function Card({
  icon: Icon,
  titulo,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start gap-3">
        <div className="size-9 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0">
          <Icon className="size-4" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium">{titulo}</h3>
          <div className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}