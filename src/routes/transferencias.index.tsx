import { createFileRoute, Link } from "@tanstack/react-router";
import { AvisoMetodologico } from "@/components/AvisoMetodologico";
import { ArrowRightLeft, AlertTriangle, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/transferencias/")({
  component: TransferenciasPage,
  head: () => ({
    meta: [
      { title: "Transferências (repasses) — Auditoria Cidadã" },
      {
        name: "description",
        content:
          "Repasses da União a estados e municípios no nível de Ordem Bancária (endpoint /api-de-dados/transferencias do Portal da Transparência).",
      },
    ],
  }),
});

function TransferenciasPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 space-y-8">
      <header>
        <div className="text-xs text-muted-foreground uppercase tracking-wider">
          Execução · Ordem Bancária
        </div>
        <h1 className="font-display text-4xl mt-1 flex items-center gap-3">
          <ArrowRightLeft className="size-8 text-muted-foreground" /> Transferências
        </h1>
        <p className="text-muted-foreground mt-3 max-w-3xl leading-relaxed">
          A camada de <strong>execução</strong> dos repasses da União a estados e municípios, no
          nível da <strong>Ordem Bancária</strong> — endpoint{" "}
          <code>/api-de-dados/transferencias</code> do Portal da Transparência (CGU). O campo{" "}
          <code>tipoTransferencia</code> distingue convênios, repasses Fundo a Fundo (SUS/SUAS) e as
          transferências diretas da EC 105.
        </p>
      </header>

      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm flex gap-3">
        <AlertTriangle className="size-5 shrink-0 text-amber-500" />
        <div>
          <strong className="text-foreground">Ainda não ingerimos esta fonte.</strong> O endpoint{" "}
          <code>/api-de-dados/transferencias</code> respondeu <strong>HTTP 403</strong> com a chave
          atual (provável falta de permissão de acesso). Por ora esta página é informativa; a
          ingestão fica pendente de liberação da chave.
        </div>
      </div>

      <AvisoMetodologico />

      <section className="space-y-3">
        <h2 className="font-display text-2xl">Onde estão os dados relacionados</h2>
        <ul className="space-y-2 text-sm">
          <li className="rounded-xl border border-border bg-card p-4">
            <strong className="text-foreground">
              Origem (incluindo as "emendas Pix" da EC 105):
            </strong>{" "}
            as transferências diretas — Especiais e com Finalidade Definida — são um{" "}
            <em>tipo de emenda</em>. Veja em{" "}
            <Link to="/emendas" className="text-accent underline">
              Emendas
            </Link>
            , filtrando por tipo (ex.: "Finalidade Definida" ou "Especial").
          </li>
          <li className="rounded-xl border border-border bg-card p-4">
            <strong className="text-foreground">Convênios e contratos de repasse:</strong>{" "}
            <Link to="/convenios" className="text-accent underline">
              Convênios
            </Link>{" "}
            (instrumentos com plano de trabalho e prestação de contas).
          </li>
          <li className="rounded-xl border border-border bg-card p-4">
            <strong className="text-foreground">Saldos contábeis dos entes:</strong>{" "}
            <Link to="/relatorios-fiscais" className="text-accent underline">
              Relatórios fiscais (SICONFI)
            </Link>{" "}
            — para conferir, no nível do ente, os valores recebidos em transferências.
          </li>
          <li className="rounded-xl border border-border bg-card p-4">
            <strong className="text-foreground">Sistema-fonte:</strong>{" "}
            <Link to="/transferegov" className="text-accent underline">
              Transferegov
            </Link>{" "}
            — onde a União opera convênios e as transferências diretas da EC 105.
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-2xl">A "fratura Fundo a Fundo"</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Nos repasses Fundo a Fundo (SUS, SUAS), o recurso vai direto do Fundo Nacional ao
          Municipal,
          <strong> sem convênio</strong>. A rastreabilidade automática se quebra: o Portal mostra a
          Ordem Bancária; o Transferegov retorna nulo (não há convênio); e o PNCP registra o
          contrato municipal sem campo estruturado apontando a origem federal. Reatar a trilha exige
          cruzar SICONFI (saldos contábeis) com a "Fonte de Recurso" na transparência municipal —
          uma lacuna metodológica registrada em{" "}
          <Link to="/lacunas" className="text-accent underline">
            Informação que falta
          </Link>
          .
        </p>
        <a
          href="https://api.portaldatransparencia.gov.br/swagger-ui/index.html"
          target="_blank"
          rel="noreferrer"
          className="text-xs text-accent underline inline-flex items-center gap-1"
        >
          Documentação do endpoint no Swagger da CGU <ExternalLink className="size-3" />
        </a>
      </section>
    </div>
  );
}
