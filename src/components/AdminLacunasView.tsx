import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CircleDashed, FilePlus2, ArrowRightLeft } from "lucide-react";
import { AdminHeader } from "@/components/AdminHeader";
import {
  LACUNA_TIPOS,
  LACUNA_CICLOS,
  type Lacuna,
  type LacunaTipo,
  type LacunaCiclo,
} from "@/lib/lacunas.functions";

/**
 * `/admin/lacunas` — a camada CURADA sobre os findings automáticos.
 *
 * Fecha o fluxo prometido em docs/dominios/laboratorio-civico.md: finding
 * crítico+confirmado vira lacuna sozinho (trigger no banco); os demais são
 * convertidos AQUI, com o admin escrevendo título e descrição em linguagem
 * cidadã. As server functions existiam desde o início — órfãs, sem UI.
 */

export type FindingConversivel = {
  id: string;
  fonte: string;
  regra: string;
  severidade: string;
  status: string;
  entidade_tipo: string;
  entidade_id: string;
};

export type AdminLacunasViewProps = {
  lacunas: Lacuna[];
  isLoading: boolean;
  filtroTipo: string;
  setFiltroTipo: (v: string) => void;
  filtroCiclo: string;
  setFiltroCiclo: (v: string) => void;
  /** Findings ainda sem lacuna, candidatos à conversão manual. */
  findings: FindingConversivel[];
  findingsLoading: boolean;
  onCriar: (dados: {
    titulo: string;
    descricao: string;
    tipo: LacunaTipo;
    publicada: boolean;
  }) => Promise<void>;
  onAtualizar: (
    id: string,
    patch: { ciclo?: LacunaCiclo; publicada?: boolean; resolvida_em?: string | null },
  ) => Promise<void>;
  onConverter: (
    findingId: string,
    dados: { tipo: LacunaTipo; titulo: string; descricao: string },
  ) => Promise<void>;
};

function SelectNativo({
  value,
  onChange,
  opcoes,
  vazio,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  opcoes: readonly string[];
  vazio?: string;
  disabled?: boolean;
}) {
  return (
    <select
      className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    >
      {vazio !== undefined && <option value="">{vazio}</option>}
      {opcoes.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

function FormCriar({ onCriar }: { onCriar: AdminLacunasViewProps["onCriar"] }) {
  const [titulo, setTitulo] = React.useState("");
  const [descricao, setDescricao] = React.useState("");
  const [tipo, setTipo] = React.useState<LacunaTipo>("transparencia");
  const [publicada, setPublicada] = React.useState(true);
  const [salvando, setSalvando] = React.useState(false);
  const valido = titulo.trim().length >= 4 && descricao.trim().length >= 10;

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label className="text-xs">Título (linguagem cidadã)</Label>
          <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label className="text-xs">Tipo</Label>
          <div className="mt-1">
            <SelectNativo
              value={tipo}
              onChange={(v) => setTipo(v as LacunaTipo)}
              opcoes={LACUNA_TIPOS}
            />
          </div>
        </div>
      </div>
      <div>
        <Label className="text-xs">Descrição — o que deveria existir e não é encontrado</Label>
        <textarea
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-24"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
        />
      </div>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={publicada}
            onChange={(e) => setPublicada(e.target.checked)}
          />
          Publicar imediatamente
        </label>
        <Button
          disabled={!valido || salvando}
          onClick={async () => {
            setSalvando(true);
            try {
              await onCriar({
                titulo: titulo.trim(),
                descricao: descricao.trim(),
                tipo,
                publicada,
              });
              setTitulo("");
              setDescricao("");
            } finally {
              setSalvando(false);
            }
          }}
        >
          {salvando ? <Loader2 className="size-4 animate-spin" /> : "Criar lacuna"}
        </Button>
      </div>
    </div>
  );
}

function LinhaFinding({
  f,
  onConverter,
}: {
  f: FindingConversivel;
  onConverter: AdminLacunasViewProps["onConverter"];
}) {
  const [aberto, setAberto] = React.useState(false);
  const [tipo, setTipo] = React.useState<LacunaTipo>("transparencia");
  const [titulo, setTitulo] = React.useState("");
  const [descricao, setDescricao] = React.useState("");
  const [salvando, setSalvando] = React.useState(false);
  const valido = titulo.trim().length >= 4 && descricao.trim().length >= 10;

  return (
    <li className="rounded-lg border border-border bg-background p-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="font-mono text-xs">
          {f.fonte} · {f.regra} · {f.entidade_tipo} {f.entidade_id}
        </span>
        <span className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {f.severidade} · {f.status}
          </span>
          <Button size="sm" variant="outline" onClick={() => setAberto((v) => !v)}>
            <ArrowRightLeft className="size-3.5" /> Converter
          </Button>
        </span>
      </div>
      {aberto && (
        <div className="space-y-2 border-t border-border pt-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              placeholder="Título em linguagem cidadã"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
            />
            <SelectNativo
              value={tipo}
              onChange={(v) => setTipo(v as LacunaTipo)}
              opcoes={LACUNA_TIPOS}
            />
          </div>
          <textarea
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-20"
            placeholder="Descrição: o que deveria existir e não é encontrado"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
          />
          <Button
            size="sm"
            disabled={!valido || salvando}
            onClick={async () => {
              setSalvando(true);
              try {
                await onConverter(f.id, {
                  tipo,
                  titulo: titulo.trim(),
                  descricao: descricao.trim(),
                });
              } finally {
                setSalvando(false);
              }
            }}
          >
            {salvando ? <Loader2 className="size-4 animate-spin" /> : "Converter em lacuna"}
          </Button>
        </div>
      )}
    </li>
  );
}

export function AdminLacunasView(props: AdminLacunasViewProps) {
  const {
    lacunas,
    isLoading,
    filtroTipo,
    setFiltroTipo,
    filtroCiclo,
    setFiltroCiclo,
    findings,
    findingsLoading,
    onCriar,
    onAtualizar,
    onConverter,
  } = props;

  return (
    // Mesmo invólucro das demais telas de admin — sem ele a página saía
    // full-bleed, colada nas bordas da janela, parecendo quebrada.
    <div className="mx-auto max-w-7xl px-4 py-10 space-y-8">
      <AdminHeader titulo="Lacunas">
        Camada curada sobre os findings automáticos: o que deveria existir e não é encontrado nas
        fontes, escrito em linguagem cidadã para o Laboratório Cívico.
      </AdminHeader>

      <section className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h3 className="font-display text-lg flex items-center gap-2">
          <FilePlus2 className="size-4 text-accent" /> Nova lacuna
        </h3>
        <p className="text-sm text-muted-foreground">
          Ausência detectável: algo que deveria existir segundo a regra de negócio ou a lei, mas não
          é encontrado na fonte. Findings críticos confirmados viram lacuna automaticamente; aqui
          entram as manuais.
        </p>
        <FormCriar onCriar={onCriar} />
      </section>

      <section className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h3 className="font-display text-lg flex items-center gap-2">
          <CircleDashed className="size-4 text-accent" /> Lacunas ({lacunas.length})
        </h3>
        <div className="flex flex-wrap gap-2 items-center text-sm">
          <SelectNativo
            value={filtroTipo}
            onChange={setFiltroTipo}
            opcoes={LACUNA_TIPOS}
            vazio="todos os tipos"
          />
          <SelectNativo
            value={filtroCiclo}
            onChange={setFiltroCiclo}
            opcoes={LACUNA_CICLOS}
            vazio="todos os ciclos"
          />
          {isLoading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
        </div>
        {lacunas.length === 0 && !isLoading ? (
          <p className="text-sm text-muted-foreground">Nenhuma lacuna com esse filtro.</p>
        ) : (
          <ul className="space-y-2">
            {lacunas.map((l) => (
              <li
                key={l.id}
                className="rounded-lg border border-border bg-background p-3 space-y-1.5"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium text-sm">{l.titulo}</span>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {l.tipo}
                    {l.origem_qa_finding_id ? " · de finding" : ""}
                    {l.resolvida_em ? " · resolvida" : ""}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{l.descricao}</p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Label className="text-[10px] uppercase tracking-wider">ciclo</Label>
                  <SelectNativo
                    value={l.ciclo}
                    onChange={(v) => onAtualizar(l.id, { ciclo: v as LacunaCiclo })}
                    opcoes={LACUNA_CICLOS}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onAtualizar(l.id, { publicada: !l.publicada })}
                  >
                    {l.publicada ? "Despublicar" : "Publicar"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      onAtualizar(l.id, {
                        resolvida_em: l.resolvida_em ? null : new Date().toISOString(),
                      })
                    }
                  >
                    {l.resolvida_em ? "Reabrir" : "Marcar resolvida"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h3 className="font-display text-lg flex items-center gap-2">
          <ArrowRightLeft className="size-4 text-accent" /> Findings para converter (
          {findings.length})
        </h3>
        <p className="text-sm text-muted-foreground">
          Findings abertos ou confirmados que ainda não têm lacuna. Converter exige reescrever o
          problema em linguagem cidadã — o texto técnico do finding não vai para o público.
        </p>
        {findingsLoading ? (
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        ) : findings.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nada aguardando conversão.</p>
        ) : (
          <ul className="space-y-2">
            {findings.map((f) => (
              <LinhaFinding key={f.id} f={f} onConverter={onConverter} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
AdminLacunasView.displayName = "AdminLacunasView";
