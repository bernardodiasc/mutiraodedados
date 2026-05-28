import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, AlertTriangle, Compass, Search } from "lucide-react";
import { useDataSource } from "@/lib/data-store";
import { fmtBRL } from "@/lib/fmt";
import { ORGAOS_BASE } from "@/lib/data/catalog";
import { iconFor } from "@/lib/nav-groups";

export const Route = createFileRoute("/")({
  component: Home,
  head: () => ({
    meta: [
      { title: "Auditoria Cidadã — Observatório cívico de gastos públicos" },
      { name: "description", content: "Auditoria Cidadã reúne contratos, anomalias e atividade parlamentar federal em um observatório cívico aberto." },
      { property: "og:title", content: "Auditoria Cidadã — Observatório cívico de gastos públicos" },
      { property: "og:description", content: "Contratos federais, anomalias e atividade do Congresso reunidos para o controle social." },
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
              Observatório cívico — dados públicos com contexto
            </span>
            <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl mt-4 leading-[0.95]">
              Compreender o Estado<br/>
              <span className="text-accent">é exercício de cidadania.</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-2xl">
              A Auditoria Cidadã organiza e contextualiza dados públicos para ampliar a compreensão
              sobre gastos, contratos e atividade administrativa do Estado. A plataforma combina
              transparência, análise e visualização de dados com foco em controle social
              responsável e interpretação baseada em contexto.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/orgaos" className="inline-flex items-center gap-2 bg-accent text-accent-foreground px-5 py-3 rounded-md font-semibold hover:opacity-90">
                Explorar órgãos <ArrowRight className="size-4" />
              </Link>
              <Link to="/metodologia" data-flat className="inline-flex items-center gap-2 border border-border bg-background px-5 py-3 rounded-md font-semibold hover:bg-muted">
                Ler a metodologia <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Numbers strip */}
      <section className="mx-auto max-w-7xl px-4 mt-12 grid sm:grid-cols-3 gap-4">
          <StatCard icon={<Compass className="size-5" />} label="Volume contratado na amostra atual" value={totalGasto ? fmtBRL(totalGasto) : "—"} />
        <StatCard icon={<AlertTriangle className="size-5" />} label="Sinais investigativos ativos" value={anomalias.length ? anomalias.length.toString() : "—"} />
        <StatCard icon={<Search className="size-5" />} label="Órgãos federais catalogados" value={ORGAOS_BASE.length.toString()} />
      </section>

      {/* What you can do */}
      <section className="mx-auto max-w-7xl px-4 mt-20">
        <h2 className="font-display text-3xl sm:text-4xl">Quatro caminhos de leitura</h2>
        <div className="mt-8 grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Feature link="/orgaos" title="Explorar" body="Percorra órgãos, fornecedores e contratos. Cada página preserva o vínculo com o documento oficial de origem." linkLabel="Ver órgãos" />
          <Feature link="/anomalias" title="Interpretar sinais" body="Regras estatísticas explicáveis apontam padrões — fracionamento, concentração, crescimento abrupto — sempre com hipótese declarada." linkLabel="Ver sinais" />
          <Feature link="/explorar" title="Explorar por ente" body="Escolha um estado ou município e veja, num só lugar, contratos (PNCP), relatórios fiscais (SICONFI) e transferências da União." linkLabel="Abrir explorador" />
          <Feature link="/aprender" title="Aprender" body="LAI, Lei da Transparência e o vocabulário do controle social — em linguagem analítica, não simplificada." linkLabel="Guia cidadão" />
        </div>
      </section>

      {/* Por onde começar */}
      <section className="mx-auto max-w-7xl px-4 mt-20 mb-16">
        <h2 className="font-display text-3xl sm:text-4xl">Por onde começar</h2>
        <p className="text-muted-foreground mt-2 max-w-2xl">
          Três percursos de leitura. Nenhum substitui o anterior — cada um responde a uma
          curiosidade diferente sobre como o Estado age.
        </p>
        <div className="mt-8 grid md:grid-cols-3 gap-4">
          <Caminho n={1} link="/anomalias" titulo="Comece pelos sinais" body="Abra os indicadores investigativos. Leia a hipótese, examine o contexto e use o checklist para checagem cuidadosa antes de qualquer conclusão." linkLabel="Abrir sinais" />
          <Caminho n={2} link="/orgaos" titulo="Leia um órgão por inteiro" body="Escolha um órgão de interesse. Combine a série histórica, o radar de risco e a sazonalidade — uma leitura informa a outra." linkLabel="Ver órgãos" />
          <Caminho n={3} link="/aprender" titulo="Estude antes de marcar" body="O guia cidadão dá o vocabulário. Marcações cidadãs são públicas e cumulativas — pesam mais quando bem fundamentadas." linkLabel="Guia cidadão" />
        </div>
      </section>
    </>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="border border-border rounded-xl p-5 bg-card">
      <div className="flex items-center gap-2 text-muted-foreground text-sm">{icon}{label}</div>
      <div className="font-display text-3xl mt-2">{value}</div>
    </div>
  );
}

function Feature({ title, body, link, linkLabel }: { title: string; body: string; link: string; linkLabel: string }) {
  const Icon = iconFor(link);
  return (
    <Link
      to={link}
      className="group border border-border hover:border-accent rounded-xl p-6 bg-card flex flex-col transition-colors"
    >
      <div className="size-10 rounded-md bg-accent/10 text-accent flex items-center justify-center"><Icon className="size-5" /></div>
      <h3 className="font-display text-xl mt-4">{title}</h3>
      <p className="text-sm text-muted-foreground mt-2 flex-1">{body}</p>
      <span className="text-sm font-semibold text-accent mt-4 inline-flex items-center gap-1 group-hover:underline underline-offset-4">
        {linkLabel} <ArrowRight className="size-3.5" />
      </span>
    </Link>
  );
}

function Caminho({ n, titulo, body, link, linkLabel }: { n: number; titulo: string; body: string; link: string; linkLabel: string }) {
  const Icon = iconFor(link);
  return (
    <Link
      to={link}
      className="group border border-border hover:border-accent rounded-xl p-6 bg-card flex flex-col relative overflow-hidden transition-colors"
    >
      <span className="absolute top-2 right-4 font-display text-7xl text-accent/10 leading-none select-none">{n}</span>
      <div className="size-10 rounded-md bg-accent/10 text-accent flex items-center justify-center relative"><Icon className="size-5" /></div>
      <h3 className="font-display text-xl mt-4 relative">{titulo}</h3>
      <p className="text-sm text-muted-foreground mt-2 flex-1 relative">{body}</p>
      <span className="text-sm font-semibold text-accent mt-4 inline-flex items-center gap-1 relative group-hover:underline underline-offset-4">
        {linkLabel} <ArrowRight className="size-3.5" />
      </span>
    </Link>
  );
}
