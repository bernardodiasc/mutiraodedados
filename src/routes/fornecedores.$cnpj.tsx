import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useData, useDataSource } from "@/lib/data-store";
import { EmptyState } from "@/components/EmptyState";
import { SerieAnualChart } from "@/components/SerieAnualChart";
import { FlagsCidada } from "@/components/FlagsCidada";
import { BotaoCopiar } from "@/components/BotaoCopiar";
import { BotaoSalvarItem } from "@/components/BotaoSalvarItem";
import { BotaoFonteOficial } from "@/components/BotaoFonteOficial";
import { textoCopiavelDeEntidade } from "@/lib/itens-salvos/logic";
import { linkFornecedorPortal } from "@/lib/links-oficiais";
import { DoacoesEleitoraisContainer as DoacoesEleitorais } from "@/containers/DoacoesEleitoraisContainer";
import { GrafoFornecedor, type GrafoNo } from "@/components/GrafoFornecedor";
import { RadarRisco, type RadarEixo } from "@/components/RadarRisco";
import { MetodologiaPopover } from "@/components/MetodologiaPopover";
import { fmtBRL } from "@/lib/fmt";
import { sanitizarTextoPublico } from "@/lib/sanitize";

export const Route = createFileRoute("/fornecedores/$cnpj")({
  component: FornecedorDetail,
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-4 py-20 text-center">
      <h1 className="font-display text-3xl">Fornecedor não encontrado</h1>
      <p className="text-sm text-muted-foreground mt-2">Carregue contratos de um órgão em /orgaos para que seus fornecedores apareçam aqui.</p>
    </div>
  ),
  errorComponent: ({ error }) => <div className="mx-auto max-w-3xl px-4 py-20"><h1 className="font-display text-2xl">Erro</h1><p>{error.message}</p></div>,
});

function FornecedorDetail() {
  const { cnpj } = Route.useParams();
  const { hydrated } = useData();
  const ds = useDataSource();
  if (!hydrated) {
    return <div className="mx-auto max-w-3xl px-4 py-20 text-center text-muted-foreground">Carregando…</div>;
  }
  const f = ds.getFornecedor(cnpj);
  if (!f) throw notFound();
  const contratos = ds.contratosFornecedor(cnpj);
  const serie = ds.serieAnualFornecedor(cnpj);
  const total = serie.reduce((s,x)=>s+x.valor, 0);

  if (contratos.length === 0) return <div className="mx-auto max-w-3xl px-4 py-20"><EmptyState title="Sem contratos para este fornecedor" /></div>;

  // grafo
  const porOrgao = new Map<string, number>();
  for (const c of contratos) porOrgao.set(c.orgaoCod, (porOrgao.get(c.orgaoCod) ?? 0) + c.valor);
  const nos: GrafoNo[] = [...porOrgao.entries()].map(([cod, valor]) => {
    const o = ds.getOrgao(cod);
    return { id: cod, label: o?.sigla ?? cod, valor };
  });

  // sinais simples
  const pctDispensa = contratos.filter(c => c.modalidade === "dispensa").length / contratos.length;
  const dispAltoValor = contratos.filter(c => c.modalidade === "dispensa" && c.valor >= 50_000).length;
  const orgaoUnico = porOrgao.size === 1;

  // radar de risco — eixos 0..1 a partir dos contratos DESTE fornecedor (sinal, nunca prova)
  const ticketMedio = contratos.length > 0 ? total / contratos.length : 0;
  const maiorOrgao = porOrgao.size > 0 ? Math.max(...porOrgao.values()) : 0;
  const eixos: RadarEixo[] = [
    {
      label: "Concentração",
      valor: total > 0 ? maiorOrgao / total : 0,
      descricao: `Maior órgão = ${total > 0 ? ((maiorOrgao / total) * 100).toFixed(0) : "0"}% do recebido.`,
    },
    {
      label: "% Dispensa",
      valor: pctDispensa,
      descricao: `${(pctDispensa * 100).toFixed(0)}% dos contratos sem licitação.`,
    },
    {
      label: "Ticket médio",
      valor: Math.min(1, ticketMedio / 500_000),
      descricao: `${fmtBRL(ticketMedio)} por contrato (ref. R$ 500k).`,
    },
    {
      label: "Dispensa alto valor",
      valor: Math.min(1, dispAltoValor / contratos.length),
      descricao: `${dispAltoValor} dispensa(s) ≥ R$ 50k.`,
    },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <Link to="/orgaos" className="text-sm text-muted-foreground hover:text-foreground">← Voltar</Link>
      <h1 className="font-display text-4xl mt-3">{f.nome}</h1>
      <div className="font-mono text-sm text-muted-foreground">CNPJ {f.cnpj}</div>
      <div className="mt-4 flex flex-wrap gap-2">
        <BotaoCopiar
          obterTexto={() =>
            textoCopiavelDeEntidade(`Fornecedor ${f.nome} — CNPJ ${f.cnpj}`, null, {
              fornecedor: f,
              total_recebido: total,
              contratos: contratos.length,
            })
          }
          rotulo="Copiar dados"
          mensagemToast="Dados do fornecedor copiados — cole na sua IA"
        />
        <BotaoSalvarItem
          entidadeTipo="fornecedor"
          entidadeId={f.cnpj}
          titulo={f.nome}
          url={`/fornecedores/${f.cnpj}`}
          snapshotDe={{ fornecedor: f, total_recebido: total, contratos: contratos.length }}
        />
        <BotaoFonteOficial href={linkFornecedorPortal(f.cnpj)} rotulo="Ver no Portal" />
      </div>

      <div className="mt-8 grid sm:grid-cols-3 gap-4">
        <Stat label="Recebido (total)" value={fmtBRL(total)} />
        <Stat label="Contratos" value={contratos.length.toString()} />
        <Stat label="Órgãos contratantes" value={new Set(contratos.map(c=>c.orgaoCod)).size.toString()} />
      </div>

      <div className="mt-4 border border-dashed border-border rounded-xl p-4 bg-card text-sm text-muted-foreground">
        <strong className="text-foreground">Sinais a observar:</strong>{" "}
        {orgaoUnico && <span className="mr-2">contrata apenas com 1 órgão · </span>}
        {pctDispensa > 0.5 && <span className="mr-2">{(pctDispensa*100).toFixed(0)}% dos contratos por dispensa · </span>}
        {dispAltoValor > 0 && <span className="mr-2">{dispAltoValor} dispensa(s) ≥ R$ 50k · </span>}
        <span>nada disso, isoladamente, é irregular — são pontos para começar a olhar.</span>
      </div>

      <div className="mt-10 grid lg:grid-cols-2 gap-6">
        <div>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="font-display text-2xl">Radar de risco</h2>
            <MetodologiaPopover titulo="Eixos do radar">
              <p>Cada eixo é normalizado de 0 a 1 a partir dos contratos deste fornecedor. Quanto mais próximo da borda, mais atenção o eixo merece — sempre como sinal, nunca como prova.</p>
            </MetodologiaPopover>
          </div>
          <div className="border border-border rounded-xl p-4 bg-card">
            <RadarRisco eixos={eixos} />
          </div>
        </div>
        <div>
          <h2 className="font-display text-2xl mb-3">Evolução do recebido</h2>
          <div className="border border-border rounded-xl p-4 bg-card"><SerieAnualChart data={serie} /></div>
        </div>
      </div>

      {nos.length > 1 && (
        <div className="mt-10">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="font-display text-2xl">Mapa de relacionamento</h2>
            <MetodologiaPopover titulo="Como ler o grafo">
              <p>O fornecedor está no centro. Cada satélite é um órgão contratante. Espessura da aresta e tamanho do nó são proporcionais ao volume contratado.</p>
              <p>Concentração em poucos órgãos não é, por si só, irregular — depende do mercado e do objeto.</p>
            </MetodologiaPopover>
          </div>
          <div className="border border-border rounded-xl p-4 bg-card">
            <GrafoFornecedor central={f.nome} nos={nos} />
          </div>
        </div>
      )}

      <div className="mt-10">
        <DoacoesEleitorais cnpj={cnpj} />
      </div>

      <div className="mt-10 grid lg:grid-cols-2 gap-6">
        <div>
          <h2 className="font-display text-2xl mb-3">Contratos</h2>
          <div className="border border-border rounded-xl bg-card divide-y divide-border">
            {contratos.slice(0, 12).map(c => (
              <Link key={c.id} to="/contratos/$id" params={{ id: c.id }} className="block p-4 hover:bg-muted">
                <div className="text-sm font-semibold">{sanitizarTextoPublico(c.objeto)}</div>
                <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground">
                  <span className="font-mono uppercase">{c.modalidade} · {c.ano}</span>
                  <span className="font-mono text-foreground">{fmtBRL(c.valor)}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
        <div>
          <h2 className="font-display text-2xl mb-3">Marcações cidadãs</h2>
          <FlagsCidada entidadeTipo="fornecedor" entidadeId={cnpj} />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border rounded-xl p-5 bg-card">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-display text-2xl mt-1">{value}</div>
    </div>
  );
}
