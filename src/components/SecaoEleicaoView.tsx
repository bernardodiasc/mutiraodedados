import { Link } from "@tanstack/react-router";
import { AlertTriangle, Loader2, Vote } from "lucide-react";
import { fmtBRL } from "@/lib/fmt";
import type { EleicoesParlamentar } from "@/lib/data/tse/queries.functions";
import type { Estado } from "@/lib/secao-eleicao/logic";
import { foiEleito, vinculoPrecisaAviso } from "@/lib/secao-eleicao/logic";

export type SecaoEleicaoViewProps = {
  estado: Estado;
  dados: EleicoesParlamentar | null;
};

/**
 * Seção "Eleições" da ficha de deputado/senador: últimas candidaturas, bens,
 * top doadores e top fornecedores de campanha (fonte TSE, via ponte).
 */
export function SecaoEleicaoView({ estado, dados }: SecaoEleicaoViewProps) {
  if (estado === "carregando") {
    return (
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-display text-2xl flex items-center gap-2">
          <Vote className="size-5 text-accent" /> Eleições
        </h2>
        <p className="text-sm text-muted-foreground mt-3 flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" /> Carregando histórico eleitoral…
        </p>
      </section>
    );
  }
  if (estado === "erro") {
    return (
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-display text-2xl flex items-center gap-2">
          <Vote className="size-5 text-accent" /> Eleições
        </h2>
        <p className="text-sm text-destructive mt-3">
          Não consegui carregar o histórico eleitoral.
        </p>
      </section>
    );
  }
  if (estado === "sem-vinculo" || !dados) {
    return (
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-display text-2xl flex items-center gap-2">
          <Vote className="size-5 text-accent" /> Eleições
        </h2>
        <p className="text-sm text-muted-foreground mt-3">
          Ainda não há candidaturas vinculadas a este parlamentar. O vínculo é criado pela
          importação do TSE (admin) — quando existir, o histórico eleitoral e as contas de campanha
          aparecem aqui.
        </p>
      </section>
    );
  }

  const recente = dados.candidaturas[0];
  const avisoVinculo = vinculoPrecisaAviso(recente.match_metodo, recente.match_confianca);

  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-5">
      <h2 className="font-display text-2xl flex items-center gap-2">
        <Vote className="size-5 text-accent" /> Eleições
      </h2>

      {avisoVinculo && (
        <p className="text-xs border border-border rounded-md bg-muted/40 p-3 flex items-start gap-2 text-muted-foreground">
          <AlertTriangle className="size-4 shrink-0 mt-0.5" />
          Vínculo derivado por nome e UF (o TSE não expõe o CPF deste parlamentar nas fontes usadas)
          — confira o nome antes de tirar conclusões.
        </p>
      )}

      <div>
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Últimas candidaturas
        </h3>
        <ul className="grid gap-2 mt-2">
          {dados.candidaturas.map((c) => (
            <li
              key={`${c.sq_candidato}-${c.ano_eleicao}`}
              className="border border-border rounded-md p-3 bg-background flex items-center justify-between gap-3 flex-wrap"
            >
              <div>
                <Link
                  to="/eleicoes/candidatos/$sq"
                  params={{ sq: c.sq_candidato }}
                  search={{ ano: c.ano_eleicao }}
                  className="font-medium hover:text-accent"
                >
                  {c.ano_eleicao} — {c.cargo_nome ?? "cargo não informado"}
                </Link>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {[c.uf, c.partido_sigla].filter(Boolean).join(" · ")}
                  {c.bens_total_declarado != null && c.bens_total_declarado > 0 && (
                    <> · bens declarados: {fmtBRL(c.bens_total_declarado)}</>
                  )}
                </p>
              </div>
              {c.situacao_totalizacao && (
                <span
                  className={`text-xs border rounded-full px-2 py-0.5 ${
                    foiEleito(c.situacao_totalizacao)
                      ? "bg-primary/10 text-primary border-primary/30"
                      : "bg-muted text-muted-foreground border-border"
                  }`}
                >
                  {c.situacao_totalizacao}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Top doadores — campanha {recente.ano_eleicao}
          </h3>
          {dados.topDoadores.length === 0 ? (
            <p className="text-sm text-muted-foreground mt-2">
              Sem receitas importadas para esta campanha.
            </p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground mt-1 font-mono">
                total recebido: {fmtBRL(dados.totalReceitas)}
              </p>
              <ul className="grid gap-1 mt-2 text-sm">
                {dados.topDoadores.map((d) => (
                  <li
                    key={d.documento}
                    className="flex justify-between gap-3 border-b border-border/60 py-1"
                  >
                    <span className="truncate" title={d.nome}>
                      {d.nome}
                    </span>
                    <span className="font-mono shrink-0">{fmtBRL(d.total)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
        <div>
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Top fornecedores — campanha {recente.ano_eleicao}
          </h3>
          {dados.topFornecedores.length === 0 ? (
            <p className="text-sm text-muted-foreground mt-2">
              Sem despesas importadas para esta campanha.
            </p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground mt-1 font-mono">
                total contratado: {fmtBRL(dados.totalDespesas)}
              </p>
              <ul className="grid gap-1 mt-2 text-sm">
                {dados.topFornecedores.map((f) => (
                  <li
                    key={f.documento}
                    className="flex justify-between gap-3 border-b border-border/60 py-1"
                  >
                    <span className="truncate" title={f.nome}>
                      {f.nome}
                    </span>
                    <span className="font-mono shrink-0">{fmtBRL(f.total)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
SecaoEleicaoView.displayName = "SecaoEleicaoView";
