import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink } from "lucide-react";
import { coberturaPublica } from "@/lib/data/cobertura-publica.functions";
import { sinaisDaFonteTse } from "@/lib/data/tse/queries.functions";
import { PainelInvestigarView } from "@/components/PainelInvestigarView";
import { iconFor } from "@/lib/nav-groups";

export const Route = createFileRoute("/tse")({
  component: TsePage,
  head: () => ({
    meta: [
      { title: "Tribunal Superior Eleitoral (TSE) — Mutirão de Dados" },
      {
        name: "description",
        content:
          "O que a fonte TSE cobre no Mutirão de Dados: candidatos, bens declarados, votação e contas de campanha de 1998 em diante — com sinais de qualidade, lacunas e cruzamentos investigativos.",
      },
    ],
  }),
});

// Reprodução independente: a origem é o portal de dados abertos do TSE.
const CURL_REPRODUCAO =
  'curl -s "https://dadosabertos.tse.jus.br/api/3/action/package_show?id=candidatos-2022"';

function TsePage() {
  const fetchCob = useServerFn(coberturaPublica);
  const { data: cob } = useQuery({ queryKey: ["cobertura-publica"], queryFn: () => fetchCob() });
  const fetchSinais = useServerFn(sinaisDaFonteTse);
  const { data: sinais } = useQuery({
    queryKey: ["tse", "sinais-fonte"],
    queryFn: () => fetchSinais(),
  });

  const fonteTse = (cob?.fontes ?? []).find((f) => f.id === "tse");
  const anos = (fonteTse?.porAno ?? []).map((a) => a.ano).sort((a, b) => a - b);
  const IconEleicoes = iconFor("/eleicoes");

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 space-y-8">
      <header>
        <div className="text-xs text-muted-foreground uppercase tracking-wider">
          Por fonte de dados
        </div>
        <h1 className="font-display text-4xl mt-1">Tribunal Superior Eleitoral (TSE)</h1>
        <p className="text-muted-foreground mt-3 max-w-3xl leading-relaxed">
          Quem se candidatou, o que declarou de bens, quantos votos recebeu e de quem veio o
          dinheiro da campanha. A carga em massa vem dos CSVs do portal de dados abertos do TSE
          (padrão CKAN); a API do DivulgaCandContas entra só para revalidação pontual. Cobrimos
          eleições de <strong>1998 em diante</strong>.{" "}
          <a
            href="https://dadosabertos.tse.jus.br"
            target="_blank"
            rel="noreferrer"
            className="text-accent underline"
          >
            dadosabertos.tse.jus.br <ExternalLink className="inline size-3" />
          </a>
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Cobertura</div>
          <div className="font-display text-2xl mt-1">
            {anos.length > 0 ? `${anos[0]}–${anos[anos.length - 1]}` : "—"}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {fonteTse
              ? `${fonteTse.totalRegistros.toLocaleString("pt-BR")} candidaturas no acervo · ${anos.length} eleição(ões)`
              : "Nenhuma eleição no acervo ainda."}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Última atualização
          </div>
          <div className="font-display text-2xl mt-1">
            {fonteTse?.ultimaAtualizacao
              ? new Date(fonteTse.ultimaAtualizacao).toLocaleDateString("pt-BR")
              : "—"}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Cobertura detalhada em{" "}
            <Link to="/cobertura" className="text-accent underline">
              Cobertura dos dados
            </Link>
            .
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Sinais da fonte
          </div>
          <div className="font-display text-2xl mt-1">
            {sinais
              ? sinais.porTipo.qualidade + sinais.porTipo.lacuna + sinais.porTipo.investigativo
              : "—"}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {sinais
              ? `${sinais.porTipo.qualidade} de qualidade · ${sinais.porTipo.lacuna} lacunas · ${sinais.porTipo.investigativo} investigativos`
              : "As contagens aparecem quando os primeiros dados entram no acervo."}
          </p>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Link
          to="/eleicoes"
          className="rounded-2xl border border-border bg-card p-5 hover:border-accent transition-colors"
        >
          <div className="flex items-center gap-2 font-medium">
            <IconEleicoes className="size-4 text-muted-foreground" /> Eleições
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Hub por eleição: candidaturas e eleitos por cargo, com busca de candidatos e ficha
            individual (bens, votos, contas).
          </p>
        </Link>
        <Link
          to="/qualidade"
          className="rounded-2xl border border-border bg-card p-5 hover:border-accent transition-colors"
        >
          <div className="font-medium">Qualidade e sinais</div>
          <p className="text-sm text-muted-foreground mt-1">
            {sinais
              ? `${sinais.abertos} sinal(is) em aberto e ${sinais.resolvidos} resolvidos — inclui os cruzamentos investigativos (doador↔fornecedor).`
              : "Alertas de qualidade, lacunas e cruzamentos investigativos da fonte."}
          </p>
        </Link>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-display text-xl">O que significa cada tipo de sinal</h2>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
          <strong className="text-foreground">Alertas de qualidade</strong> são defeitos do próprio
          dado (CPF com dígito inválido, data impossível) — transparência sobre os limites do que a
          origem publica. <strong className="text-foreground">Lacunas</strong> são ausências que não
          deveriam existir (eleito sem prestação de contas).{" "}
          <strong className="text-foreground">Sinais investigativos</strong> são padrões revelados
          por cruzamento — nunca acusação. Os critérios completos, com parâmetros e
          falsos-positivos, estão na seção TSE da{" "}
          <Link to="/metodologia" className="text-accent underline">
            Metodologia
          </Link>
          .
        </p>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-display text-xl">Confira com as próprias mãos</h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              Toda métrica desta fonte tem origem pública e reprodutível — dá para baixar os mesmos
              arquivos que usamos e chegar aos mesmos números.
            </p>
          </div>
          <PainelInvestigarView
            titulo="Confira na fonte"
            descricao="Roteiro para verificação independente — os dados vêm do portal de dados abertos do TSE."
            rotuloGatilho="Ver o roteiro"
            passos={[
              {
                icone: "busca",
                titulo: "Abra o portal de dados abertos do TSE",
                texto:
                  "Os arquivos oficiais de candidatos, bens, votação e contas de campanha ficam em dadosabertos.tse.jus.br, organizados por eleição.",
                link: "https://dadosabertos.tse.jus.br",
                linkLabel: "Abrir dadosabertos.tse.jus.br",
              },
              {
                icone: "terminal",
                titulo: "Liste os arquivos por comando (opcional, para quem programa)",
                texto:
                  "O comando abaixo lista os arquivos oficiais do conjunto de candidatos de 2022 — troque o ano no fim do endereço para outras eleições.",
                codigo: CURL_REPRODUCAO,
              },
              {
                icone: "documento",
                titulo: "Compare com o que mostramos",
                texto:
                  "Os critérios de cada sinal, com parâmetros e falsos-positivos conhecidos, estão na seção TSE da metodologia.",
                link: "/metodologia",
                linkLabel: "Abrir a metodologia",
              },
            ]}
          />
        </div>
      </section>

      <p className="text-[11px] text-muted-foreground border-t border-border pt-4">
        Materiais de apoio: mapa investigativo{" "}
        <Link
          to="/mapas/$slug"
          params={{ slug: "siga-o-dinheiro-campanha-contrato" }}
          className="text-accent underline"
        >
          Siga o dinheiro
        </Link>
        , tutorial{" "}
        <Link
          to="/tutoriais/$slug"
          params={{ slug: "como-ler-uma-prestacao-de-contas-de-campanha" }}
          className="text-accent underline"
        >
          Como ler uma prestação de contas
        </Link>{" "}
        e a{" "}
        <Link
          to="/notas/$slug"
          params={{ slug: "integracao-fonte-tse" }}
          className="text-accent underline"
        >
          nota de campo da integração
        </Link>
        .
      </p>
    </div>
  );
}
