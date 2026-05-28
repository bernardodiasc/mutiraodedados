import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import * as React from "react";
import { CheckCircle2, Circle, Loader2, Sparkles, ListChecks } from "lucide-react";
import { listarRoadmapPublico, type RoadmapItem, type RoadmapStatus } from "@/lib/data/roadmap.functions";

export const Route = createFileRoute("/roadmap")({
  component: RoadmapPage,
  head: () => ({
    meta: [
      { title: "Roadmap & novidades — Auditoria Cidadã" },
      { name: "description", content: "O que já está no ar, o que está em construção e o que vem a seguir na Auditoria Cidadã. Inclui notas de versão por entrega." },
      { property: "og:title", content: "Roadmap & novidades — Auditoria Cidadã" },
      { property: "og:description", content: "Histórico de entregas e prioridades em construção, com notas de cada lançamento." },
      { property: "og:url", content: "https://auditoriacidada.ia.br/roadmap" },
    ],
    links: [{ rel: "canonical", href: "https://auditoriacidada.ia.br/roadmap" }],
  }),
});

type Aba = "tudo" | "concluido" | "em_andamento" | "planejado";

const STATUS_LABEL: Record<RoadmapStatus, string> = {
  planejado: "Planejado",
  em_andamento: "Em construção",
  concluido: "Concluído",
};

function RoadmapPage() {
  const fetch = useServerFn(listarRoadmapPublico);
  const { data = [], isLoading } = useQuery({
    queryKey: ["roadmap-publico"],
    queryFn: () => fetch(),
  });
  const [aba, setAba] = React.useState<Aba>("tudo");

  const concluidos = [...data]
    .filter((i) => i.status === "concluido")
    .sort((a, b) => (b.concluido_em ?? "").localeCompare(a.concluido_em ?? ""));
  const emAndamento = data.filter((i) => i.status === "em_andamento");
  const planejados = data.filter((i) => i.status === "planejado");

  const visiveis: RoadmapItem[] =
    aba === "concluido" ? concluidos :
    aba === "em_andamento" ? emAndamento :
    aba === "planejado" ? planejados :
    [...emAndamento, ...planejados, ...concluidos];

  return (
    <article className="mx-auto max-w-4xl px-4 py-12">
      <span className="inline-flex items-center gap-2 text-xs font-semibold tracking-widest text-accent uppercase">
        <ListChecks className="size-3.5" /> Roadmap público
      </span>
      <h1 className="font-display text-5xl leading-[0.95] mt-2">O que estamos construindo</h1>
      <p className="mt-4 text-lg text-muted-foreground">
        Estado real da plataforma: o que já está no ar, o que está em construção e o
        que vem a seguir. A aba{" "}
        <button data-flat className="text-accent underline" onClick={() => setAba("concluido")}>
          Concluídos
        </button>{" "}
        também funciona como histórico de entregas — com a data real de cada lançamento.
      </p>

      <nav className="mt-8 inline-flex flex-wrap rounded-lg border border-border bg-card/50 p-1 text-xs">
        {([
          ["tudo", "Tudo", data.length],
          ["em_andamento", "Em construção", emAndamento.length],
          ["planejado", "Planejado", planejados.length],
          ["concluido", "Concluídos", concluidos.length],
        ] as const).map(([k, l, qtd]) => (
          <button
            data-flat
            key={k}
            onClick={() => setAba(k)}
            className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
              aba === k ? "bg-accent/15 text-accent" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {l}
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
              aba === k ? "bg-accent/20 text-accent" : "bg-muted text-muted-foreground"
            }`}>
              {qtd}
            </span>
          </button>
        ))}
      </nav>

      <section className="mt-6">
        {isLoading ? (
          <div className="text-sm text-muted-foreground flex items-center gap-2 py-10">
            <Loader2 className="size-4 animate-spin" /> Carregando…
          </div>
        ) : visiveis.length === 0 ? (
          <p className="text-sm text-muted-foreground py-10">Nenhum item nesta visão.</p>
        ) : aba === "concluido" ? (
          <ReleaseNotes itens={concluidos} />
        ) : (
          <ul className="space-y-3">
            {visiveis.map((it) => <ItemCard key={it.id} item={it} />)}
          </ul>
        )}
      </section>

      <p className="mt-10 text-xs text-muted-foreground">
        Tem sugestão, crítica ou achou um erro?{" "}
        <Link to="/contestar" className="text-accent underline">Conte para nós</Link>.
      </p>
    </article>
  );
}


function ItemCard({ item }: { item: RoadmapItem }) {
  const Icon = item.status === "concluido" ? CheckCircle2 : item.status === "em_andamento" ? Sparkles : Circle;
  const iconCls =
    item.status === "concluido" ? "text-emerald-600 dark:text-emerald-400" :
    item.status === "em_andamento" ? "text-accent" : "text-muted-foreground";
  return (
    <li className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start gap-3">
        <Icon className={`size-5 mt-0.5 shrink-0 ${iconCls}`} />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium">{item.titulo}</h3>
            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              {STATUS_LABEL[item.status]}
            </span>
            {item.concluido_em && (
              <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                {formatarData(item.concluido_em)}
              </span>
            )}
          </div>
          {item.descricao && (
            <p className="text-sm text-muted-foreground mt-2">
              <RenderMarkdownLinks text={item.descricao} />
            </p>
          )}
        </div>
      </div>
    </li>
  );
}

function RenderMarkdownLinks({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  const regex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const [, label, href] = match;
    const key = `${match.index}-${label}`;
    parts.push(
      <Link key={key} to={href} className="text-accent underline">
        {label}
      </Link>
    );
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return <>{parts}</>;
}

function ReleaseNotes({ itens }: { itens: RoadmapItem[] }) {
  const grupos = new Map<string, RoadmapItem[]>();
  for (const it of itens) {
    const k = (it.concluido_em ?? "sem-data").slice(0, 7);
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k)!.push(it);
  }
  return (
    <div className="space-y-8">
      {Array.from(grupos.entries()).map(([mes, lista]) => (
        <div key={mes}>
          <h2 className="font-display text-lg text-foreground border-b border-border pb-2 mb-3">
            {mes === "sem-data" ? "Sem data registrada" : formatarMes(mes)}
          </h2>
          <ul className="space-y-3">
            {lista.map((it) => <ItemCard key={it.id} item={it} />)}
          </ul>
        </div>
      ))}
    </div>
  );
}

function formatarData(iso: string) {
  try {
    const [a, m, d] = iso.split("-");
    return `${d}/${m}/${a}`;
  } catch { return iso; }
}
function formatarMes(ym: string) {
  const [a, m] = ym.split("-");
  const meses = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  return `${meses[Number(m) - 1] ?? m} de ${a}`;
}