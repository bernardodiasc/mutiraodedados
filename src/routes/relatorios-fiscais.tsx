import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listarRelatoriosSICONFI } from "@/lib/data/siconfi/queries.functions";
import { AvisoMetodologico } from "@/components/AvisoMetodologico";
import { FontesDoTema } from "@/components/FontesDoTema";
import { fmtBRL } from "@/lib/fmt";
import { Landmark, Download } from "lucide-react";
import { downloadCSV } from "@/lib/csv";

const UFS = [
  "",
  "AC",
  "AL",
  "AM",
  "AP",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MG",
  "MS",
  "MT",
  "PA",
  "PB",
  "PE",
  "PI",
  "PR",
  "RJ",
  "RN",
  "RO",
  "RR",
  "RS",
  "SC",
  "SE",
  "SP",
  "TO",
];
const TIPOS = ["", "RREO", "RREO Simplificado", "RGF", "RGF Simplificado", "DCA"];

export const Route = createFileRoute("/relatorios-fiscais")({
  component: RelatoriosFiscaisPage,
  head: () => ({
    meta: [
      { title: "Relatórios fiscais (RREO, RGF, DCA) — Mutirão de Dados" },
      {
        name: "description",
        content:
          "Listagem de relatórios fiscais (RREO, RGF e DCA) de todos os entes federados, via SICONFI / Tesouro Nacional.",
      },
    ],
  }),
});

function RelatoriosFiscaisPage() {
  const buscar = useServerFn(listarRelatoriosSICONFI);
  const [uf, setUf] = useState("");
  const [exercicio, setExercicio] = useState<number | "">("");
  const [tipo, setTipo] = useState("");
  const [q, setQ] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["siconfi", uf, exercicio, tipo, q],
    queryFn: () =>
      buscar({
        data: {
          uf: uf || undefined,
          exercicio: exercicio || undefined,
          tipoRelatorio: tipo || undefined,
          q: q || undefined,
          limit: 100,
        },
      }),
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 space-y-8">
      <header>
        <div className="text-xs text-muted-foreground uppercase tracking-wider">
          Por tipo de dados
        </div>
        <h1 className="font-display text-4xl mt-1">Relatórios fiscais</h1>
        <p className="text-muted-foreground mt-3 max-w-3xl leading-relaxed">
          Os relatórios contábeis e fiscais que todo ente federado é obrigado a publicar pela Lei de
          Responsabilidade Fiscal. São três tipos: <strong className="text-foreground">RREO</strong>{" "}
          (Relatório Resumido da Execução Orçamentária, bimestral),{" "}
          <strong className="text-foreground">RGF</strong> (Relatório de Gestão Fiscal,
          quadrimestral ou semestral) e <strong className="text-foreground">DCA</strong> (Declaração
          de Contas Anuais).
        </p>
        <p className="text-muted-foreground mt-2 max-w-3xl leading-relaxed">
          Cada linha abaixo é um valor declarado por um ente: combinação de <em>anexo</em> e{" "}
          <em>coluna</em> do relatório (ex.: Anexo 1 do RREO = Balanço Orçamentário), a{" "}
          <em>conta</em> contábil, o <em>valor</em> e o <em>exercício/período</em> a que se refere.
        </p>
      </header>

      <FontesDoTema fontes={[{ label: "SICONFI (Tesouro Nacional)", to: "/siconfi" }]} />

      <AvisoMetodologico />

      <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-4">
          <select
            value={uf}
            onChange={(e) => setUf(e.target.value)}
            className="rounded-md border bg-background px-3 py-2 text-sm"
          >
            {UFS.map((u) => (
              <option key={u} value={u}>
                {u || "Todas UFs"}
              </option>
            ))}
          </select>
          <input
            type="number"
            value={exercicio}
            onChange={(e) => setExercicio(e.target.value ? Number(e.target.value) : "")}
            placeholder="Exercício"
            className="rounded-md border bg-background px-3 py-2 text-sm"
          />
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className="rounded-md border bg-background px-3 py-2 text-sm"
          >
            {TIPOS.map((t) => (
              <option key={t} value={t}>
                {t || "Todos relatórios"}
              </option>
            ))}
          </select>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar conta..."
            className="rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>
      </section>

      <section>
        {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {!isLoading && (data?.relatorios.length ?? 0) === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhum relatório disponível para os filtros selecionados.
          </p>
        )}
        {(data?.relatorios.length ?? 0) > 0 && (
          <div className="flex justify-end mb-2">
            <button
              onClick={() =>
                downloadCSV(`siconfi_${uf || "todos"}_${exercicio || "todos"}`, data!.relatorios)
              }
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted"
            >
              <Download className="size-3.5" /> Exportar CSV
            </button>
          </div>
        )}
        <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
          {(data?.relatorios ?? []).map((r) => (
            <li key={r.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Landmark className="size-4 text-muted-foreground" />
                    {r.ente_nome}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {[r.uf, r.esfera, r.tipo_relatorio, r.anexo, r.coluna]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                  {r.conta && <div className="text-sm mt-1">{r.conta}</div>}
                </div>
                <div className="text-right shrink-0">
                  <div className="font-medium">{fmtBRL(r.valor)}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.exercicio}
                    {r.periodo ? ` · P${r.periodo}` : ""}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
