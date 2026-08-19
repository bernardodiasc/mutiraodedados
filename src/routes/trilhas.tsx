import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Route as RouteIcon,
  Lightbulb,
  Map,
  FileText,
  Building2,
  HelpCircle,
  Landmark,
  HandCoins,
  CircleDashed,
  PieChart,
  ShieldCheck,
  Bookmark,
  type LucideIcon,
} from "lucide-react";

export const Route = createFileRoute("/trilhas")({
  component: TrilhasPage,
  head: () => ({
    meta: [
      { title: "Trilhas — Mutirão de Dados" },
      {
        name: "description",
        content:
          "Rotas de aprendizado metodológico para investigar o Estado: como pensar, o que observar e quais perguntas registrar. O método antes da ferramenta.",
      },
      { property: "og:title", content: "Trilhas — Mutirão de Dados" },
      {
        property: "og:description",
        content:
          "Trilhas ensinam o mindset do auditor cidadão em 3 passos. Para o manual técnico de cliques e cruzamentos, veja os Mapas Investigativos.",
      },
      { property: "og:url", content: "https://mutiraodedados.com.br/trilhas" },
    ],
    links: [{ rel: "canonical", href: "https://mutiraodedados.com.br/trilhas" }],
  }),
});

type Passo = {
  titulo: string;
  descricao: string;
  to?: string;
  href?: string;
  /** Passo 1 de cada trilha: aponta sutilmente para o manual técnico (Mapas). */
  verMapas?: boolean;
};
type Trilha = { id: string; titulo: string; intro: string; dica: string; passos: Passo[] };

// Nome curto + ícone de cada página de destino, para os botões "Abrir <Página>".
const DESTINOS: Record<string, { nome: string; Icon: LucideIcon }> = {
  "/pncp": { nome: "PNCP", Icon: FileText },
  "/orgaos": { nome: "Órgãos", Icon: Building2 },
  "/perguntas": { nome: "Perguntas", Icon: HelpCircle },
  "/congresso": { nome: "Congresso", Icon: Landmark },
  "/transferencias": { nome: "Transferências", Icon: HandCoins },
  "/lacunas": { nome: "Lacunas", Icon: CircleDashed },
  "/siconfi": { nome: "SICONFI", Icon: PieChart },
  "/qualidade": { nome: "Qualidade", Icon: ShieldCheck },
  "/caderno": { nome: "Caderno", Icon: Bookmark },
};

const TRILHAS: Trilha[] = [
  {
    id: "primeiro-contrato",
    titulo: "Como ler um contrato público pela primeira vez",
    intro:
      "Esta trilha não é sobre achar o botão certo — é sobre treinar o olhar. Você vai aprender a distinguir o que é cláusula, o que é metadado e o que é a fonte original, e a desconfiar na medida certa.",
    dica: "Mentalidade: todo contrato conta uma história. Seu papel não é provar que houve crime — é perguntar se cada número faz sentido. Estranhar é o ponto de partida.",
    passos: [
      {
        titulo: "1. Observe antes de concluir",
        descricao:
          "Abra um contrato e apenas leia: objeto, valor, fornecedor, datas. Ainda não julgue. Pergunte-se: isto é compatível com aquilo que o órgão faz? O primeiro passo é olhar com calma, não acusar.",
        to: "/pncp",
        verMapas: true,
      },
      {
        titulo: "2. Situe no contexto",
        descricao:
          "Quem contratou e por quê? Compare o objeto do contrato com a missão declarada do órgão. A incoerência entre o que foi comprado e a finalidade pública é o primeiro sinal que vale anotar.",
        to: "/orgaos",
      },
      {
        titulo: "3. Registre a pergunta, não a resposta",
        descricao:
          "Salve o contrato no caderno e escreva a dúvida que ele provocou — mesmo sem resposta. Investigação madura nasce de boas perguntas; a resposta vem depois, no seu tempo.",
        to: "/perguntas",
      },
    ],
  },
  {
    id: "emendas-rastreio",
    titulo: "Como rastrear uma emenda parlamentar",
    intro:
      "Da promessa ao dinheiro na conta. Aqui você treina a seguir o rastro: aprender a ver onde o discurso vira execução — ou onde ele simplesmente desaparece.",
    dica: "Mentalidade: “foi anunciado” não é “foi pago”. O auditor segue o dinheiro até o fim e anota cada elo que some no caminho.",
    passos: [
      {
        titulo: "1. Comece pela origem, com calma",
        descricao:
          "Identifique quem propôs a emenda e os valores em cada etapa: empenhado, liquidado, pago. Repare nas diferenças entre eles — cada salto inesperado merece uma pergunta sua.",
        to: "/congresso",
        verMapas: true,
      },
      {
        titulo: "2. Entenda o instrumento",
        descricao:
          "Convênio? Transferência especial? Cada modalidade revela um conjunto diferente de dados e de responsáveis. Saber qual é muda o que você deve procurar a seguir.",
        to: "/transferencias",
      },
      {
        titulo: "3. Guarde o rastro no caderno",
        descricao:
          "Rastrear emenda é trabalho de fôlego, raramente resolvido numa sentada só. Salve no caderno cada elo que você seguiu e a pergunta que ficou em aberto — assim você retoma o fio da meada na próxima sessão sem recomeçar do zero.",
        to: "/caderno",
      },
    ],
  },
  {
    id: "transparencia-municipio",
    titulo: "Como avaliar a transparência de um município",
    intro:
      "Transparência se mede pelo que está disponível — e também pelo que deveria estar e não está. Nesta trilha você aprende a ler os silêncios de um ente público.",
    dica: "Mentalidade: ausência é informação. Um relatório que não foi enviado fala tanto quanto um número errado.",
    passos: [
      {
        titulo: "1. Comece pelos relatórios fiscais",
        descricao:
          "Veja se o município envia seus relatórios (RREO e RGF) ao SICONFI. A pergunta não é só “o que eles dizem?”, mas “eles estão sendo enviados?”. A regularidade já conta uma história.",
        to: "/siconfi",
        verMapas: true,
      },
      {
        titulo: "2. Desconfie dos padrões",
        descricao:
          "Olhe a qualidade dos dados. Falhas que se repetem não são acaso: apontam problemas estruturais. Aprenda a separar o erro pontual do sintoma recorrente.",
        to: "/qualidade",
      },
      {
        titulo: "3. Nomeie o que falta",
        descricao:
          "Relatório que não veio, dado que deveria existir e não existe: registre como lacuna. Tornar a ausência explícita e rastreável é o que transforma um “faltou” solto em pauta concreta de cobrança.",
        to: "/lacunas",
      },
    ],
  },
];

function TrilhasPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <header className="max-w-3xl">
        <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-accent">
          <RouteIcon className="size-4" /> Rotas de aprendizado
        </div>
        <h1 className="font-display text-4xl sm:text-5xl mt-3 leading-tight">
          Trilhas: aprenda a pensar como um auditor.
        </h1>
        <p className="text-muted-foreground mt-4 text-lg">
          As Trilhas são <strong>rotas de aprendizado metodológico</strong> — não um catálogo de
          ferramentas. Aqui você desenvolve o olhar do fiscalizador: o que observar, quais perguntas
          fazer e como transformar uma desconfiança em investigação. São 3 passos por trilha, sem
          ordem obrigatória — escolha a que mais se aproxima da sua pergunta.
        </p>
        <div className="mt-5 flex items-start gap-3 rounded-lg border border-accent/30 bg-accent/5 p-4 text-sm">
          <Map className="size-4 mt-0.5 shrink-0 text-accent" />
          <p className="text-muted-foreground">
            Quer o <strong>manual técnico</strong> — onde clicar, quais campos cruzar, quais fontes
            abrir? Isso fica nos{" "}
            <Link to="/mapas" className="font-semibold text-accent hover:underline">
              Mapas Investigativos
            </Link>
            . As Trilhas cuidam do <em>método</em>; os Mapas, da <em>execução</em>.
          </p>
        </div>
      </header>

      <div className="mt-10 space-y-6">
        {TRILHAS.map((t) => (
          <article key={t.id} className="border border-border rounded-xl p-6 bg-card">
            <h2 className="font-display text-2xl">{t.titulo}</h2>
            <p className="text-sm text-muted-foreground mt-2">{t.intro}</p>

            <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
              <Lightbulb className="size-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
              <p className="text-muted-foreground">{t.dica}</p>
            </div>

            <ol className="mt-5 space-y-3">
              {t.passos.map((p) => {
                const destino = p.to ? DESTINOS[p.to] : undefined;
                const Icon = destino?.Icon;
                return (
                  <li key={p.titulo} className="border-l-2 border-accent pl-4">
                    <div className="font-semibold">{p.titulo}</div>
                    <p className="text-sm text-muted-foreground mt-1">{p.descricao}</p>
                    {p.verMapas ? (
                      <Link
                        to="/mapas"
                        className="inline-flex items-center gap-1 mt-2 text-xs text-muted-foreground hover:text-accent"
                      >
                        <Map className="size-3" /> Prefere o passo a passo técnico (cliques e
                        campos)? Veja os Mapas Investigativos
                      </Link>
                    ) : null}
                    {p.to ? (
                      <div>
                        <Link
                          to={p.to}
                          className="inline-flex items-center gap-1.5 mt-2 text-xs font-semibold hover:text-accent"
                        >
                          {Icon ? <Icon className="size-3.5" /> : null}
                          Abrir {destino?.nome ?? "página"}
                        </Link>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </article>
        ))}
      </div>
    </div>
  );
}
