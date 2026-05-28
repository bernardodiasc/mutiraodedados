import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { obterEmenda } from "@/lib/data/transferegov/emendas-queries.functions";
import { fmtBRL } from "@/lib/fmt";
import { ArrowLeft, ExternalLink, Info } from "lucide-react";

export const Route = createFileRoute("/transferencias/finalidade/$id")({
  component: EmendaDetalhe,
  head: () => ({ meta: [{ title: "Transferência com Finalidade Definida — Auditoria Cidadã" }] }),
});

function EmendaDetalhe() {
  const { id } = useParams({ from: "/transferencias/finalidade/$id" });
  const fetchEmenda = useServerFn(obterEmenda);
  const { data, isLoading } = useQuery({
    queryKey: ["emenda", id],
    queryFn: () => fetchEmenda({ data: { id } }),
  });

  if (isLoading) return <div className="mx-auto max-w-3xl px-4 py-10 text-sm text-muted-foreground">Carregando…</div>;
  const e = data?.emenda;
  if (!e) return <div className="mx-auto max-w-3xl px-4 py-10 text-sm text-muted-foreground">Não encontrada.</div>;

  return (
    <article className="mx-auto max-w-3xl px-4 py-10 space-y-6">
      <Link to="/transferencias" className="text-xs text-muted-foreground inline-flex items-center gap-1">
        <ArrowLeft className="size-3.5" /> voltar
      </Link>
      <header>
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Finalidade Definida (EC 105)</div>
        <h1 className="font-display text-3xl mt-1">Emenda {e.numero_emenda ?? "—"}</h1>
        <p className="text-muted-foreground mt-1">Autor: {e.autor_emenda ?? "—"}</p>
      </header>

      <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
        <div><dt className="text-muted-foreground">Beneficiário</dt><dd>{e.beneficiario_nome ?? "—"}</dd></div>
        <div><dt className="text-muted-foreground">CNPJ</dt><dd>{e.beneficiario_cnpj ?? "—"}</dd></div>
        <div><dt className="text-muted-foreground">UF/Município</dt><dd>{[e.uf, e.municipio_nome].filter(Boolean).join("/") || "—"}</dd></div>
        <div><dt className="text-muted-foreground">Data</dt><dd>{e.data_referencia ?? `Ano ${e.ano}`}</dd></div>
        <div><dt className="text-muted-foreground">Função</dt><dd>{e.funcao ?? "—"}</dd></div>
        <div><dt className="text-muted-foreground">Subfunção</dt><dd>{e.subfuncao ?? "—"}</dd></div>
        <div><dt className="text-muted-foreground">Valor disponibilizado</dt><dd className="font-medium">{fmtBRL(e.valor)}</dd></div>
        <div><dt className="text-muted-foreground">Valor pago</dt><dd className="font-medium">{fmtBRL(e.valor_pago)}</dd></div>
      </dl>

      {e.finalidade && (
        <section>
          <h2 className="font-semibold mb-1">Finalidade</h2>
          <p className="text-sm text-muted-foreground">{e.finalidade}</p>
        </section>
      )}

      <section className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4 text-sm space-y-2">
        <div className="flex items-center gap-2 font-semibold text-blue-700 dark:text-blue-300">
          <Info className="size-4" /> Guia do auditor cidadão
        </div>
        {Number(e.valor_pago ?? 0) === 0 ? (
          <p className="text-muted-foreground">
            <strong className="text-foreground">Valor pago R$ 0</strong> nessa modalidade indica que a
            emenda ainda não teve pagamento registrado no SIAFI — pode estar empenhada, liquidada ou
            apenas reservada. A execução costuma demorar meses após a disponibilização e há emendas
            que sequer chegam a ser executadas no exercício.
          </p>
        ) : (
          <p className="text-muted-foreground">
            O valor pago corresponde ao que já foi efetivamente liquidado e pago pelo órgão
            concedente, conforme o SIAFI. Pode haver restos a pagar de exercícios anteriores.
          </p>
        )}
        <p className="text-muted-foreground">Para aprofundar a auditoria, consulte:</p>
        <ul className="list-disc pl-5 text-muted-foreground space-y-1">
          <li>Convênio/contrato de repasse correspondente no Transferegov.</li>
          <li>PNCP — licitações e contratos com o recurso.</li>
          <li>Portal de transparência do {e.municipio_nome ?? "ente beneficiário"} {e.uf ? `(${e.uf})` : ""}.</li>
          <li>Tribunal de Contas competente — pareceres e julgados.</li>
        </ul>
      </section>

      <a
        href={
          e.codigo_emenda
            ? `https://portaldatransparencia.gov.br/emendas/consulta?de=${e.ano}&ate=${e.ano}&codigoEmenda=${encodeURIComponent(e.codigo_emenda)}`
            : `https://portaldatransparencia.gov.br/emendas/consulta?de=${e.ano}&ate=${e.ano}&numeroEmenda=${encodeURIComponent(e.numero_emenda ?? "")}`
        }
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
      >
        <ExternalLink className="size-3.5" />
        Abrir no Portal da Transparência
      </a>
    </article>
  );
}