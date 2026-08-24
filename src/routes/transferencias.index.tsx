import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRightLeft, ExternalLink } from "lucide-react";
import { BlocoLacuna } from "@/components/BlocoLacuna";
import { PainelExplicar } from "@/components/PainelExplicar";

export const Route = createFileRoute("/transferencias/")({
  component: TransferenciasPage,
  head: () => ({
    meta: [
      { title: "Transferências (repasses) — Mutirão de Dados" },
      {
        name: "description",
        content:
          "Repasses da União a estados e municípios, pagamento a pagamento — fonte em preparação no Mutirão de Dados.",
      },
    ],
  }),
});

function TransferenciasPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 space-y-8">
      <header>
        <div className="text-xs text-muted-foreground uppercase tracking-wider">
          Execução · Pagamento a pagamento
        </div>
        <h1 className="font-display text-4xl mt-1 flex items-center gap-3">
          <ArrowRightLeft className="size-8 text-muted-foreground" /> Transferências
        </h1>
        <p className="text-muted-foreground mt-3 max-w-3xl leading-relaxed">
          O dinheiro que a União repassa a estados e municípios, no nível de cada pagamento
          efetivado. É a camada de <strong>execução</strong> dos repasses: quando esta fonte estiver
          no acervo, será possível acompanhar convênios, repasses do SUS e do SUAS e as
          transferências diretas de emendas, pagamento a pagamento.
        </p>
      </header>

      <BlocoLacuna
        tipo="Transparência"
        titulo="Ainda não temos esses dados no acervo"
        descricao="Estamos preparando o acesso a esta fonte no Portal da Transparência (CGU) — os dados dependem de uma liberação que ainda não saiu. Enquanto isso, os caminhos abaixo cobrem partes do mesmo dinheiro por outros ângulos."
      />

      <PainelExplicar titulo="O que é uma Ordem Bancária? E por que ela importa?">
        <p>
          Cada repasse efetivado vira uma <strong>Ordem Bancária</strong> — o registro do pagamento
          em si, com data, valor e favorecido. É o nível mais fino de acompanhamento: um convênio
          pode ter dezenas de pagamentos ao longo dos anos, e é aqui que eles aparecem um a um.
        </p>
        <p>
          A mesma fonte distingue o tipo de repasse: convênio, repasse Fundo a Fundo (SUS/SUAS) ou
          transferência direta de emenda (as "emendas Pix"). É essa classificação que permite seguir
          cada caminho do dinheiro separadamente.
        </p>
        <a
          href="https://api.portaldatransparencia.gov.br/swagger-ui/index.html"
          target="_blank"
          rel="noreferrer"
          className="text-xs text-accent underline inline-flex items-center gap-1"
        >
          Documentação da fonte na CGU <ExternalLink className="size-3" />
        </a>
      </PainelExplicar>

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
          <strong> sem convênio</strong>. A rastreabilidade automática se quebra: o Portal mostra o
          pagamento; o Transferegov não tem registro (não há convênio); e o PNCP registra o contrato
          municipal sem campo estruturado apontando a origem federal. Reatar a trilha exige cruzar
          SICONFI (saldos contábeis) com a "Fonte de Recurso" na transparência municipal — uma
          lacuna metodológica registrada em{" "}
          <Link to="/lacunas" className="text-accent underline">
            Informação que falta
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
