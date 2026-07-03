import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { listarVotacoesSenado, senadoVotacoesOverview } from "@/lib/data/senado/votacoes.functions";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/EmptyState";
import { BotaoBaixarCsv } from "@/components/BotaoBaixarCsv";
import { CheckCircle2, XCircle, MinusCircle } from "lucide-react";

export const Route = createFileRoute("/senado_/votacoes/")({
  component: ListaVotacoesSenado,
  head: () => ({
    meta: [
      { title: "Votações nominais — Senado — Auditoria Cidadã" },
      {
        name: "description",
        content:
          "Votações nominais em plenário do Senado, com resultado, matéria associada e contagem de votos.",
      },
    ],
  }),
});

function ListaVotacoesSenado() {
  const listFn = useServerFn(listarVotacoesSenado);
  const ovFn = useServerFn(senadoVotacoesOverview);
  const [termo, setTermo] = useState("");

  const filtros = useMemo(() => ({ termo: termo.trim() || undefined }), [termo]);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["senado", "vots", filtros],
    queryFn: () => listFn({ data: filtros }),
  });
  const { data: ov } = useQuery({
    queryKey: ["senado", "vots-ov"],
    queryFn: () => ovFn(),
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 space-y-6">
      <header>
        <div className="text-xs text-muted-foreground uppercase tracking-wider">
          <Link to="/senado" className="hover:text-accent">Senado</Link> · Votações
        </div>
        <h1 className="font-display text-4xl mt-1">Votações nominais</h1>
        <p className="text-muted-foreground mt-2 max-w-3xl">
          Cada votação registra nominalmente como cada senador votou. Clique em uma votação
          para ver disciplina partidária e voto individual.
        </p>
        {ov && (
          <p className="text-xs text-muted-foreground mt-3">
            {ov.totalVotacoes.toLocaleString("pt-BR")} votações ·{" "}
            {ov.totalVotos.toLocaleString("pt-BR")} votos nominais
            {ov.ultimaData && <> · última em {ov.ultimaData}</>}
          </p>
        )}
      </header>

      <Input
        placeholder="Buscar na descrição…"
        value={termo}
        onChange={(e) => setTermo(e.target.value)}
      />

      {rows && rows.length > 0 && (
        <div className="flex justify-end">
          <BotaoBaixarCsv
            filename="votacoes-senado"
            obterLinhas={() =>
              rows.map((v) => ({
                data: v.data ?? "",
                descricao: v.descricao ?? "",
                materia: v.materiaTitulo ?? "",
                resultado: v.resultado ?? "",
                sim: v.votosSim,
                nao: v.votosNao,
                outros: v.votosOutros,
              }))
            }
            rotulo={`Baixar CSV (${rows.length})`}
          />
        </div>
      )}

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : !rows || rows.length === 0 ? (
        <EmptyState
          title="Nenhuma votação em cache"
          hint="Um administrador precisa importar um intervalo de datas pelo painel admin."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2 w-24">Data</th>
                <th className="text-left px-4 py-2">Descrição</th>
                <th className="text-center px-4 py-2 w-32">Resultado</th>
                <th className="text-right px-4 py-2 w-40">Sim · Não · Outros</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((v) => (
                <tr key={v.id} className="border-t border-border hover:bg-muted/20">
                  <td className="px-4 py-3 align-top text-xs text-muted-foreground whitespace-nowrap">
                    {v.data ?? "—"}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <Link
                      to="/senado/votacoes/$id"
                      params={{ id: v.id }}
                      className="text-accent hover:underline"
                    >
                      <p className="line-clamp-2 leading-snug">{v.descricao ?? "(sem descrição)"}</p>
                    </Link>
                    {v.materiaTitulo && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{v.materiaTitulo}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top text-center">
                    <ResultadoBadge res={v.resultado} />
                  </td>
                  <td className="px-4 py-3 align-top text-right font-mono text-xs whitespace-nowrap">
                    <span className="text-emerald-500">{v.votosSim}</span>
                    {" · "}
                    <span className="text-rose-500">{v.votosNao}</span>
                    {" · "}
                    <span className="text-muted-foreground">{v.votosOutros}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ResultadoBadge({ res }: { res: string | null }) {
  const t = (res ?? "").toLowerCase();
  if (t.includes("aprov")) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-500">
        <CheckCircle2 className="size-3" /> Aprovado
      </span>
    );
  }
  if (t.includes("rejeit")) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-rose-500">
        <XCircle className="size-3" /> Rejeitado
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <MinusCircle className="size-3" /> {res ?? "—"}
    </span>
  );
}