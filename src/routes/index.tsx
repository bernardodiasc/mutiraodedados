import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  ArrowRight,
  Layers,
  LineChart,
  Flame,
  CircleDashed,
  ShieldCheck,
  Route as RouteIcon,
  Map as MapIcon,
  BookOpen,
  Bookmark,
  MessageSquareWarning,
  HeartHandshake,
  Image as ImageIcon,
  GitBranch,
  Check,
  X,
  HardHat,
  Github,
  Compass,
  Search,
  Sparkles,
  Database,
  ChevronDown,
} from "lucide-react";
import { iconFor } from "@/lib/nav-groups";

/**
 * Homepage — visão "revolucionada" (scrollytelling).
 *
 * Sem dados ao vivo por ora: todo conteúdo é curado/estático.
 *
 * IMAGENS A PRODUZIR (placeholders <ImagePlaceholder/> abaixo aguardam estes assets;
 * ao receber, importar de "@/assets/…" e trocar por <img src alt/> como em orgaos.tsx):
 *  1. diagrama  — planilha de dados brutos se transformando em uma pergunta compreensível.
 *  2. diagrama  — um valor isolado (R$) ganhando série histórica, comparação e método até virar pergunta.
 *  3. screenshot — tela de Sinais investigativos listando padrões detectados.
 *  4. screenshot — página de um órgão federal com série histórica de gastos e principais fornecedores.
 *  5. diagrama  — rede conectando CNPJ de fornecedor, órgão, emenda e contrato pelas chaves de cruzamento.
 *  6. screenshot — uma trilha investigativa passo a passo.
 *  7. screenshot — o caderno pessoal de investigação com itens salvos e anotações.
 */

export const Route = createFileRoute("/")({
  component: Home,
  head: () => ({
    meta: [
      { title: "Mutirão de Dados — Entenda e fiscalize o gasto público do Brasil" },
      {
        name: "description",
        content:
          "O Mutirão de Dados reúne, cruza e contextualiza o gasto público brasileiro — contratos, emendas, convênios, órgãos, Congresso e eleições — para que qualquer pessoa consiga perguntar, entender e fiscalizar.",
      },
      {
        property: "og:title",
        content: "Mutirão de Dados — Entenda e fiscalize o gasto público do Brasil",
      },
      {
        property: "og:description",
        content:
          "Os dados públicos já são abertos. Falta quem os torne compreensíveis. Reunimos e contextualizamos o gasto público para o controle social de qualquer cidadão.",
      },
      { property: "og:url", content: "https://mutiraodedados.com.br/" },
    ],
    links: [{ rel: "canonical", href: "https://mutiraodedados.com.br/" }],
  }),
});

function Home() {
  return (
    <>
      <ConstrucaoHero />

      {/* A refatoração incompleta da homepage fica preservada abaixo, colapsada. */}
      <section className="mx-auto max-w-7xl px-4 pt-16 pb-24">
        <details className="group rounded-2xl border border-dashed border-border bg-muted/20">
          <summary className="flex cursor-pointer list-none items-center gap-3 p-5 sm:p-6">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <HardHat className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-base leading-snug sm:text-lg">
                Prévia da nova página inicial (em construção)
              </span>
              <span className="mt-1 block text-sm text-muted-foreground">
                Um rascunho da homepage revolucionada, ainda em refatoração — textos, imagens e
                seções podem mudar. Clique para expandir.
              </span>
            </span>
            <ChevronDown className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <div className="border-t border-dashed border-border pt-2">
            <PaginaEmRefatoracao />
          </div>
        </details>
      </section>
    </>
  );
}

/**
 * ConstrucaoHero — banner "acima da dobra" que enquadra o projeto:
 * iniciativa individual, experimental e de aprendizado, com dados reais porém
 * incompletos. Apresenta as features principais e convida a explorar/contribuir.
 */
function ConstrucaoHero() {
  return (
    <section className="border-b border-border bg-gradient-to-br from-background via-background to-accent/5">
      <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-6xl flex-col justify-center px-4 py-16 lg:py-20">
        <span className="inline-flex items-center gap-2 self-start rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
          <HardHat className="size-3.5" /> Iniciativa cidadã · experimental · em construção
        </span>

        <h1 className="mt-6 font-display text-4xl leading-[1.02] sm:text-5xl lg:text-6xl">
          Mutirão de Dados{" "}
          <span className="text-accent">é um experimento aberto de fiscalização pública.</span>
        </h1>

        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Uma iniciativa{" "}
          <strong className="text-foreground">independente e ainda em construção</strong> para
          reunir, cruzar e tornar compreensível o gasto público do Brasil. Os dados são{" "}
          <strong className="text-foreground">reais, de fontes oficiais</strong> — mas sabidamente{" "}
          <strong className="text-foreground">incompletos</strong>. A cobertura cresce semana a
          semana.
        </p>

        <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
          É um projeto sério e ativamente evoluindo, mas também uma plataforma de aprendizado em
          várias camadas — não venho desta área, e construo à medida que aprendo. Até o nome pode
          mudar no futuro. Se algo parecer incompleto, provavelmente é: acompanhe o{" "}
          <Link
            to="/roadmap"
            className="font-medium text-foreground underline underline-offset-2 hover:text-accent"
          >
            roadmap
          </Link>{" "}
          e a{" "}
          <Link
            to="/cobertura"
            className="font-medium text-foreground underline underline-offset-2 hover:text-accent"
          >
            cobertura dos dados
          </Link>
          .
        </p>

        {/* Features principais — o que já dá pra fazer */}
        <div className="mt-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">
            O que já dá pra fazer por aqui
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <HeroFeature
              icon={<MapIcon className="size-5" />}
              to="/mapas"
              titulo="Mapas investigativos"
              body="Roteiros que mostram quais dados cruzar, com um Kit de prompts pronto para copiar e investigar com IA."
            />
            <HeroFeature
              icon={<Bookmark className="size-5" />}
              to="/caderno"
              titulo="Caderno de investigação"
              body="Sua bancada pessoal: salve contratos, órgãos e sinais, anote suas descobertas e publique se quiser."
            />
            <HeroFeature
              icon={<Flame className="size-5" />}
              to="/anomalias"
              titulo="Sinais e lacunas"
              body="Regras estatísticas apontam padrões incomuns, e mapeamos as informações públicas que deveriam existir e não estão lá."
            />
            <HeroFeature
              icon={<Database className="size-5" />}
              to="/explorar"
              titulo="Oito fontes reunidas"
              body="CGU, PNCP, Transferegov, SICONFI, Câmara, Senado, TSE e Congresso — padronizados num só lugar."
            />
            <HeroFeature
              icon={<RouteIcon className="size-5" />}
              to="/trilhas"
              titulo="Trilhas e aprendizado"
              body="Aprenda a olhar: leis, vocabulário e caminhos para ler dados públicos com confiança."
            />
            <HeroFeature
              icon={<Search className="size-5" />}
              to="/buscar"
              titulo="Busca e exploração"
              body="Órgãos, contratos, emendas, cota parlamentar e financiamento de campanhas — tudo pesquisável."
            />
          </div>
        </div>

        {/* CTAs */}
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Link
            to="/explorar"
            className="inline-flex items-center gap-2 rounded-md bg-accent px-5 py-3 font-semibold text-accent-foreground hover:opacity-90"
          >
            <Compass className="size-4" /> Explorar os dados
          </Link>
          <Link
            to="/sobre"
            data-flat
            className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-5 py-3 font-semibold hover:bg-muted"
          >
            <Sparkles className="size-4" /> Entender o projeto
          </Link>
          <a
            href="https://github.com/bernardodiasc/mutiraodedados"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-5 py-3 font-semibold hover:bg-muted"
          >
            <Github className="size-4" /> Ver no GitHub
          </a>
        </div>

        <p className="mt-6 max-w-2xl text-sm text-muted-foreground">
          O projeto é <strong className="text-foreground">open source</strong>. Todo o código, os
          métodos e o progresso estão abertos — quem quiser acompanhar, apontar erros ou contribuir
          é bem-vindo.
        </p>
      </div>
    </section>
  );
}

function HeroFeature({
  icon,
  to,
  titulo,
  body,
}: {
  icon: ReactNode;
  to: string;
  titulo: string;
  body: string;
}) {
  return (
    <Link
      to={to}
      className="group flex flex-col rounded-xl border border-border bg-card p-5 transition-colors hover:border-accent"
    >
      <span className="flex size-9 items-center justify-center rounded-md bg-accent/10 text-accent">
        {icon}
      </span>
      <span className="mt-3 font-display text-base leading-snug group-hover:text-accent">
        {titulo}
      </span>
      <span className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</span>
    </Link>
  );
}

function PaginaEmRefatoracao() {
  return (
    <>
      {/* 1. HERO — gancho + tese */}
      <section className="border-b border-border bg-gradient-to-br from-background via-background to-muted/40">
        <div className="mx-auto max-w-7xl px-4 py-20 lg:py-28">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div className="max-w-2xl">
              <span className="inline-block text-xs font-semibold tracking-widest text-accent uppercase">
                Perguntas · Evidências · Memória
              </span>
              <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl mt-4 leading-[0.95]">
                Os dados públicos já são abertos.{" "}
                <span className="text-accent">Falta quem os torne compreensíveis.</span>
              </h1>
              <p className="mt-6 text-lg text-muted-foreground max-w-xl leading-relaxed">
                O Mutirão de Dados reúne, cruza e contextualiza o gasto público do Brasil —
                contratos, emendas, convênios, órgãos, Congresso e eleições — para que{" "}
                <strong>qualquer pessoa</strong> consiga perguntar, entender e fiscalizar. Sem
                precisar ser especialista.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  to="/explorar"
                  className="inline-flex items-center gap-2 bg-accent text-accent-foreground px-5 py-3 rounded-md font-semibold hover:opacity-90"
                >
                  Explorar os dados <ArrowRight className="size-4" />
                </Link>
                <Link
                  to="/sobre"
                  data-flat
                  className="inline-flex items-center gap-2 border border-border bg-background px-5 py-3 rounded-md font-semibold hover:bg-muted"
                >
                  Entender o projeto <ArrowRight className="size-4" />
                </Link>
              </div>
            </div>
            <ImagePlaceholder
              kind="Diagrama"
              icon={<Layers className="size-8" />}
              titulo="Do dado bruto à pergunta"
              alt="Uma planilha de dados públicos brutos se transformando, passo a passo, em uma pergunta compreensível por qualquer cidadão."
              ratio="aspect-[4/3]"
            />
          </div>
        </div>
      </section>

      {/* 2. A TESE — a camada que falta */}
      <section className="mx-auto max-w-7xl px-4 mt-20">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <ImagePlaceholder
            kind="Diagrama"
            icon={<LineChart className="size-8" />}
            titulo="Um número ganhando contexto"
            alt="Um valor isolado em reais ganhando camadas — série histórica, comparação entre órgãos parecidos e método — até se tornar uma pergunta investigável."
            ratio="aspect-[4/3]"
            className="lg:order-2"
          />
          <div className="max-w-xl">
            <span className="inline-block text-xs font-semibold tracking-widest text-accent uppercase">
              Por que isto importa
            </span>
            <h2 className="font-display text-3xl sm:text-4xl mt-4">
              Um número sozinho não diz nada.
            </h2>
            <p className="text-muted-foreground mt-4 leading-relaxed">
              Um contrato de R$ 4 milhões é caro ou barato? Sem série histórica, sem comparação com
              órgãos parecidos e sem entender o método, um valor é só uma cifra. Os portais oficiais
              publicam os dados — mas raramente a <strong>camada interpretativa</strong> que os
              torna legíveis.
            </p>
            <p className="text-muted-foreground mt-4 leading-relaxed">
              É essa camada que construímos: contexto, agregação, comparação e narrativa
              metodológica. Transformamos planilhas em perguntas que você consegue fazer — e seguir.
            </p>
            <p className="mt-5 text-sm font-medium text-foreground/80">
              Cada número aqui é um ponto de partida, nunca uma conclusão.
            </p>
          </div>
        </div>
      </section>

      {/* 3. O QUE JÁ DÁ PRA DESCOBRIR — prova curada */}
      <section className="mx-auto max-w-7xl px-4 mt-24">
        <SectionHeading
          kicker="O que aparece por aqui"
          titulo="Alguns padrões que a plataforma ajuda a enxergar."
          descricao="Exemplos ilustrativos do tipo de sinal que detectamos automaticamente. Um padrão incomum não é uma acusação — é um convite a investigar."
        />
        <div className="mt-8 grid md:grid-cols-3 gap-4">
          <FindingCard
            badge="Sinal · crescimento abrupto"
            titulo="Um fornecedor que multiplica de repente."
            body="Uma empresa que recebia pouco e, num ano, passa a receber várias vezes mais do mesmo órgão. Pode ter explicação — ou merecer uma pergunta."
            to="/anomalias"
            cta="Ver sinais investigativos"
          />
          <FindingCard
            badge="Sinal · fracionamento"
            titulo="Muitas dispensas logo abaixo do teto."
            body="Várias contratações diretas com o mesmo fornecedor, sempre um pouco abaixo do limite que exigiria licitação. Um padrão que vale checar."
            to="/anomalias"
            cta="Ver sinais investigativos"
          />
          <FindingCard
            badge="Lacuna · transparência"
            titulo="A informação que deveria existir e não está lá."
            body="Às vezes o achado é o que falta: um documento ausente, um indicador que ninguém publica. A ausência de informação também é um achado."
            to="/lacunas"
            cta="Ver lacunas mapeadas"
          />
        </div>
        <div className="mt-6">
          <ImagePlaceholder
            kind="Screenshot"
            icon={<Flame className="size-8" />}
            titulo="Tela de Sinais investigativos"
            alt="Tela de Sinais investigativos do Mutirão de Dados listando padrões estatísticos detectados, com tipo, severidade e órgão."
            ratio="aspect-[16/7]"
          />
        </div>
      </section>

      {/* 4. O QUE VOCÊ QUER DESCOBRIR — intenção → ação */}
      <section className="mx-auto max-w-7xl px-4 mt-24">
        <SectionHeading
          kicker="Comece por onde te interessa"
          titulo="O que você quer descobrir?"
          descricao="Toda investigação começa por uma pergunta concreta. Escolha a sua — a plataforma te leva à ferramenta certa."
        />
        <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <IntentCard pergunta="Para onde vai o dinheiro do meu órgão?" to="/orgaos" />
          <IntentCard pergunta="Esse contrato é normal?" to="/anomalias" />
          <IntentCard pergunta="Quem recebeu essa emenda?" to="/emendas" />
          <IntentCard pergunta="Quem financiou esse político?" to="/eleicoes" />
          <IntentCard pergunta="O que meus deputados andam gastando?" to="/camara" />
          <IntentCard pergunta="Meu município presta contas?" to="/explorar" />
        </div>
      </section>

      {/* 5. MAPA DA PLATAFORMA — as fontes (amplitude) */}
      <section className="mx-auto max-w-7xl px-4 mt-24">
        <SectionHeading
          kicker="A amplitude"
          titulo="Sete fontes oficiais, num só lugar."
          descricao="Reunimos e padronizamos dados que hoje vivem espalhados por diferentes portais do governo — para que você não precise saber onde cada um mora."
        />
        <div className="mt-8 grid md:grid-cols-2 gap-3">
          <SourceItem
            to="/portal-cgu"
            nome="Portal da Transparência (CGU)"
            revela="Contratos e pagamentos do Executivo Federal."
          />
          <SourceItem
            to="/pncp"
            nome="PNCP"
            revela="Licitações e contratos de União, estados e municípios."
          />
          <SourceItem
            to="/transferegov"
            nome="Transferegov"
            revela="Convênios, emendas parlamentares e repasses da União."
          />
          <SourceItem
            to="/siconfi"
            nome="SICONFI (Tesouro Nacional)"
            revela="Relatórios fiscais (RREO e RGF) de estados e municípios."
          />
          <SourceItem
            to="/camara"
            nome="Câmara dos Deputados"
            revela="Gastos de cota (CEAP), proposições e votações."
          />
          <SourceItem
            to="/senado"
            nome="Senado Federal"
            revela="Gastos de cota (CEAPS), matérias e votações."
          />
          <SourceItem
            to="/tse"
            nome="Tribunal Superior Eleitoral (TSE)"
            revela="Candidatos, bens declarados e contas de campanha."
          />
          <SourceItem
            to="/congresso"
            nome="Congresso Nacional"
            revela="Câmara e Senado lado a lado, para comparar."
          />
        </div>

        <div className="mt-10 grid lg:grid-cols-2 gap-8 items-start">
          <div>
            <h3 className="font-display text-xl">Ou navegue por tipo de dado</h3>
            <div className="mt-4 flex flex-wrap gap-2">
              <TypeChip to="/contratos" label="Contratos" />
              <TypeChip to="/licitacoes" label="Licitações" />
              <TypeChip to="/convenios" label="Convênios" />
              <TypeChip to="/emendas" label="Emendas parlamentares" />
              <TypeChip to="/eleicoes" label="Eleições" />
              <TypeChip to="/relatorios-fiscais" label="Relatórios fiscais" />
            </div>
            <div className="mt-6 flex flex-wrap gap-3 text-sm">
              <Link
                to="/buscar"
                className="inline-flex items-center gap-1.5 font-semibold hover:text-accent"
              >
                Busca unificada <ArrowRight className="size-3.5" />
              </Link>
              <Link
                to="/cobertura"
                className="inline-flex items-center gap-1.5 font-semibold hover:text-accent"
              >
                Cobertura dos dados <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </div>
          <ImagePlaceholder
            kind="Screenshot"
            icon={<LineChart className="size-8" />}
            titulo="Página de um órgão federal"
            alt="Página de um órgão federal no Mutirão de Dados com série histórica de gastos e principais fornecedores."
            ratio="aspect-[16/10]"
          />
        </div>
      </section>

      {/* 6. COMO FUNCIONA — o método */}
      <section className="mx-auto max-w-7xl px-4 mt-24">
        <SectionHeading
          kicker="O método, aberto"
          titulo="Como transformamos dado em achado."
          descricao="Nossas regras são públicas e contestáveis. Não acusamos ninguém — apontamos o que merece um olhar mais atento."
        />
        <div className="mt-8 grid md:grid-cols-3 gap-4">
          <ConceptCard
            icon={<Flame className="size-5" />}
            titulo="Sinais investigativos"
            body="Oito regras estatísticas varrem os dados em busca de padrões incomuns — crescimento abrupto, fracionamento, concentração. Um sinal é um ponto de partida, não um veredito."
            to="/metodologia"
            cta="Ver os critérios"
          />
          <ConceptCard
            icon={<CircleDashed className="size-5" />}
            titulo="Lacunas"
            body="Mapeamos seis tipos de informação que deveria ser pública e não é. A ausência de um dado é registrada como um achado, não esquecida."
            to="/lacunas"
            cta="Ver lacunas"
          />
          <ConceptCard
            icon={<ShieldCheck className="size-5" />}
            titulo="Qualidade dos dados"
            body="Conferimos os dados contra as fontes oficiais e relatamos os próprios erros das APIs do governo. Transparência sobre a matéria-prima que usamos."
            to="/qualidade"
            cta="Ver qualidade"
          />
        </div>
        <div className="mt-6">
          <ImagePlaceholder
            kind="Diagrama"
            icon={<GitBranch className="size-8" />}
            titulo="Como os dados se conectam"
            alt="Diagrama em rede conectando o CNPJ de um fornecedor a um órgão, a uma emenda parlamentar e a um contrato pelas chaves de cruzamento."
            ratio="aspect-[16/7]"
          />
        </div>
      </section>

      {/* 7. APRENDER — trilhas, mapas e leis */}
      <section className="mx-auto max-w-7xl px-4 mt-24">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div className="max-w-xl">
            <span className="inline-block text-xs font-semibold tracking-widest text-accent uppercase">
              Não precisa ser especialista
            </span>
            <h2 className="font-display text-3xl sm:text-4xl mt-4">A gente te ensina a olhar.</h2>
            <p className="text-muted-foreground mt-4 leading-relaxed">
              Fiscalizar se aprende. Reunimos leis, vocabulário e caminhos para você ler dados
              públicos com confiança — do primeiro contrato à emenda mais enrolada.
            </p>
            <ul className="mt-6 space-y-3">
              <LearnRow
                icon={<RouteIcon className="size-5" />}
                to="/trilhas"
                titulo="Trilhas"
                body="O método: como pensar uma investigação, passo a passo."
              />
              <LearnRow
                icon={<MapIcon className="size-5" />}
                to="/mapas"
                titulo="Mapas investigativos"
                body="A técnica: quais dados cruzar e por onde começar."
              />
              <LearnRow
                icon={<BookOpen className="size-5" />}
                to="/aprender"
                titulo="Leis e vocabulário"
                body="LAI, transparência e licitações — seus direitos de fiscalizar."
              />
            </ul>
          </div>
          <ImagePlaceholder
            kind="Screenshot"
            icon={<RouteIcon className="size-8" />}
            titulo="Uma trilha investigativa"
            alt="Uma trilha investigativa do Mutirão de Dados apresentada passo a passo."
            ratio="aspect-[4/3]"
          />
        </div>
      </section>

      {/* 8. PARTICIPAR — caderno + contribuição */}
      <section className="mx-auto max-w-7xl px-4 mt-24">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <ImagePlaceholder
            kind="Screenshot"
            icon={<Bookmark className="size-8" />}
            titulo="Seu caderno de investigação"
            alt="O caderno pessoal de investigação do Mutirão de Dados com itens salvos, contratos anexados e anotações."
            ratio="aspect-[4/3]"
            className="lg:order-2"
          />
          <div className="max-w-xl">
            <span className="inline-block text-xs font-semibold tracking-widest text-accent uppercase">
              Sua investigação
            </span>
            <h2 className="font-display text-3xl sm:text-4xl mt-4">
              Guarde o que encontrar. Publique se quiser.
            </h2>
            <p className="text-muted-foreground mt-4 leading-relaxed">
              Cada pergunta vira uma pasta pessoal no seu caderno — privada por padrão. Salve
              contratos, órgãos e sinais, escreva suas anotações e, quando fizer sentido, publique a
              investigação para outras pessoas continuarem de onde você parou.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/caderno"
                className="inline-flex items-center gap-2 bg-accent text-accent-foreground px-5 py-3 rounded-md font-semibold hover:opacity-90"
              >
                <Bookmark className="size-4" /> Abrir meu caderno
              </Link>
              <Link
                to="/contestar"
                className="inline-flex items-center gap-2 border border-border bg-background px-5 py-3 rounded-md font-semibold hover:bg-muted"
              >
                <MessageSquareWarning className="size-4" /> Contestar uma análise
              </Link>
            </div>
            <Link
              to="/contribuir"
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline underline-offset-4"
            >
              <HeartHandshake className="size-4" /> Como contribuir com o projeto
            </Link>
          </div>
        </div>
      </section>

      {/* 9. MISSÃO E LIMITES — fecho */}
      <section className="mx-auto max-w-7xl px-4 mt-24 mb-24">
        <div className="border border-border rounded-2xl p-8 lg:p-12 bg-muted/30">
          <SectionHeading
            kicker="Nossos limites, ditos em voz alta"
            titulo="O que fazemos — e o que não fazemos."
            descricao="Um observatório cívico só é confiável se for transparente sobre os próprios limites."
          />
          <div className="mt-8 grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="font-display text-lg text-foreground">Fazemos</h3>
              <ul className="mt-3 space-y-2">
                <DoRow ok text="Reunir e contextualizar dados públicos de várias fontes." />
                <DoRow ok text="Apontar padrões incomuns que merecem investigação." />
                <DoRow ok text="Publicar nossos métodos e permitir contestação." />
                <DoRow ok text="Preservar a memória do que foi encontrado — e do que falta." />
              </ul>
            </div>
            <div>
              <h3 className="font-display text-lg text-foreground">Não fazemos</h3>
              <ul className="mt-3 space-y-2">
                <DoRow text="Acusar pessoas ou afirmar que houve crime." />
                <DoRow text="Substituir CGU, TCU e demais órgãos de controle." />
                <DoRow text="Construir rankings nominais de “piores” ou “melhores”." />
                <DoRow text="Tratar um sinal estatístico como conclusão." />
              </ul>
            </div>
          </div>
          <div className="mt-8 flex flex-wrap gap-3 text-sm">
            <Link
              to="/sobre"
              className="inline-flex items-center gap-1.5 font-semibold hover:text-accent"
            >
              Sobre o projeto <ArrowRight className="size-3.5" />
            </Link>
            <Link
              to="/transparencia-institucional"
              className="inline-flex items-center gap-1.5 font-semibold hover:text-accent"
            >
              Transparência institucional <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>
        <p className="mt-10 text-center text-sm font-semibold tracking-widest text-accent uppercase">
          Perguntas · Evidências · Memória
        </p>
      </section>
    </>
  );
}

/* ---------- helpers (stateless, só props) ---------- */

function SectionHeading({
  kicker,
  titulo,
  descricao,
}: {
  kicker: string;
  titulo: string;
  descricao?: string;
}) {
  return (
    <div className="max-w-2xl">
      <span className="inline-block text-xs font-semibold tracking-widest text-accent uppercase">
        {kicker}
      </span>
      <h2 className="font-display text-3xl sm:text-4xl mt-3">{titulo}</h2>
      {descricao && <p className="text-muted-foreground mt-3 leading-relaxed">{descricao}</p>}
    </div>
  );
}

function ImagePlaceholder({
  kind,
  icon,
  titulo,
  alt,
  ratio = "aspect-video",
  className = "",
}: {
  kind: "Diagrama" | "Screenshot";
  icon: ReactNode;
  titulo: string;
  alt: string;
  ratio?: string;
  className?: string;
}) {
  return (
    <figure
      className={`${ratio} ${className} w-full rounded-2xl border border-dashed border-border bg-muted/40 flex flex-col items-center justify-center text-center p-6 overflow-hidden`}
      aria-label={alt}
    >
      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        <ImageIcon className="size-3.5" /> {kind} · a produzir
      </span>
      <div className="mt-4 text-accent/70">{icon}</div>
      <figcaption className="mt-3 font-display text-lg text-foreground/80">{titulo}</figcaption>
      <p className="mt-2 max-w-sm text-xs text-muted-foreground leading-relaxed">{alt}</p>
    </figure>
  );
}

function FindingCard({
  badge,
  titulo,
  body,
  to,
  cta,
}: {
  badge: string;
  titulo: string;
  body: string;
  to: string;
  cta: string;
}) {
  return (
    <Link
      to={to}
      className="group border border-border hover:border-accent rounded-xl p-6 bg-card flex flex-col transition-colors"
    >
      <span className="inline-block self-start text-[11px] font-semibold uppercase tracking-wider text-accent bg-accent/10 rounded px-2 py-1">
        {badge}
      </span>
      <h3 className="font-display text-xl mt-4 leading-snug">{titulo}</h3>
      <p className="text-sm text-muted-foreground mt-3 flex-1 leading-relaxed">{body}</p>
      <span className="text-sm font-semibold text-accent mt-4 inline-flex items-center gap-1 group-hover:underline underline-offset-4">
        {cta} <ArrowRight className="size-3.5" />
      </span>
    </Link>
  );
}

function IntentCard({ pergunta, to }: { pergunta: string; to: string }) {
  const Icon = iconFor(to);
  return (
    <Link
      to={to}
      className="group flex items-start gap-3 border border-border rounded-xl p-5 bg-card hover:border-accent transition-colors"
    >
      <span className="size-9 shrink-0 rounded-md bg-accent/10 text-accent flex items-center justify-center">
        <Icon className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="block font-display text-base leading-snug">{pergunta}</span>
        <span className="text-xs font-semibold text-accent mt-2 inline-flex items-center gap-1 group-hover:underline underline-offset-4">
          Descobrir <ArrowRight className="size-3" />
        </span>
      </span>
    </Link>
  );
}

function SourceItem({ to, nome, revela }: { to: string; nome: string; revela: string }) {
  const Icon = iconFor(to);
  return (
    <Link
      to={to}
      className="group flex items-start gap-4 border border-border rounded-xl p-5 bg-card hover:border-accent transition-colors"
    >
      <span className="size-10 shrink-0 rounded-md bg-accent/10 text-accent flex items-center justify-center">
        <Icon className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="block font-display text-lg leading-snug group-hover:text-accent transition-colors">
          {nome}
        </span>
        <span className="block text-sm text-muted-foreground mt-1 leading-relaxed">{revela}</span>
      </span>
    </Link>
  );
}

function TypeChip({ to, label }: { to: string; label: string }) {
  const Icon = iconFor(to);
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-2 border border-border rounded-full px-4 py-2 text-sm font-medium bg-card hover:border-accent hover:text-accent transition-colors"
    >
      <Icon className="size-4" /> {label}
    </Link>
  );
}

function ConceptCard({
  icon,
  titulo,
  body,
  to,
  cta,
}: {
  icon: ReactNode;
  titulo: string;
  body: string;
  to: string;
  cta: string;
}) {
  return (
    <Link
      to={to}
      className="group border border-border hover:border-accent rounded-xl p-6 bg-card flex flex-col transition-colors"
    >
      <div className="size-10 rounded-md bg-accent/10 text-accent flex items-center justify-center">
        {icon}
      </div>
      <h3 className="font-display text-xl mt-4">{titulo}</h3>
      <p className="text-sm text-muted-foreground mt-3 flex-1 leading-relaxed">{body}</p>
      <span className="text-sm font-semibold text-accent mt-4 inline-flex items-center gap-1 group-hover:underline underline-offset-4">
        {cta} <ArrowRight className="size-3.5" />
      </span>
    </Link>
  );
}

function LearnRow({
  icon,
  to,
  titulo,
  body,
}: {
  icon: ReactNode;
  to: string;
  titulo: string;
  body: string;
}) {
  return (
    <li>
      <Link to={to} className="group flex items-start gap-3">
        <span className="size-9 shrink-0 rounded-md bg-accent/10 text-accent flex items-center justify-center">
          {icon}
        </span>
        <span>
          <span className="font-semibold group-hover:text-accent transition-colors">{titulo}</span>
          <span className="block text-sm text-muted-foreground leading-relaxed">{body}</span>
        </span>
      </Link>
    </li>
  );
}

function DoRow({ text, ok = false }: { text: string; ok?: boolean }) {
  return (
    <li className="flex items-start gap-2.5 text-sm">
      {ok ? (
        <Check className="size-4 shrink-0 mt-0.5 text-accent" />
      ) : (
        <X className="size-4 shrink-0 mt-0.5 text-muted-foreground" />
      )}
      <span className={ok ? "text-foreground/90" : "text-muted-foreground"}>{text}</span>
    </li>
  );
}
