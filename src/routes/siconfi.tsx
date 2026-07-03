import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { coberturaPublica } from "@/lib/data/cobertura-publica.functions";
import { iconFor } from "@/lib/nav-groups";
import { ExternalLink } from "lucide-react";

export const Route = createFileRoute("/siconfi")({
  component: SICONFIPage,
  head: () => ({
    meta: [
      { title: "SICONFI (Tesouro Nacional) — Auditoria Cidadã" },
      {
        name: "description",
        content:
          "O que o SICONFI cobre na Auditoria Cidadã: relatórios fiscais (RREO, RGF, DCA) padronizados de todos os entes federados, e como ela se conecta às demais fontes.",
      },
    ],
  }),
});

function SICONFIPage() {
  const fetchCob = useServerFn(coberturaPublica);
  const { data } = useQuery({ queryKey: ["cobertura-publica"], queryFn: () => fetchCob() });
  const total =
    (data?.fontes ?? []).find((f) => f.id === "siconfi")?.totalRegistros ?? null;
  const Icon = iconFor("/relatorios-fiscais");

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 space-y-8">
      <header>
        <div className="text-xs text-muted-foreground uppercase tracking-wider">
          Por fonte de dados
        </div>
        <h1 className="font-display text-4xl mt-1">SICONFI (Tesouro Nacional)</h1>
        <p className="text-muted-foreground mt-3 max-w-3xl leading-relaxed">
          Sistema de Informações Contábeis e Fiscais do Setor Público Brasileiro, mantido pela
          Secretaria do Tesouro Nacional (STN). Nasceu para operacionalizar a Lei de Responsabilidade
          Fiscal (LC 101/2000): padroniza e consolida os relatórios fiscais (RREO, RGF e DCA) dos{" "}
          <strong>~5.598 entes</strong> federados — União, 26 estados, DF e os municípios — sob a
          mesma metodologia contábil.{" "}
          <a
            href="https://apidatalake.tesouro.gov.br/docs/siconfi/"
            target="_blank"
            rel="noreferrer"
            className="text-accent underline"
          >
            apidatalake.tesouro.gov.br <ExternalLink className="inline size-3" />
          </a>
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        <Link
          to="/relatorios-fiscais"
          className="rounded-2xl border border-border bg-card p-5 hover:border-accent transition-colors"
        >
          <div className="flex items-center gap-2 font-medium">
            <Icon className="size-4 text-muted-foreground" /> Relatórios fiscais
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            RREO (bimestral), RGF (quadrimestral/semestral) e DCA (anual) por ente, exercício e
            período. Abre a listagem com filtros e exportação CSV.
          </p>
          <div className="text-xs text-muted-foreground mt-3">
            {total != null ? `${total.toLocaleString("pt-BR")} registros em cache` : "—"}
          </div>
        </Link>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-2xl">Como o SICONFI se conecta</h2>

        <div className="rounded-2xl border border-border bg-card p-5 space-y-2">
          <h3 className="font-medium">SICONFI × Portal da Transparência (CGU)</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Os dois medem coisas <strong>diferentes</strong>. O SICONFI é a visão contábil{" "}
            <strong>consolidada</strong> — empenhado e liquidado, com a mesma metodologia para todos
            os entes. O{" "}
            <Link to="/portal-cgu" className="text-accent underline">
              Portal CGU
            </Link>{" "}
            é a execução de <strong>pagamentos</strong>, contrato a contrato. Use o SICONFI para{" "}
            <strong>comparar entes</strong>; use o Portal para <strong>rastrear contratos</strong>.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 space-y-2">
          <h3 className="font-medium">Reatar a "fratura Fundo a Fundo"</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Nos repasses Fundo a Fundo (SUS/SUAS, sem convênio) a trilha automática entre as APIs
            federais se quebra. O saldo contábil que o município declara no SICONFI (RREO){" "}
            <strong>deve bater</strong> com o somatório de Ordens Bancárias do endpoint{" "}
            <Link to="/transferencias" className="text-accent underline">
              /transferencias
            </Link>{" "}
            do Portal. O SICONFI valida o macro — confronte com o que falta em{" "}
            <Link to="/lacunas" className="text-accent underline">
              /lacunas
            </Link>
            .
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 space-y-2">
          <h3 className="font-medium">Granularidade</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            O SICONFI <strong>não</strong> traz contratos ou licitações individuais — é uma visão{" "}
            <strong>agregada</strong> por ente, exercício e período. Para o detalhe contrato a
            contrato, vá ao{" "}
            <Link to="/portal-cgu" className="text-accent underline">
              Portal CGU
            </Link>{" "}
            ou ao{" "}
            <Link to="/pncp" className="text-accent underline">
              PNCP
            </Link>
            .
          </p>
        </div>
      </section>

      <p className="text-[11px] text-muted-foreground border-t border-border pt-4">
        Cobertura por período em{" "}
        <Link to="/cobertura" className="text-accent underline">
          /cobertura
        </Link>
        . Detalhes em <code>docs/conceitos/siconfi-e-relatorios-fiscais.md</code>,{" "}
        <code>docs/fontes/siconfi.md</code> e <code>docs/dominios/financas-publicas.md</code>.
      </p>
    </div>
  );
}
