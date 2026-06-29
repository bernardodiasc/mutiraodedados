import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BookOpen,
  HelpCircle,
  AlertTriangle,
  CircleDashed,
  Bookmark,
} from "lucide-react";
import { useDataSource } from "@/lib/data-store";
import { fmtBRL } from "@/lib/fmt";
import { ORGAOS_BASE } from "@/lib/data/catalog";

export const Route = createFileRoute("/")({
  component: Home,
  head: () => ({
    meta: [
      { title: "Auditoria Cidadã — Perguntas, evidências e memória sobre o Estado" },
      { name: "description", content: "Sistema público para formular, organizar e responder perguntas sobre o funcionamento do Estado — com evidências, rastreabilidade e memória." },
      { property: "og:title", content: "Auditoria Cidadã — Perguntas, evidências e memória sobre o Estado" },
      { property: "og:description", content: "Três modos: aprender, perguntar e investigar. Cada cidadão escolhe o seu." },
      { property: "og:url", content: "https://auditoriacidada.ia.br/" },
    ],
    links: [
      { rel: "canonical", href: "https://auditoriacidada.ia.br/" },
    ],
  }),
});

function Home() {
  const ds = useDataSource();
  const anomalias = ds.listAnomalias();
  const orgaos = ds.listOrgaos();
  const totalGasto = orgaos.reduce(
    (sum, o) => sum + ds.contratosOrgao(o.cod).reduce((s, c) => s + c.valor, 0),
    0,
  );

  return (
    <>
      {/* Hero */}
      <section className="border-b border-border bg-gradient-to-br from-background via-background to-muted/40">
        <div className="mx-auto max-w-7xl px-4 py-20 lg:py-28">
          <div className="max-w-3xl">
            <span className="inline-block text-xs font-semibold tracking-widest text-accent uppercase">
              Perguntas · Evidências · Memória
            </span>
            <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl mt-4 leading-[0.95]">
              O que você quer entender<br/>
              <span className="text-accent">sobre o Estado hoje?</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-2xl">
              A Auditoria Cidadã é um sistema público para <strong>formular, organizar e
              responder perguntas</strong> sobre o funcionamento do Estado — com evidências,
              rastreabilidade e memória. Você escolhe seu modo de uso.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/perguntas" className="inline-flex items-center gap-2 bg-accent text-accent-foreground px-5 py-3 rounded-md font-semibold hover:opacity-90">
                Ver perguntas abertas <ArrowRight className="size-4" />
              </Link>
              <Link to="/aprender" data-flat className="inline-flex items-center gap-2 border border-border bg-background px-5 py-3 rounded-md font-semibold hover:bg-muted">
                Só quero entender <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Três modos */}
      <section className="mx-auto max-w-7xl px-4 mt-16">
        <div className="max-w-3xl">
          <h2 className="font-display text-3xl sm:text-4xl">Três modos de uso. Nenhum exige o seguinte.</h2>
          <p className="text-muted-foreground mt-3">
            Aprender, perguntar e investigar são eixos paralelos. Você pode ficar em um
            modo, alternar entre eles, ou usar apenas um durante toda a visita.
          </p>
        </div>
        <div className="mt-8 grid md:grid-cols-3 gap-4">
          <ModoCard
            icon={<BookOpen className="size-5" />}
            kicker="Modo aprender"
            titulo="Quero entender."
            body="Leis, vocabulário, métodos e contexto para ler dados públicos sem precisar ser especialista."
            to="/aprender"
            cta="Começar a aprender"
          />
          <ModoCard
            icon={<HelpCircle className="size-5" />}
            kicker="Modo perguntar"
            titulo="Tenho uma dúvida."
            body="Perguntas abertas, parciais e inconclusivas sobre o funcionamento do Estado. Uma pergunta sem resposta também é um achado."
            to="/perguntas"
            cta="Ver perguntas"
          />
          <ModoCard
            icon={<AlertTriangle className="size-5" />}
            kicker="Modo investigar"
            titulo="Quero apurar."
            body="Sinais estatísticos, transparência institucional, qualidade dos dados e o caderno pessoal de investigação."
            to="/anomalias"
            cta="Ver sinais"
          />
        </div>
      </section>

      {/* Perguntas-âncora */}
      <section className="mx-auto max-w-7xl px-4 mt-20">
        <h2 className="font-display text-3xl sm:text-4xl">Comece por uma pergunta.</h2>
        <p className="text-muted-foreground mt-3 max-w-2xl">
          Quatro perguntas que qualquer cidadão pode fazer ao Estado. Toda investigação
          começa por uma delas.
        </p>
        <ul className="mt-8 grid md:grid-cols-2 gap-3">
          {[
            "Por que esta obra atrasou?",
            "Quem mede os resultados desta política?",
            "Por que os gastos aumentaram?",
            "Este programa está funcionando?",
          ].map((p) => (
            <li key={p}>
              <Link
                to="/perguntas"
                className="group block border border-border rounded-xl p-5 bg-card hover:border-accent transition-colors"
              >
                <div className="flex items-start gap-3">
                  <HelpCircle className="size-5 text-accent shrink-0 mt-0.5" />
                  <div className="font-display text-lg leading-snug">{p}</div>
                </div>
                <span className="text-xs font-semibold text-accent mt-3 inline-flex items-center gap-1 group-hover:underline underline-offset-4">
                  Abrir pergunta <ArrowRight className="size-3" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* O que falta saber */}
      <section className="mx-auto max-w-7xl px-4 mt-20">
        <div className="border border-dashed border-border rounded-2xl p-8 bg-muted/30">
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            <CircleDashed className="size-4" /> O que ainda não é público
          </div>
          <h2 className="font-display text-3xl mt-3 max-w-2xl">
            A ausência de informação também é um achado.
          </h2>
          <p className="text-muted-foreground mt-3 max-w-2xl">
            Mapeamos seis tipos de lacuna no funcionamento público — transparência, avaliação,
            mensuração, documental, institucional e metodológica.
          </p>
          <Link
            to="/lacunas"
            className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-accent hover:underline underline-offset-4"
          >
            Ver lacunas mapeadas <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </section>

      {/* Indicadores contextualizados (rodapé) */}
      <section className="mx-auto max-w-7xl px-4 mt-16 mb-16">
        <h2 className="font-display text-2xl">A plataforma em números</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Indicadores são pontos de partida, nunca conclusões. Cada número aqui pode (e deve)
          virar uma pergunta.
        </p>
        <div className="mt-6 grid sm:grid-cols-3 gap-4">
          <StatCard label="Volume contratado na amostra" value={totalGasto ? fmtBRL(totalGasto) : "—"} />
          <StatCard label="Sinais investigativos ativos" value={anomalias.length ? anomalias.length.toString() : "—"} />
          <StatCard label="Órgãos federais catalogados" value={ORGAOS_BASE.length.toString()} />
        </div>
        <div className="mt-6 flex flex-wrap gap-3 text-sm">
          <Link to="/caderno" className="inline-flex items-center gap-1.5 font-semibold hover:text-accent">
            <Bookmark className="size-4" /> Meu caderno
          </Link>
          <Link to="/metodologia" className="inline-flex items-center gap-1.5 font-semibold hover:text-accent">
            Como interpretamos os sinais <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </section>
    </>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border rounded-xl p-5 bg-card">
      <div className="text-muted-foreground text-sm">{label}</div>
      <div className="font-display text-3xl mt-2">{value}</div>
    </div>
  );
}

function ModoCard({
  icon,
  kicker,
  titulo,
  body,
  to,
  cta,
}: {
  icon: React.ReactNode;
  kicker: string;
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
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mt-4">
        {kicker}
      </div>
      <h3 className="font-display text-2xl mt-1">{titulo}</h3>
      <p className="text-sm text-muted-foreground mt-3 flex-1 leading-relaxed">{body}</p>
      <span className="text-sm font-semibold text-accent mt-4 inline-flex items-center gap-1 group-hover:underline underline-offset-4">
        {cta} <ArrowRight className="size-3.5" />
      </span>
    </Link>
  );
}
