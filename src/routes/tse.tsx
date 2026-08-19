import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink } from "lucide-react";
import { coberturaPublica } from "@/lib/data/cobertura-publica.functions";
import { sinaisDaFonteTse } from "@/lib/data/tse/queries.functions";
import { BotaoCopiar } from "@/components/BotaoCopiar";
import { iconFor } from "@/lib/nav-groups";

export const Route = createFileRoute("/tse")({
  component: TsePage,
  head: () => ({
    meta: [
      { title: "TSE — Dados Abertos Eleitorais — Mutirão de Dados" },
      {
        name: "description",
        content:
          "O que a fonte TSE cobre no Mutirão de Dados: candidatos, bens declarados, votação e contas de campanha de 1998 em diante — com sinais de qualidade, lacunas e cruzamentos investigativos.",
      },
    ],
  }),
});

// Reprodução independente: a origem é o CKAN público do TSE.
const CURL_REPRODUCAO =
  "curl -s \"https://dadosabertos.tse.jus.br/api/3/action/package_show?id=candidatos-2022\" | jq '.result.resources[] | {name, url}'";

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
        <h1 className="font-display text-4xl mt-1">TSE — Dados Abertos Eleitorais</h1>
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
              ? `${fonteTse.totalRegistros.toLocaleString("pt-BR")} candidaturas em cache · ${anos.length} eleição(ões)`
              : "Nenhuma eleição importada ainda."}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Última importação
          </div>
          <div className="font-display text-2xl mt-1">
            {fonteTse?.ultimaAtualizacao
              ? new Date(fonteTse.ultimaAtualizacao).toLocaleDateString("pt-BR")
              : "—"}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Cobertura detalhada em{" "}
            <Link to="/cobertura" className="text-accent underline">
              /cobertura
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
              : "Contagens aparecem após a primeira importação."}
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
          <h2 className="font-display text-xl">Reproduza esta fonte</h2>
          <BotaoCopiar obterTexto={() => CURL_REPRODUCAO} rotulo="Copiar curl" />
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          Toda métrica desta fonte tem origem pública e reprodutível. O comando abaixo lista os
          arquivos oficiais do dataset de candidatos de 2022 direto no CKAN do TSE (troque o ano no
          id do dataset):
        </p>
        <pre className="mt-3 text-xs bg-muted/40 border border-border rounded-md p-3 overflow-x-auto">
          {CURL_REPRODUCAO}
        </pre>
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
        . Detalhes técnicos em <code>docs/fontes/tse.md</code>.
      </p>
    </div>
  );
}
