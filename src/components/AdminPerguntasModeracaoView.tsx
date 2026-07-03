import * as React from "react";
import { Link } from "@tanstack/react-router";
import { Check, Loader2, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export type PerguntaEmRevisao = {
  id: string;
  titulo: string;
  descricao: string | null;
  contexto: string | null;
  solicitada_publicacao_em: string | null;
};

export type AdminPerguntasModeracaoViewProps = {
  isLoading: boolean;
  perguntas: PerguntaEmRevisao[];
  onAprovar: (id: string) => void;
  onRejeitar: (id: string, motivo: string) => void;
};

export function AdminPerguntasModeracaoView({
  isLoading,
  perguntas,
  onAprovar,
  onRejeitar,
}: AdminPerguntasModeracaoViewProps) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">
        Perguntas aguardando revisão para virar investigação pública. O autor nunca é exposto no
        site público — você o vê aqui apenas para contexto.
      </p>
      {isLoading ? (
        <div className="mt-4 text-muted-foreground flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" /> Carregando…
        </div>
      ) : perguntas.length === 0 ? (
        <div className="mt-4 border border-dashed border-border rounded-xl p-5 bg-card text-sm text-muted-foreground">
          Nada pendente.
        </div>
      ) : (
        <ul className="mt-4 grid gap-3">
          {perguntas.map((p) => (
            <ItemRevisao
              key={p.id}
              pergunta={p}
              onAprovar={() => onAprovar(p.id)}
              onRejeitar={(motivo) => onRejeitar(p.id, motivo)}
            />
          ))}
        </ul>
      )}
      <div className="mt-10 text-xs text-muted-foreground">
        Para editar ou despublicar perguntas já publicadas, use a aba <strong>Publicadas</strong>.
      </div>
    </div>
  );
}

AdminPerguntasModeracaoView.displayName = "AdminPerguntasModeracaoView";

function ItemRevisao({
  pergunta,
  onAprovar,
  onRejeitar,
}: {
  pergunta: PerguntaEmRevisao;
  onAprovar: () => void;
  onRejeitar: (motivo: string) => void;
}) {
  const [motivo, setMotivo] = React.useState("");
  const [mostrarMotivo, setMostrarMotivo] = React.useState(false);
  return (
    <li className="border border-border rounded-xl p-5 bg-card">
      <h3 className="font-display text-lg">{pergunta.titulo}</h3>
      {pergunta.descricao && (
        <p className="text-sm text-muted-foreground mt-1">{pergunta.descricao}</p>
      )}
      {pergunta.contexto && <p className="text-sm mt-2 whitespace-pre-wrap">{pergunta.contexto}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={onAprovar}>
          <Check className="size-3.5 mr-1" /> Aprovar e publicar
        </Button>
        <Button size="sm" variant="outline" onClick={() => setMostrarMotivo((v) => !v)}>
          <X className="size-3.5 mr-1" /> Rejeitar
        </Button>
        <Link
          to="/caderno/$id"
          params={{ id: pergunta.id }}
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 px-2 py-1.5"
        >
          <Pencil className="size-3.5" /> Abrir
        </Link>
      </div>
      {mostrarMotivo && (
        <div className="mt-3 space-y-2">
          <Textarea
            rows={2}
            placeholder="Motivo da rejeição (será mostrado ao autor)"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
          <Button
            size="sm"
            variant="destructive"
            onClick={() => {
              if (motivo.trim().length >= 5) onRejeitar(motivo.trim());
            }}
          >
            Confirmar rejeição
          </Button>
        </div>
      )}
    </li>
  );
}
