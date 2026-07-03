import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { listarVotacoes, camaraVotacoesOverview } from "@/lib/data/camara/votacoes.functions";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/EmptyState";
import { BotaoBaixarCsv } from "@/components/BotaoBaixarCsv";
import { CheckCircle2, XCircle, MinusCircle } from "lucide-react";

export const Route = createFileRoute("/camara_/votacoes/")({
  component: ListaVotacoes,
  head: () => ({
    meta: [
      { title: "Votações nominais — Auditoria Cidadã" },
      {
        name: "description",
        content:
          "Votações nominais em plenário e comissões da Câmara dos Deputados, com resultado, proposição votada e contagem de votos.",
      },
    ],
  }),
});

function ListaVotacoes() {
  const listFn = useServerFn(listarVotacoes);
  const ovFn = useServerFn(camaraVotacoesOverview);
  const [termo, setTermo] = useState("");

  const filtros = useMemo(() => ({ termo: termo.trim() || undefined }), [termo]);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["camara", "vots", filtros],
    queryFn: () => listFn({ data: filtros }),
  });
  const { data: ov } = useQuery({
    queryKey: ["camara", "vots-ov"],
    queryFn: () => ovFn(),
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 space-y-6">
      <header>
        <div className="text-xs text-muted-foreground uppercase tracking-wider">
          <Link to="/camara" className="hover:text-accent">Câmara</Link> · Votações
        </div>
        <h1 className="font-display text-4xl mt-1">Votações nominais</h1>
        <p className="text-muted-foreground mt-2 max-w-3xl">
          Cada votação é um momento em que deputados registram nominalmente seu voto sobre
          uma proposição, destaque ou requerimento. Aqui mostramos descrição, proposição
          associada e contagem de Sim/Não/outros — clique para ver disciplina partidária.
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
            filename="votacoes"
            obterLinhas={() =>
              rows.map((v) => ({
                data: v.data ?? "",
                orgao: v.siglaOrgao ?? "",
                descricao: v.descricao ?? "",
                resultado: v.aprovacao === 1 ? "Aprovado" : v.aprovacao === 0 ? "Rejeitado" : "",
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
                <th className="text-left px-4 py-2 w-20">Órgão</th>
                <th className="text-left px-4 py-2">Descrição</th>
                <th className="text-center px-4 py-2 w-28">Resultado</th>
                <th className="text-right px-4 py-2 w-40">Sim · Não · Outros</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((v) => (
                <tr key={v.id} className="border-t border-border hover:bg-muted/20">
                  <td className="px-4 py-3 align-top text-xs text-muted-foreground whitespace-nowrap">
                    {v.data ?? "—"}
                  </td>
                  <td className="px-4 py-3 align-top text-xs">{v.siglaOrgao ?? "—"}</td>
                  <td className="px-4 py-3 align-top">
                    <Link
                      to="/camara/votacoes/$id"
                      params={{ id: v.id }}
                      className="text-accent hover:underline"
                    >
                      <p className="line-clamp-2 leading-snug">{v.descricao ?? "(sem descrição)"}</p>
                    </Link>
                    {v.proposicaoTitulo && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{v.proposicaoTitulo}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top text-center">
                    <ResultadoBadge aprovacao={v.aprovacao} />
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

function ResultadoBadge({ aprovacao }: { aprovacao: number | null }) {
  if (aprovacao === 1) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-500">
        <CheckCircle2 className="size-3" /> Aprovado
      </span>
    );
  }
  if (aprovacao === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-rose-500">
        <XCircle className="size-3" /> Rejeitado
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <MinusCircle className="size-3" /> —
    </span>
  );
}