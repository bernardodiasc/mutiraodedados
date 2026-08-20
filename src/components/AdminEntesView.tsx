import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Database, Search, Layers, CalendarRange } from "lucide-react";
import { IbgeCombobox } from "@/components/IbgeCombobox";
import {
  UFS,
  PRESETS,
  sanitizeIbge,
  estimativaVarredura,
  escopoDoEnte,
  rotuloEscopo,
  nomePeriodoFiscal,
  rotuloPeriodoFiscal,
} from "@/lib/admin-entes/logic";
import type { ConjuntoSiconfi } from "@/lib/data/siconfi/varredura";

export type ProgressoVarredura = {
  consultas: number;
  total: number;
  percentual: number;
  importados: number;
  semDados: number;
} | null;

/**
 * Progresso de uma varredura paginada (PNCP, Transferegov). Diferente do
 * SICONFI, aqui não há total conhecido — a origem só diz se há mais páginas —,
 * então mostramos o que É sabido: rodada, registros e página, mais o último
 * erro quando a origem reclama. Antes disto o único sinal era um ícone girando.
 */
export type ProgressoFonte = {
  rodada: number;
  importados: number;
  cursor: number;
  erro: string | null;
} | null;

export type AdminEntesViewProps = {
  ano: number;
  mes: number;
  setAno: (n: number) => void;
  setMes: (n: number) => void;
  anos: readonly number[];
  meses: readonly string[];
  ini: string;
  fim: string;
  ibge: string;
  setIbge: (v: string) => void;
  tipoRel: "RREO" | "RGF" | "DCA";
  setTipoRel: (v: "RREO" | "RGF" | "DCA") => void;
  /** Derivado do mês — o RREO é bimestral e o RGF quadrimestral. */
  periodo: number;
  exer: number;
  setExer: (v: number) => void;
  /** Alguma fonte está importando — trava só a troca de contexto. */
  ocupado: boolean;
  busy: (k: string) => boolean;
  progressoFontes: Record<string, ProgressoFonte>;
  onCancelarFonte: (label: string) => void;
  onImportPncp: () => void;
  onImportSiconfi: () => void;
  onImportSiconfiConjunto: () => void;
  onImportTransferegov: () => void;
  onImportIbge: () => void;
  onEnriquecerOrigem: () => void;
  // Varredura em massa do SICONFI
  conjunto: ConjuntoSiconfi;
  setConjunto: (v: ConjuntoSiconfi) => void;
  ufVarredura: string;
  setUfVarredura: (v: string) => void;
  exIni: number;
  setExIni: (v: number) => void;
  exFim: number;
  setExFim: (v: number) => void;
  progresso: ProgressoVarredura;
  onVarrerSiconfi: () => void;
  onCancelarVarredura: () => void;
};

const CONJUNTOS: Array<{ id: ConjuntoSiconfi; label: string; ajuda: string }> = [
  { id: "ufs", label: "Estados + DF", ajuda: "Os 27 governos estaduais." },
  { id: "capitais", label: "Capitais", ajuda: "As 27 prefeituras de capital." },
  {
    id: "municipios",
    label: "Municípios de uma UF",
    ajuda: "Todos os municípios da UF escolhida.",
  },
  { id: "ente", label: "Só o ente selecionado", ajuda: "O ente escolhido no topo da tela." },
];

/**
 * O alvo da importação, mostrado como DADO e não como prosa.
 *
 * Antes isto era um parágrafo que explicava o que cada fonte *não* fazia —
 * o que só piorava: a divergência de escopo entre as fontes foi eliminada,
 * e o que resta é dizer, em campos legíveis, sobre quem e sobre quando a
 * importação vai rodar.
 */
function Alvo({ itens }: { itens: Array<{ rotulo: string; valor: string }> }) {
  return (
    <dl className="flex flex-wrap gap-x-6 gap-y-1 rounded-lg border border-border bg-background px-3 py-2">
      {itens.map((i) => (
        <div key={i.rotulo} className="flex items-baseline gap-1.5">
          <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{i.rotulo}</dt>
          <dd className="text-xs font-medium">{i.valor}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Progresso de uma varredura sem total conhecido. A barra pulsa em vez de
 * medir — inventar percentual sobre um total que a origem não informa seria
 * mentira. O que informa de verdade são os números e o último erro.
 */
function ProgressoPaginado({
  progresso,
  rodando,
  onParar,
}: {
  progresso: ProgressoFonte;
  rodando: boolean;
  onParar: () => void;
}) {
  if (!progresso) return null;
  return (
    <div className="rounded-lg border border-border bg-background p-3 space-y-2">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-medium">
          {progresso.importados.toLocaleString("pt-BR")} registros · rodada{" "}
          {progresso.rodada.toLocaleString("pt-BR")} · página{" "}
          {progresso.cursor.toLocaleString("pt-BR")}
        </span>
        {rodando && (
          <Button variant="outline" size="sm" className="h-6 px-2 text-xs" onClick={onParar}>
            Parar
          </Button>
        )}
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={
            rodando
              ? "h-full w-1/3 animate-pulse rounded-full bg-accent"
              : "h-full w-full rounded-full bg-muted-foreground/30"
          }
        />
      </div>
      {progresso.erro && (
        <p className="text-xs text-destructive break-words">
          Última resposta da origem: {progresso.erro}
        </p>
      )}
    </div>
  );
}

function Secao({
  icone,
  titulo,
  descricao,
  destaque,
  children,
}: {
  icone: React.ReactNode;
  titulo: string;
  descricao: React.ReactNode;
  destaque?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={
        destaque
          ? "rounded-xl border-2 border-accent/40 bg-accent/5 p-5 space-y-3"
          : "rounded-xl border border-border bg-card p-5 space-y-3"
      }
    >
      <h3 className="font-display text-lg flex items-center gap-2">
        {icone} {titulo}
      </h3>
      <p className="text-sm text-muted-foreground">{descricao}</p>
      {children}
    </section>
  );
}

export function AdminEntesView(props: AdminEntesViewProps) {
  const {
    ano,
    mes,
    setAno,
    setMes,
    anos,
    meses,
    ini,
    fim,
    ibge,
    setIbge,
    tipoRel,
    setTipoRel,
    periodo,
    exer,
    setExer,
    ocupado,
    busy,
    progressoFontes,
    onCancelarFonte,
    onImportPncp,
    onImportSiconfi,
    onImportSiconfiConjunto,
    onImportTransferegov,
    onImportIbge,
    onEnriquecerOrigem,
    conjunto,
    setConjunto,
    ufVarredura,
    setUfVarredura,
    exIni,
    setExIni,
    exFim,
    setExFim,
    progresso,
    onVarrerSiconfi,
    onCancelarVarredura,
  } = props;

  const escopo = escopoDoEnte(ibge);
  // As três fontes usam o MESMO ente e a MESMA janela — o alvo é um só.
  const alvoItens = [
    { rotulo: "ente", valor: rotuloEscopo(escopo) },
    { rotulo: "janela", valor: `${ini} → ${fim}` },
  ];
  const varrendo = busy("Varredura SICONFI");
  const precisaUf = conjunto === "municipios" && !ufVarredura;
  const precisaEnte = conjunto === "ente" && !ibge;

  return (
    <div className="space-y-6">
      <Secao
        icone={<Search className="size-4 text-accent" />}
        titulo="1. Contexto — de quem e de quando"
        descricao={
          <>
            As três fontes abaixo descrevem o <strong>mesmo ente federativo</strong> por ângulos
            diferentes: o que ele <strong>recebe</strong> da União (Transferegov), o que{" "}
            <strong>declara</strong> das próprias contas (SICONFI) e o que <strong>contrata</strong>{" "}
            (PNCP). No site, o cidadão vê as três lado a lado em <code>/explorar</code>. Cada uma
            usa um recorte próprio — os cartões dizem qual.
          </>
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Ente federativo
            </Label>
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <div className="mt-1">
                  <IbgeCombobox value={ibge} onChange={setIbge} disabled={ocupado} />
                </div>
              </div>
              <Input
                value={ibge}
                onChange={(e) => setIbge(sanitizeIbge(e.target.value))}
                placeholder="código IBGE"
                className="w-36 font-mono"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((pr) => (
                <Button
                  key={pr.codigo}
                  type="button"
                  size="sm"
                  variant={ibge === pr.codigo ? "default" : "outline"}
                  className="h-7 px-2 text-xs"
                  onClick={() => setIbge(pr.codigo)}
                >
                  {pr.nome}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              2 dígitos = UF (<code>35</code>), 7 = município (<code>3550308</code>).
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Período
            </Label>
            <div className="flex flex-wrap items-end gap-3 text-sm">
              <div>
                <Label className="text-xs">Mês</Label>
                <select
                  className="mt-1 block rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                  value={mes}
                  onChange={(e) => setMes(Number(e.target.value))}
                  disabled={ocupado}
                >
                  {meses.map((nm, i) => (
                    <option key={nm} value={i + 1}>
                      {nm}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-xs">Ano</Label>
                <select
                  className="mt-1 block rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                  value={ano}
                  onChange={(e) => setAno(Number(e.target.value))}
                  disabled={ocupado}
                >
                  {anos.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Janela consultada: <code>{ini}</code> → <code>{fim}</code>. Usada por PNCP e
              Transferegov; o SICONFI trabalha por exercício e período fiscal próprios.
            </p>
          </div>
        </div>
      </Secao>

      <Secao
        icone={<Database className="size-4 text-accent" />}
        titulo="2. SICONFI — o que o ente declara das próprias contas"
        descricao={
          <>
            Relatórios fiscais que o ente declara ao Tesouro: RREO (bimestral), RGF (quadrimestral)
            e DCA (anual). O período vem do mês escolhido acima.
          </>
        }
      >
        <Alvo
          itens={[
            { rotulo: "ente", valor: rotuloEscopo(escopo) },
            { rotulo: "exercício", valor: String(exer) },
            { rotulo: nomePeriodoFiscal(tipoRel), valor: rotuloPeriodoFiscal(mes, tipoRel) },
          ]}
        />
        <div className="flex flex-wrap gap-2 items-end">
          <div>
            <Label className="text-xs">Exercício</Label>
            <Input
              type="number"
              value={exer}
              onChange={(e) => setExer(Number(e.target.value))}
              className="mt-1 w-28"
            />
          </div>
          <div>
            <Label className="text-xs">Relatório</Label>
            <select
              value={tipoRel}
              onChange={(e) => setTipoRel(e.target.value as "RREO" | "RGF" | "DCA")}
              className="mt-1 block rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="RREO">RREO (bimestral)</option>
              <option value="RGF">RGF (quadrimestral)</option>
              <option value="DCA">DCA (anual)</option>
            </select>
          </div>
          <Button variant="outline" disabled={busy("SICONFI") || !ibge} onClick={onImportSiconfi}>
            {busy("SICONFI") ? <Loader2 className="size-4 animate-spin" /> : "Importar 1 relatório"}
          </Button>
          <Button
            variant="outline"
            disabled={busy("SICONFI conjunto") || !ibge}
            onClick={onImportSiconfiConjunto}
          >
            {busy("SICONFI conjunto") ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              "Importar o ano todo (10 relatórios)"
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          O botão “o ano todo” ignora o período acima e traz as 10 consultas do exercício: os 6
          bimestres do RREO, os 3 quadrimestres do RGF e o DCA.
        </p>

        <details className="rounded-lg border border-border bg-background">
          <summary className="cursor-pointer px-3 py-2 text-sm font-medium marker:text-muted-foreground">
            Varredura em massa — carga histórica de muitos entes
          </summary>
          <div className="border-t border-border p-3 space-y-3">
            <p className="text-sm text-muted-foreground">
              Para trazer o histórico de muitos entes de uma vez, em vez de um relatório por vez.
              Percorre <strong>ente × exercício × relatório</strong> e é retomável: roda em blocos
              limitados por tempo, salva onde parou e continua sozinha até terminar.
            </p>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Conjunto de entes</Label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {CONJUNTOS.map((c) => (
                    <Button
                      key={c.id}
                      type="button"
                      size="sm"
                      variant={conjunto === c.id ? "default" : "outline"}
                      className="h-8 text-xs"
                      disabled={varrendo}
                      onClick={() => setConjunto(c.id)}
                      title={c.ajuda}
                    >
                      {c.label}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {CONJUNTOS.find((c) => c.id === conjunto)?.ajuda}
                </p>
              </div>

              <div className="flex flex-wrap gap-3 items-end">
                {conjunto === "municipios" && (
                  <div>
                    <Label className="text-xs">UF</Label>
                    <select
                      value={ufVarredura}
                      onChange={(e) => setUfVarredura(e.target.value)}
                      disabled={varrendo}
                      className="mt-1 block rounded-md border bg-background px-3 py-2 text-sm"
                    >
                      {UFS.map((u) => (
                        <option key={u} value={u}>
                          {u || "Escolha a UF…"}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <Label className="text-xs">Exercício inicial</Label>
                  <Input
                    type="number"
                    value={exIni}
                    disabled={varrendo}
                    onChange={(e) => setExIni(Number(e.target.value))}
                    className="mt-1 w-28"
                  />
                </div>
                <div>
                  <Label className="text-xs">Exercício final</Label>
                  <Input
                    type="number"
                    value={exFim}
                    disabled={varrendo}
                    onChange={(e) => setExFim(Number(e.target.value))}
                    className="mt-1 w-28"
                  />
                </div>
                <Button
                  disabled={varrendo || precisaUf || precisaEnte}
                  onClick={onVarrerSiconfi}
                  title={
                    precisaUf
                      ? "Escolha a UF"
                      : precisaEnte
                        ? "Escolha o ente no topo da tela"
                        : undefined
                  }
                >
                  {varrendo ? <Loader2 className="size-4 animate-spin" /> : "Iniciar varredura"}
                </Button>
                {varrendo && (
                  <Button variant="outline" onClick={onCancelarVarredura}>
                    Parar
                  </Button>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                Volume estimado: <strong>{estimativaVarredura(conjunto, exIni, exFim)}</strong>.
                Consulta sem dados não é erro — o SICONFI não tem todo relatório de todo ente em
                todo exercício.
              </p>

              {progresso && (
                <div className="rounded-lg border border-border bg-background p-3 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium">
                      {progresso.consultas.toLocaleString("pt-BR")} de{" "}
                      {progresso.total.toLocaleString("pt-BR")} consultas
                    </span>
                    <span className="text-muted-foreground">{progresso.percentual}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-accent transition-all"
                      style={{ width: `${progresso.percentual}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {progresso.importados.toLocaleString("pt-BR")} linhas importadas ·{" "}
                    {progresso.semDados.toLocaleString("pt-BR")} consultas sem dados
                  </p>
                </div>
              )}
            </div>
          </div>
        </details>
      </Secao>

      <Secao
        icone={<CalendarRange className="size-4 text-accent" />}
        titulo="3. PNCP — o que o ente contrata"
        descricao={
          <>
            Contratos da Lei 14.133 publicados na janela acima, de todos os entes. A varredura é
            retomável e continua sozinha até fechar o mês.
          </>
        }
      >
        <Alvo itens={alvoItens} />
        <div className="flex flex-wrap gap-2 items-end">
          <Button disabled={busy("PNCP")} onClick={onImportPncp}>
            {busy("PNCP") ? <Loader2 className="size-4 animate-spin" /> : "Importar PNCP"}
          </Button>
        </div>
        <ProgressoPaginado
          progresso={progressoFontes["PNCP"] ?? null}
          rodando={busy("PNCP")}
          onParar={() => onCancelarFonte("PNCP")}
        />
      </Secao>

      <Secao
        icone={<CalendarRange className="size-4 text-accent" />}
        titulo="4. Convênios — o que o ente recebe da União"
        descricao={
          <>
            Transferências voluntárias da União ao ente: convênios e contratos de repasse assinados
            na janela acima. Vêm do Portal da Transparência, que espelha o Transferegov — o sistema
            de origem ainda não publica API aberta destes instrumentos. Varredura retomável.
          </>
        }
      >
        <Alvo itens={alvoItens} />
        <Button disabled={busy("Transferegov")} onClick={onImportTransferegov}>
          {busy("Transferegov") ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            "Importar convênios"
          )}
        </Button>
        <ProgressoPaginado
          progresso={progressoFontes["Transferegov"] ?? null}
          rodando={busy("Transferegov")}
          onParar={() => onCancelarFonte("Transferegov")}
        />
        {/* v0.10.0: o CSV oficial do SICONV traz o que o espelho não publica —
            situação corrente e execução financeira. Enriquece por código,
            nunca sobrescreve o que veio do espelho. */}
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <Button variant="outline" disabled={busy("Origem SICONV")} onClick={onEnriquecerOrigem}>
            {busy("Origem SICONV") ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              "Enriquecer pela origem (CSV do SICONV)"
            )}
          </Button>
          <span className="text-xs text-muted-foreground">
            ~287 mil convênios; retomável, várias rodadas.
          </span>
        </div>
        <ProgressoPaginado
          progresso={progressoFontes["Origem SICONV"] ?? null}
          rodando={busy("Origem SICONV")}
          onParar={() => onCancelarFonte("Origem SICONV")}
        />
      </Secao>

      <Secao
        icone={<Database className="size-4 text-accent" />}
        titulo="5. IBGE — cadastro de municípios"
        descricao={
          <>
            Os 5.570 municípios (código IBGE, nome e UF) que alimentam o seletor de ente acima e as
            varreduras por município. Cadastro vigente — reimportar atualiza; não depende do mês
            selecionado.
          </>
        }
      >
        <Button disabled={busy("IBGE")} onClick={onImportIbge}>
          {busy("IBGE") ? <Loader2 className="size-4 animate-spin" /> : "Importar cadastro"}
        </Button>
        <ProgressoPaginado
          progresso={progressoFontes["IBGE"] ?? null}
          rodando={busy("IBGE")}
          onParar={() => onCancelarFonte("IBGE")}
        />
      </Secao>
    </div>
  );
}
