import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import * as React from "react";
import { ExternalLink } from "lucide-react";
import {
  listarQualidadePublico,
  agregadoQualidade,
  STATUS_QA,
} from "@/lib/data/qa.functions";
import { TIPO_SINAL_LABEL, type AnomaliaTipoSinal } from "@/lib/anomalia";
import {
  FONTE_SINAL_LABEL,
  FONTES_QA_CATALOGO,
  REGRAS_PERSISTIDAS,
  SINAIS_CATALOGO,
} from "@/lib/sinais-catalogo";
import { BoxComoLerSinais } from "@/components/BoxComoLerSinais";
import { AvisoMetodologico } from "@/components/AvisoMetodologico";

export const Route = createFileRoute("/qualidade")({
  component: QualidadePage,
  head: () => ({
    meta: [
      { title: "Qualidade dos dados — Mutirão de Dados" },
      {
        name: "description",
        content:
          "Inconsistências detectadas nas bases públicas, revalidadas contra a fonte oficial e, quando confirmadas, reportadas ao órgão responsável.",
      },
      {
        property: "og:title",
        content: "Qualidade dos dados — Mutirão de Dados",
      },
      {
        property: "og:description",
        content:
          "Acompanhe os defeitos detectados nas APIs do governo: o que está aberto, o que já foi reportado e o que foi corrigido na origem.",
      },
    ],
  }),
});

// Derivado do catálogo central — inclui todas as fontes com regras persistidas
// (tse e tse-cruzamento ficavam de fora da lista hardcoded antiga).
const FONTES = FONTES_QA_CATALOGO;

const TIPOS_SINAL = ["qualidade", "lacuna", "investigativo"] as const;

// Regras persistidas da página, na ordem do catálogo: ativas primeiro.
const SINAIS_DA_PAGINA = [...SINAIS_CATALOGO]
  .filter((s) => s.persistencia === "banco")
  .sort((a, b) => Number(b.ativa) - Number(a.ativa));

const SEV_COLOR: Record<string, string> = {
  critico: "bg-destructive/15 text-destructive",
  aviso: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  info: "bg-muted text-muted-foreground",
};

const STATUS_LABEL: Record<string, string> = {
  aberto: "Aberto",
  confirmado: "Confirmado",
  reportado: "Reportado ao órgão",
  corrigido_origem: "Corrigido na origem",
  corrigido_automaticamente: "Corrigido automaticamente",
  falso_positivo: "Falso positivo",
  wontfix: "Não será corrigido",
};

function fmtBRL(n?: number | null) {
  if (n == null) return "—";
  return Number(n).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

const EMPTY_AGG = {
  fontes: [] as { fonte: string }[],
  regras: [] as string[],
  porFonte: {} as Record<string, number>,
  porStatus: {} as Record<string, number>,
  porRegra: {} as Record<string, number>,
  porTipo: {} as Record<string, number>,
};

function toggleSet(prev: Set<string>, v: string): Set<string> {
  const n = new Set(prev);
  if (n.has(v)) n.delete(v);
  else n.add(v);
  return n;
}

function QualidadePage() {
  const fetchAgg = useServerFn(agregadoQualidade);
  const fetchList = useServerFn(listarQualidadePublico);
  // Multi-seleção por grupo: cada filtro é um conjunto; os 3 combinam em E.
  const [fontesSel, setFontesSel] = React.useState<Set<string>>(new Set());
  const [statusSel, setStatusSel] = React.useState<Set<string>>(new Set());
  const [regrasSel, setRegrasSel] = React.useState<Set<string>>(new Set());
  const [tiposSel, setTiposSel] = React.useState<Set<string>>(new Set());

  const { data: aggData = EMPTY_AGG } = useQuery({
    queryKey: ["qa-agg-pub"],
    queryFn: () => fetchAgg(),
    staleTime: 60_000,
  });
  const fontesArr = [...fontesSel];
  const statusArr = [...statusSel];
  const regrasArr = [...regrasSel];
  const tiposArr = [...tiposSel] as AnomaliaTipoSinal[];
  const { data: findings = [], isLoading } = useQuery({
    queryKey: [
      "qa-list-pub",
      fontesArr.join(","),
      statusArr.join(","),
      regrasArr.join(","),
      tiposArr.join(","),
    ],
    queryFn: () =>
      fetchList({
        data: {
          fontes: fontesArr,
          statuses: statusArr,
          regras: regrasArr,
          tipos: tiposArr,
          limit: 200,
        },
      }),
    staleTime: 60_000,
  });

  // Regras a exibir: a lista canônica do catálogo + quaisquer regras vistas no
  // agregado (cobre regras legadas ainda presentes no banco).
  const regrasAll = Array.from(
    new Set<string>([...REGRAS_PERSISTIDAS, ...Object.keys(aggData.porRegra)]),
  );
  const algumFiltro = fontesSel.size + statusSel.size + regrasSel.size + tiposSel.size > 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 space-y-10">
      <header>
        <span className="inline-block text-xs font-semibold tracking-widest text-accent uppercase">
          Transparência da plataforma
        </span>
        <h1 className="font-display text-5xl leading-[0.95] mt-2">
          Qualidade dos dados
        </h1>
        <p className="mt-6 text-lg text-muted-foreground max-w-3xl">
          Inconsistências nas bases públicas são detectadas automaticamente
          durante a importação dos dados. Em seguida, nossa equipe revalida
          manualmente cada suspeita contra a API oficial e, quando o defeito
          está na fonte, reporta ao órgão responsável. Esta página é o
          registro público desse processo — o objetivo é que ela fique vazia.
        </p>
        <div className="mt-6 rounded-lg border border-border bg-card/50 p-4 text-sm text-muted-foreground max-w-3xl space-y-2">
          <p>
            Esta verificação faz parte do processo automatizado de{" "}
            <Link to="/cobertura" className="text-accent underline">
              cobertura
            </Link>{" "}
            — acompanhe ali quais bases já foram ingeridas e em que período.
          </p>
          <p>
            Aqui tratamos apenas de <strong>falhas técnicas</strong> nos dados
            (valores corrompidos, campos ausentes, divergências com a fonte).
            Suspeitas sobre o <em>uso</em> de verba pública — sinais
            investigativos — ficam em{" "}
            <Link to="/anomalias" className="text-accent underline">
              /anomalias
            </Link>
            .
          </p>
          <p>
            Encontrou algo que parece errado e não está listado? Cidadãos podem{" "}
            <Link to="/contestar" className="text-accent underline">
              contestar um registro
            </Link>{" "}
            ou registrar uma{" "}
            <Link to="/minhas-marcacoes" className="text-accent underline">
              marcação cidadã
            </Link>
            .
          </p>
        </div>
      </header>

      <BoxComoLerSinais
        titulo="Como ler esta página: regras, status e o processo"
        sinais={SINAIS_DA_PAGINA}
        descricao={
          <>
            <p>
              Cada <strong>suspeita</strong> nasce de uma <strong>regra</strong> aplicada na importação
              (só com o dado em cache), passa por uma <strong>re-checagem</strong> contra a API oficial
              e, se o defeito for real e estiver na fonte, é <strong>reportada</strong> ao órgão.
              A tabela abaixo é o catálogo completo das regras persistidas, nos três tipos de sinal.
            </p>
            <p>
              Nos contratos da CGU, a importação cruza a <strong>listagem</strong> com o{" "}
              <strong>detalhe</strong> (<code>/contratos/id</code>) de cada contrato: o bug de escala
              (÷10.000) da API aparece em qualquer um dos dois endpoints, e gravamos sempre o valor{" "}
              <strong>não-truncado</strong>, que bate com o documento oficial.{" "}
              <strong>Limitação conhecida:</strong> se as duas leituras vierem truncadas na mesma
              escala ao mesmo tempo, a divergência é indetectável naquele momento — o valor é
              corrigido numa leitura futura e o histórico fica registrado no alerta.
            </p>
          </>
        }
      >
        <div>
          <h3 className="font-medium text-foreground mb-1.5">Status</h3>
          <ul className="space-y-1.5">
            <li><strong>Aberto</strong> — detectado, ainda não analisado.</li>
            <li><strong>Confirmado</strong> — re-checado contra a fonte oficial; a divergência é real.</li>
            <li><strong>Reportado</strong> — encaminhado ao órgão responsável.</li>
            <li><strong>Corrigido na origem</strong> — a fonte oficial corrigiu o dado numa reimportação posterior (a API passou a devolver o valor certo).</li>
            <li><strong>Corrigido automaticamente</strong> — a nossa conferência por detalhe corrigiu o valor no site (a fonte ainda não corrigiu); o alerta fica como registro do defeito.</li>
            <li><strong>Falso positivo</strong> — analisado e descartado: não havia defeito.</li>
            <li><strong>Wontfix</strong> — defeito conhecido que, por decisão, não será tratado.</li>
          </ul>
        </div>
      </BoxComoLerSinais>

      <section className="space-y-3">
        <div className="rounded-xl border border-border bg-card/50 p-3 space-y-2.5">
          <FilterGroup
            titulo="Fontes"
            itens={FONTES.map((f) => ({ valor: f, rotulo: FONTE_SINAL_LABEL[f] ?? f }))}
            counts={aggData.porFonte}
            sel={fontesSel}
            onToggle={(v) => setFontesSel((s) => toggleSet(s, v))}
          />
          <FilterGroup
            titulo="Tipos"
            itens={TIPOS_SINAL.map((t) => ({ valor: t, rotulo: TIPO_SINAL_LABEL[t] }))}
            counts={aggData.porTipo ?? {}}
            sel={tiposSel}
            onToggle={(v) => setTiposSel((s) => toggleSet(s, v))}
          />
          <FilterGroup
            titulo="Status"
            itens={STATUS_QA.map((s) => ({ valor: s, rotulo: STATUS_LABEL[s] ?? s }))}
            counts={aggData.porStatus}
            sel={statusSel}
            onToggle={(v) => setStatusSel((s) => toggleSet(s, v))}
          />
          <FilterGroup
            titulo="Regras"
            itens={regrasAll.map((r) => ({ valor: r, rotulo: r }))}
            counts={aggData.porRegra}
            sel={regrasSel}
            onToggle={(v) => setRegrasSel((s) => toggleSet(s, v))}
            mono
          />
          {algumFiltro && (
            <button
              type="button"
              className="text-[11px] text-accent underline"
              onClick={() => {
                setFontesSel(new Set());
                setStatusSel(new Set());
                setRegrasSel(new Set());
                setTiposSel(new Set());
              }}
            >
              Limpar filtros
            </button>
          )}
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : findings.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum defeito com esses filtros.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {findings.map((f) => (
              <li key={f.id} className="p-4">
                <div className="block -m-4 p-4 rounded-md">
                  <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wider">
                    <span className={`px-1.5 py-0.5 rounded ${SEV_COLOR[f.severidade]}`}>
                      {f.severidade}
                    </span>
                    {f.tipo_sinal && f.tipo_sinal !== "qualidade" && (
                      <span
                        className={`px-1.5 py-0.5 rounded border ${
                          f.tipo_sinal === "investigativo"
                            ? "bg-destructive/10 text-destructive border-destructive/30"
                            : "bg-accent/10 text-accent border-accent/30"
                        }`}
                      >
                        {TIPO_SINAL_LABEL[f.tipo_sinal]}
                      </span>
                    )}
                    <span className="px-1.5 py-0.5 rounded bg-accent/15 text-accent">
                      {STATUS_LABEL[f.status] ?? f.status}
                    </span>
                    <span className="text-muted-foreground">· {f.fonte}</span>
                    <div className="ml-auto flex flex-col items-end gap-1 normal-case tracking-normal">
                      <span
                        className="text-muted-foreground"
                        title="Data em que esta inconsistência foi detectada — não é a data do contrato"
                      >
                        Aviso emitido em{" "}
                        {new Date(f.detectado_em).toLocaleDateString("pt-BR")}
                      </span>
                      <div className="flex flex-col items-end gap-0.5 text-[11px]">
                        {f.entidade.url_interno && (
                          <a
                            href={f.entidade.url_interno}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="text-accent inline-flex items-center gap-1"
                          >
                            Registro interno <ExternalLink className="size-3" />
                          </a>
                        )}
                        {f.entidade.url_oficial && (
                          <a
                            href={f.entidade.url_oficial}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="text-accent inline-flex items-center gap-1"
                          >
                            Fonte oficial <ExternalLink className="size-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 text-sm">
                    <span className="font-medium">{f.entidade.tipo}</span>{" "}
                    <code className="text-xs">{f.entidade.id}</code>{" "}
                    <span className="text-muted-foreground">— {f.regra}</span>
                  </div>
                  {f.comparacao && (
                    <div className="mt-1 text-xs text-muted-foreground font-mono">
                      {f.comparacao.armazenadoLabel ?? "armazenado"} {fmtBRL(f.comparacao.armazenado)} → {f.comparacao.esperadoLabel ?? "esperado"}{" "}
                      {fmtBRL(f.comparacao.esperado)}
                    </div>
                  )}
                  {f.tipo_sinal === "investigativo" && (
                    <div className="mt-2">
                      <AvisoMetodologico compacto />
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function FilterGroup({
  titulo,
  itens,
  counts,
  sel,
  onToggle,
  mono,
}: {
  titulo: string;
  itens: Array<{ valor: string; rotulo: string }>;
  counts: Record<string, number>;
  sel: Set<string>;
  onToggle: (v: string) => void;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground w-12 shrink-0">
        {titulo}
      </span>
      {itens.map((it) => {
        const n = counts[it.valor] ?? 0;
        const ativo = sel.has(it.valor);
        return (
          <button
            key={it.valor}
            type="button"
            onClick={() => onToggle(it.valor)}
            className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] transition-colors ${
              ativo
                ? "border-accent bg-accent/15 text-accent"
                : "border-border bg-background text-muted-foreground hover:border-accent/50"
            } ${n === 0 && !ativo ? "opacity-50" : ""}`}
          >
            <span className={mono ? "font-mono" : ""}>{it.rotulo}</span>
            <span className={`rounded px-1 tabular-nums ${ativo ? "bg-accent/20" : "bg-muted"}`}>
              {n}
            </span>
          </button>
        );
      })}
    </div>
  );
}