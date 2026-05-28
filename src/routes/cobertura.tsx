import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { coberturaPublica } from "@/lib/data/cobertura-publica.functions";
import { CoberturaResumo, FonteCard } from "@/components/CoberturaSecao";

export const Route = createFileRoute("/cobertura")({
  component: CoberturaPage,
  head: () => ({
    meta: [
      { title: "Cobertura dos dados — Auditoria Cidadã" },
      {
        name: "description",
        content:
          "Quanto a Auditoria Cidadã já baixou de cada fonte pública: período coberto, frescor da última atualização e lacunas por ano e mês.",
      },
      { property: "og:title", content: "Cobertura dos dados — Auditoria Cidadã" },
      {
        property: "og:description",
        content:
          "Prestação de contas sobre os dados armazenados na plataforma: o que cobrimos, até quando, e o que ainda falta.",
      },
    ],
  }),
});

function CoberturaPage() {
  const fetchCobertura = useServerFn(coberturaPublica);
  const { data: cobertura, isLoading } = useQuery({
    queryKey: ["cobertura-publica"],
    queryFn: () => fetchCobertura(),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      <span className="inline-block text-xs font-semibold tracking-widest text-accent uppercase">
        Transparência da plataforma
      </span>
      <h1 className="font-display text-5xl leading-[0.95] mt-2">Cobertura dos dados</h1>
      <p className="mt-6 text-lg text-muted-foreground max-w-3xl">
        Aqui mostramos honestamente o quanto cada fonte pública já está armazenada na Auditoria Cidadã,
        o período coberto e quando foi a última atualização. Lacunas e fontes defasadas são o ponto —
        não escondemos.
      </p>

      <div className="mt-6 border border-border rounded-xl bg-card p-5 text-sm text-muted-foreground max-w-3xl">
        <strong className="text-foreground">Como ler esta página</strong>
        <ul className="mt-2 space-y-1 list-disc list-inside">
          <li>
            <strong className="text-foreground">Frescor</strong>: verde até 30 dias, âmbar até 90 dias, vermelho acima
            de 90 dias desde a última gravação.
          </li>
          <li>
            <strong className="text-foreground">Período coberto</strong>: do mês mais antigo ao mais recente com pelo
            menos um registro.
          </li>
          <li>
            <strong className="text-foreground">Heatmap ano × mês</strong>: intensidade proporcional ao volume de
            registros naquele mês. Células tracejadas indicam ausência de dados.
          </li>
          <li>
            Diferente da{" "}
            <Link to="/transparencia-institucional" className="text-accent underline">
              transparência institucional
            </Link>
            , esta página avalia a <em>plataforma</em>, não cada órgão.
          </li>
        </ul>
      </div>

      <div className="mt-4 border border-border rounded-xl bg-card p-5 text-sm max-w-3xl">
        <strong className="text-foreground">Qualidade ≠ cobertura.</strong>{" "}
        <span className="text-muted-foreground">
          Esta página mostra <em>quanto</em> baixamos. Para ver os{" "}
          <em>defeitos</em> detectados nos dados ingeridos (e o que já foi
          reportado às fontes oficiais), veja{" "}
        </span>
        <Link to="/qualidade" className="text-accent underline">
          /qualidade
        </Link>
        <span className="text-muted-foreground">.</span>
      </div>

      {isLoading || !cobertura ? (
        <div className="mt-10 text-sm text-muted-foreground">Carregando cobertura…</div>
      ) : (
        <>
          <div className="mt-8">
            <CoberturaResumo cobertura={cobertura} />
          </div>
          <div className="mt-6 grid gap-3">
            {cobertura.fontes.map((f) => (
              <FonteCard key={f.id} fonte={f} anoCorrente={cobertura.anoCorrente} variant="full" />
            ))}
          </div>
          <p className="mt-6 text-[11px] text-muted-foreground">
            Snapshot gerado em {new Date(cobertura.geradoEm).toLocaleString("pt-BR")}.
          </p>
        </>
      )}
    </div>
  );
}