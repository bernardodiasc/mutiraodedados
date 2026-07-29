import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { buscaGlobal, type ResultadoBusca } from "@/lib/data/busca.functions";
import { AvisoMetodologico } from "@/components/AvisoMetodologico";
import { EmptyState } from "@/components/EmptyState";
import { AcoesDaEntidade } from "@/components/AcoesDaEntidade";
import { fmtBRL } from "@/lib/fmt";
import type { EntidadeTipo } from "@/lib/itens-salvos.functions";
import { Search, FileText, ArrowRightLeft, Gavel, HandCoins, FileSignature } from "lucide-react";

type ItemBusca = ResultadoBusca["pncp"][number];

/** Uma linha de resultado com o Kit do auditor (Copiar, Salvar, Abrir fonte). */
function ResultadoItem({ r, tipo }: { r: ItemBusca; tipo: EntidadeTipo }) {
  return (
    <li className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium">{r.titulo}</div>
          <div className="text-xs text-muted-foreground">{r.subtitulo}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="font-medium">{fmtBRL(r.valor)}</div>
          <div className="text-xs text-muted-foreground">{r.data ?? "—"}</div>
        </div>
      </div>
      <AcoesDaEntidade
        entidadeTipo={tipo}
        entidadeId={r.id}
        titulo={r.titulo}
        url={r.href}
        contexto={r.subtitulo || undefined}
        snapshotDe={r}
        fonteOficialHref={r.href || undefined}
        fonteOficialLabel="Abrir"
      />
    </li>
  );
}

export const Route = createFileRoute("/buscar")({
  component: BuscarPage,
  head: () => ({
    meta: [
      { title: "Buscar — Mutirão de Dados" },
      { name: "description", content: "Busca unificada por CNPJ, órgão, fornecedor ou objeto em contratos públicos e transferências da União." },
      { property: "og:title", content: "Buscar — Mutirão de Dados" },
      { property: "og:description", content: "Busca unificada por CNPJ, órgão, fornecedor ou objeto em contratos públicos e transferências da União." },
    ],
  }),
});

function BuscarPage() {
  const [termo, setTermo] = useState("");
  const [enviado, setEnviado] = useState("");

  const buscar = useServerFn(buscaGlobal);
  const { data, isLoading } = useQuery({
    queryKey: ["busca-global", enviado],
    enabled: enviado.length >= 2,
    queryFn: () => buscar({ data: { termo: enviado, limit: 50 } }),
  });

  function submeter(e: React.FormEvent) {
    e.preventDefault();
    setEnviado(termo.trim());
  }

  const totalResultados =
    (data?.pncp.length ?? 0) +
    (data?.licitacoes.length ?? 0) +
    (data?.emendas.length ?? 0) +
    (data?.convenios.length ?? 0) +
    (data?.transferencias.length ?? 0);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 space-y-6">
      <header>
        <div className="text-xs text-muted-foreground uppercase tracking-wider">Busca unificada</div>
        <h1 className="font-display text-4xl mt-1">Buscar</h1>
        <p className="text-muted-foreground mt-3 max-w-2xl leading-relaxed">
          Pesquise um CNPJ (14 dígitos), nome de órgão/fornecedor ou trecho do objeto.
          A busca atravessa contratos do PNCP e transferências/convênios da União que já
          estão em cache na plataforma.
        </p>
      </header>

      <form onSubmit={submeter} className="flex gap-2">
        <input
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          placeholder="CNPJ, nome ou palavra-chave"
          className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-accent text-accent-foreground text-sm font-semibold hover:opacity-90"
        >
          <Search className="size-4" /> Buscar
        </button>
      </form>

      <AvisoMetodologico />

      {!enviado && (
        <EmptyState
          title="Comece pela busca"
          hint="Ex.: 00.000.000/0001-91, 'merenda escolar', 'Prefeitura de Recife', '34028316' (CPF/CNPJ parcial)."
        />
      )}

      {enviado && isLoading && <p className="text-sm text-muted-foreground">Buscando…</p>}

      {enviado && !isLoading && data && (
        <>
          <div className="text-xs text-muted-foreground">
            {data.cnpjDetectado ? (
              <>CNPJ detectado: <span className="font-mono text-foreground">{data.cnpjDetectado}</span> · </>
            ) : null}
            {totalResultados} resultado(s).
          </div>

          {data.pncp.length > 0 && (
            <section>
              <h2 className="font-display text-lg flex items-center gap-2 mb-3">
                <FileText className="size-4" /> Contratos (PNCP) — {data.pncp.length}
              </h2>
              <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
                {data.pncp.map((r) => (
                  <ResultadoItem key={r.id} r={r} tipo="contrato" />
                ))}
              </ul>
            </section>
          )}

          {data.licitacoes.length > 0 && (
            <section>
              <h2 className="font-display text-lg flex items-center gap-2 mb-3">
                <Gavel className="size-4" /> Licitações (CGU) — {data.licitacoes.length}
              </h2>
              <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
                {data.licitacoes.map((r) => (
                  <ResultadoItem key={r.id} r={r} tipo="licitacao" />
                ))}
              </ul>
            </section>
          )}

          {data.emendas.length > 0 && (
            <section>
              <h2 className="font-display text-lg flex items-center gap-2 mb-3">
                <HandCoins className="size-4" /> Emendas (CGU) — {data.emendas.length}
              </h2>
              <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
                {data.emendas.map((r) => (
                  <ResultadoItem key={r.id} r={r} tipo="emenda" />
                ))}
              </ul>
            </section>
          )}

          {data.convenios.length > 0 && (
            <section>
              <h2 className="font-display text-lg flex items-center gap-2 mb-3">
                <FileSignature className="size-4" /> Convênios (CGU) — {data.convenios.length}
              </h2>
              <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
                {data.convenios.map((r) => (
                  <ResultadoItem key={r.id} r={r} tipo="convenio" />
                ))}
              </ul>
            </section>
          )}

          {data.transferencias.length > 0 && (
            <section>
              <h2 className="font-display text-lg flex items-center gap-2 mb-3">
                <ArrowRightLeft className="size-4" /> Transferências/Convênios — {data.transferencias.length}
              </h2>
              <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
                {data.transferencias.map((r) => (
                  <ResultadoItem key={r.id} r={r} tipo="convenio" />
                ))}
              </ul>
            </section>
          )}

          {totalResultados === 0 && (
            <EmptyState
              title="Nada encontrado"
              hint="Verifique o termo ou importe dados via Admin. A busca usa apenas o cache local — não consulta as APIs em tempo real."
            />
          )}
        </>
      )}
    </div>
  );
}