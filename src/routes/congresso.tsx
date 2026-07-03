import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { camaraOverview } from "@/lib/data/camara/queries.functions";
import { senadoOverview } from "@/lib/data/senado/queries.functions";
import { AvisoMetodologico } from "@/components/AvisoMetodologico";
import { fmtBRL } from "@/lib/fmt";
import { Users, Receipt, Building2 } from "lucide-react";

export const Route = createFileRoute("/congresso")({
  component: CongressoHub,
  head: () => ({
    meta: [
      { title: "Congresso Nacional — Auditoria Cidadã" },
      {
        name: "description",
        content:
          "Comparativo Câmara × Senado: parlamentares, despesas reembolsadas e atividade legislativa do Congresso Nacional.",
      },
      { property: "og:title", content: "Congresso Nacional — Auditoria Cidadã" },
      {
        property: "og:description",
        content:
          "Câmara dos Deputados e Senado Federal lado a lado, com dados abertos de gastos e atividade.",
      },
    ],
  }),
});

function CongressoHub() {
  const camFn = useServerFn(camaraOverview);
  const senFn = useServerFn(senadoOverview);
  const { data: cam } = useQuery({ queryKey: ["camara", "overview"], queryFn: () => camFn() });
  const { data: sen } = useQuery({ queryKey: ["senado", "overview"], queryFn: () => senFn() });

  const totalParlamentares = (cam?.atuais ?? 0) + (sen?.atuais ?? 0);
  const totalHistoricos = (cam?.historicos ?? 0) + (sen?.historicos ?? 0);
  const totalGasto = (cam?.totalGasto ?? 0) + (sen?.totalGasto ?? 0);
  const totalNotas = (cam?.totalDespesas ?? 0) + (sen?.totalDespesas ?? 0);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 space-y-10">
      <header>
        <div className="text-xs text-muted-foreground uppercase tracking-wider">Poder Legislativo</div>
        <h1 className="font-display text-5xl mt-1">Congresso Nacional</h1>
        <p className="text-muted-foreground mt-3 max-w-3xl leading-relaxed">
          O Congresso Nacional é bicameral: 513 deputados na <strong>Câmara</strong> (eleitos
          por estado, proporcional à população) e 81 senadores no <strong>Senado</strong>
          {" "}(três por estado, representação federativa). Aqui mostramos as duas casas lado
          a lado, conectando dados abertos publicados por cada uma.
        </p>
      </header>

      <AvisoMetodologico />

      <section className="grid gap-4 sm:grid-cols-3">
        <Stat
          icon={<Users className="size-4" />}
          label="Parlamentares (legislatura atual)"
          value={totalParlamentares.toLocaleString("pt-BR")}
          sub={totalHistoricos > 0 ? `+ ${totalHistoricos.toLocaleString("pt-BR")} no histórico de legislaturas passadas` : "513 dep. + 81 sen."}
        />
        <Stat icon={<Building2 className="size-4" />} label="Total reembolsado (CEAP+CEAPS)" value={fmtBRL(totalGasto)} />
        <Stat icon={<Receipt className="size-4" />} label="Notas fiscais em cache" value={totalNotas.toLocaleString("pt-BR")} />
      </section>

      <section>
        <h2 className="font-display text-2xl">As duas casas</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <CasaCard
            to="/camara"
            casa="Câmara dos Deputados"
            tagline="Representação proporcional do povo"
            parlamentares={cam?.atuais ?? 0}
            historicos={cam?.historicos ?? 0}
            parlLabel="deputados"
            gasto={cam?.totalGasto ?? 0}
            notas={cam?.totalDespesas ?? 0}
            periodo={cam?.periodoInicio && cam.periodoFim ? `${cam.periodoInicio} → ${cam.periodoFim}` : null}
            cota="CEAP"
          />
          <CasaCard
            to="/senado"
            casa="Senado Federal"
            tagline="Representação federativa dos estados"
            parlamentares={sen?.atuais ?? 0}
            historicos={sen?.historicos ?? 0}
            parlLabel="senadores"
            gasto={sen?.totalGasto ?? 0}
            notas={sen?.totalDespesas ?? 0}
            periodo={sen?.periodoInicio && sen.periodoFim ? `${sen.periodoInicio} → ${sen.periodoFim}` : null}
            cota="CEAPS"
          />
        </div>
      </section>

      <section>
        <h2 className="font-display text-2xl">Atalhos por vertical</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Vertical title="Parlamentares" cam="/camara/deputados" sen="/senado/senadores"
            desc="Cadastro completo, ranking de gastos e perfil individual." />
          <Vertical title="Matérias e proposições" cam="/camara/proposicoes" sen="/senado/materias"
            desc="PLs, PECs, MPVs com ementa, autoria e tramitação." />
          <Vertical title="Votações nominais" cam="/camara/votacoes" sen="/senado/votacoes"
            desc="Resultados, disciplina partidária e voto individual." />
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="font-display text-xl">Como comparar com responsabilidade</h2>
        <ul className="text-sm text-muted-foreground mt-3 space-y-2 list-disc pl-5 leading-relaxed">
          <li>
            <strong>CEAP × CEAPS não são equivalentes</strong>: cotas têm regras e tetos
            diferentes; comparações absolutas exigem normalização (per capita, mês, UF).
          </li>
          <li>
            <strong>513 ≠ 81</strong>: a Câmara é seis vezes maior. Compare por
            parlamentar e proporcionalmente ao papel constitucional de cada casa.
          </li>
          <li>
            <strong>Mandato distinto</strong>: senadores têm 8 anos, deputados 4 — séries
            temporais cobrem janelas diferentes.
          </li>
        </ul>
      </section>
    </div>
  );
}

function Stat({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
        {icon} {label}
      </div>
      <div className="font-display text-2xl mt-2 leading-none">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

function CasaCard({
  to, casa, tagline, parlamentares, historicos, parlLabel, gasto, notas, periodo, cota,
}: {
  to: "/camara" | "/senado"; casa: string; tagline: string;
  parlamentares: number; historicos: number; parlLabel: string; gasto: number; notas: number;
  periodo: string | null; cota: string;
}) {
  return (
    <Link to={to} className="block rounded-xl border border-border bg-card p-6 hover:border-accent transition-colors">
      <div className="font-display text-2xl">{casa}</div>
      <div className="text-xs text-muted-foreground mt-1">{tagline}</div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground uppercase tracking-wider">{parlLabel} (atuais)</dt>
          <dd className="font-mono">
            {parlamentares}
            {historicos > 0 && (
              <span className="text-xs text-muted-foreground"> · +{historicos} no histórico</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground uppercase tracking-wider">{cota} total</dt>
          <dd className="font-mono">{fmtBRL(gasto)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground uppercase tracking-wider">notas</dt>
          <dd className="font-mono">{notas.toLocaleString("pt-BR")}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground uppercase tracking-wider">período</dt>
          <dd className="font-mono text-xs">{periodo ?? "—"}</dd>
        </div>
      </dl>
    </Link>
  );
}

function Vertical({ title, desc, cam, sen }: { title: string; desc: string; cam: string; sen: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="font-display text-lg">{title}</div>
      <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{desc}</p>
      <div className="mt-3 flex gap-2 text-xs">
        <Link to={cam} className="rounded-md border border-border px-2.5 py-1 hover:border-accent hover:text-accent">
          Câmara →
        </Link>
        <Link to={sen} className="rounded-md border border-border px-2.5 py-1 hover:border-accent hover:text-accent">
          Senado →
        </Link>
      </div>
    </div>
  );
}