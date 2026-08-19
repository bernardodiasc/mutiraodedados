import type { ReactNode } from "react";
import { ExternalLink, Loader2, Vote, Wallet } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { fmtBRL, fmtNum } from "@/lib/fmt";
import type { CandidatoDetalhe } from "@/lib/data/tse/queries.functions";
import type { Estado } from "@/lib/candidato-ficha/logic";
import { subtituloFicha, totalPatrimonio } from "@/lib/candidato-ficha/logic";

export type CandidatoFichaViewProps = {
  estado: Estado;
  detalhe: CandidatoDetalhe | null;
  urlOficial: string;
  /** Seções compostas pelo Container. */
  vinculoParlamentar?: ReactNode;
  historico?: ReactNode;
  comparador?: ReactNode;
};

export function CandidatoFichaView({
  estado,
  detalhe,
  urlOficial,
  vinculoParlamentar,
  historico,
  comparador,
}: CandidatoFichaViewProps) {
  if (estado === "carregando") {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-10 justify-center">
        <Loader2 className="size-4 animate-spin" /> Carregando ficha do candidato…
      </div>
    );
  }
  if (estado === "erro") {
    return (
      <div className="text-destructive py-10 text-center">Não consegui carregar esta ficha.</div>
    );
  }
  if (estado === "nao-encontrado" || !detalhe) {
    return (
      <EmptyState
        title="Candidatura não encontrada"
        hint="Confira o ano na URL — a mesma pessoa tem um registro por eleição. Se a eleição ainda não foi importada, a ficha não existe aqui."
      />
    );
  }

  const c = detalhe.candidato;
  // null quando não há nem agregado nem linhas: "não sabemos" não pode virar
  // "R$ 0,00", que é o que o leitor entende como patrimônio zerado.
  const totalBens = totalPatrimonio(c.bens_total_declarado, detalhe.bens);

  return (
    <div className="grid gap-6">
      <header className="border border-border rounded-xl p-5 bg-card">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="font-display text-2xl">{c.nome_urna ?? c.nome_completo}</h1>
            <p className="text-sm text-muted-foreground mt-1">{c.nome_completo}</p>
            <p className="text-sm text-muted-foreground mt-1">{subtituloFicha(c)}</p>
          </div>
          <div className="grid gap-2 justify-items-end">
            {c.situacao_totalizacao && (
              <span className="text-xs border rounded-full px-2 py-0.5 bg-muted">
                {c.situacao_totalizacao}
              </span>
            )}
            <a
              href={urlOficial}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-accent inline-flex items-center gap-1 hover:underline"
            >
              Ver na fonte oficial <ExternalLink className="size-3" />
            </a>
          </div>
        </div>
        <dl className="grid gap-x-8 gap-y-2 mt-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {c.numero_candidato && (
            <div>
              <dt className="text-muted-foreground">Número na urna</dt>
              <dd className="font-mono">{c.numero_candidato}</dd>
            </div>
          )}
          {c.ocupacao && (
            <div>
              <dt className="text-muted-foreground">Ocupação declarada</dt>
              <dd>{c.ocupacao}</dd>
            </div>
          )}
          {c.grau_instrucao && (
            <div>
              <dt className="text-muted-foreground">Grau de instrução</dt>
              <dd>{c.grau_instrucao}</dd>
            </div>
          )}
          {c.genero && (
            <div>
              <dt className="text-muted-foreground">Gênero</dt>
              <dd>{c.genero}</dd>
            </div>
          )}
          {c.cor_raca && (
            <div>
              <dt className="text-muted-foreground">Cor/raça (autodeclarada)</dt>
              <dd>{c.cor_raca}</dd>
            </div>
          )}
          {c.situacao_candidatura && (
            <div>
              <dt className="text-muted-foreground">Situação da candidatura</dt>
              <dd>{c.situacao_candidatura}</dd>
            </div>
          )}
        </dl>
      </header>

      {vinculoParlamentar}

      <section className="border border-border rounded-xl p-5 bg-card">
        <h2 className="font-display text-lg flex items-center gap-2">
          <Vote className="size-4 text-accent" /> Votação
        </h2>
        {detalhe.votosTotais > 0 ? (
          <>
            <p className="text-sm mt-2">
              <span className="font-mono text-xl">{fmtNum(detalhe.votosTotais)}</span>{" "}
              <span className="text-muted-foreground">votos nominais</span>
            </p>
            {detalhe.topMunicipios.length > 0 && (
              <ul className="grid gap-1 mt-3 text-sm">
                {detalhe.topMunicipios.map((m, i) => (
                  <li key={i} className="flex justify-between border-b border-border/60 py-1">
                    <span>{m.municipio_nome ?? "—"}</span>
                    <span className="font-mono text-muted-foreground">{fmtNum(m.votos)}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground mt-2">
            Sem votação importada para esta candidatura (o resultado pode não ter sido sincronizado
            ainda).
          </p>
        )}
      </section>

      <section className="border border-border rounded-xl p-5 bg-card">
        <h2 className="font-display text-lg flex items-center gap-2">
          <Wallet className="size-4 text-accent" /> Bens declarados
        </h2>
        {detalhe.bens.length > 0 ? (
          <>
            <p className="text-sm mt-2">
              <span className="font-mono text-xl">
                {totalBens != null ? fmtBRL(totalBens) : "sem dados"}
              </span>{" "}
              <span className="text-muted-foreground">
                em {fmtNum(detalhe.bensTotalLinhas)} bem(ns)
              </span>
            </p>
            <ul className="grid gap-1 mt-3 text-sm">
              {detalhe.bens.map((b) => (
                <li
                  key={b.ordem_bem}
                  className="flex justify-between gap-4 border-b border-border/60 py-1"
                >
                  <span className="text-muted-foreground">
                    {b.tipo_bem ?? "Bem"} — {b.descricao ?? "sem descrição"}
                  </span>
                  <span className="font-mono shrink-0">
                    {b.valor != null ? fmtBRL(b.valor) : "—"}
                  </span>
                </li>
              ))}
            </ul>
            {detalhe.bens.length < detalhe.bensTotalLinhas && (
              <p className="text-xs text-muted-foreground mt-2">
                Mostrando os {detalhe.bens.length} maiores de {fmtNum(detalhe.bensTotalLinhas)}.
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground mt-2">
            Nenhum bem declarado encontrado para esta candidatura.
          </p>
        )}
      </section>

      {historico}
      {comparador}
    </div>
  );
}
CandidatoFichaView.displayName = "CandidatoFichaView";
