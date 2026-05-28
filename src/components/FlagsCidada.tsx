import * as React from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ThumbsDown, ThumbsUp, Flag } from "lucide-react";

type FlagRow = {
  id: string;
  user_id: string;
  entidade_tipo: string;
  entidade_id: string;
  tipo: string;
  comentario: string | null;
  created_at: string;
  displayName?: string | null;
};

const TIPOS = [
  { v: "suspeita", label: "Suspeita" },
  { v: "confirmar", label: "Confirmar regular" },
  { v: "contexto", label: "Adicionar contexto" },
] as const;

export function FlagsCidada({ entidadeTipo, entidadeId }: { entidadeTipo: "orgao"|"fornecedor"|"contrato"; entidadeId: string }) {
  const { user } = useAuth();
  const [flags, setFlags] = React.useState<FlagRow[]>([]);
  const [votes, setVotes] = React.useState<Record<string, number>>({});
  const [loading, setLoading] = React.useState(true);
  const [comentario, setComentario] = React.useState("");
  const [tipo, setTipo] = React.useState<string>("suspeita");

  const load = React.useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("user_flags")
      .select("*")
      .eq("entidade_tipo", entidadeTipo)
      .eq("entidade_id", entidadeId)
      .order("created_at", { ascending: false });
    if (error) { toast.error("Não consegui carregar marcações"); setLoading(false); return; }
    const rows = (data ?? []) as FlagRow[];
    if (rows.length) {
      const userIds = [...new Set(rows.map(r => r.user_id))];
      const { data: profs } = await supabase.from("profiles").select("id,display_name").in("id", userIds);
      const nameMap = new Map((profs ?? []).map(p => [p.id, p.display_name]));
      for (const r of rows) r.displayName = nameMap.get(r.user_id) ?? null;
      const ids = rows.map(d => d.id);
      const { data: vs } = await supabase.from("votos_flag").select("flag_id,valor").in("flag_id", ids);
      const agg: Record<string, number> = {};
      for (const v of vs ?? []) agg[v.flag_id] = (agg[v.flag_id] ?? 0) + v.valor;
      setVotes(agg);
    }
    setFlags(rows);
    setLoading(false);
  }, [entidadeTipo, entidadeId]);

  React.useEffect(() => { load(); }, [load]);

  async function submit() {
    if (!user) return;
    if (!comentario.trim() && tipo !== "confirmar") {
      toast.error("Escreva um comentário"); return;
    }
    const { error } = await supabase.from("user_flags").insert({
      user_id: user.id, entidade_tipo: entidadeTipo, entidade_id: entidadeId,
      tipo, comentario: comentario.trim() || null,
    });
    if (error) { toast.error(error.message); return; }
    setComentario(""); toast.success("Marcação enviada"); load();
  }

  async function vote(flagId: string, valor: 1 | -1) {
    if (!user) return;
    const { error } = await supabase.from("votos_flag").upsert({
      flag_id: flagId, user_id: user.id, valor,
    });
    if (error) { toast.error(error.message); return; }
    load();
  }

  return (
    <div className="border border-border rounded-xl p-5 bg-card">
      {!user ? (
        <div className="text-sm text-muted-foreground">
          <Link to="/login" className="text-accent font-semibold">Entre</Link> para marcar suspeitas, confirmar regularidade ou adicionar contexto a esta entidade.
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {TIPOS.map(t => (
              <button
                key={t.v}
                onClick={() => setTipo(t.v)}
                className={`text-xs px-3 py-1.5 rounded-full border ${tipo === t.v ? "bg-accent text-accent-foreground border-accent" : "border-border hover:bg-muted"}`}
              >{t.label}</button>
            ))}
          </div>
          <Textarea value={comentario} onChange={e=>setComentario(e.target.value)} placeholder="Conte o que viu, por que importa, links se houver…" rows={3} />
          <Button onClick={submit} size="sm"><Flag className="size-3.5 mr-1" /> Enviar marcação</Button>
        </div>
      )}

      <div className="mt-5 space-y-3">
        {loading ? <div className="text-sm text-muted-foreground">Carregando…</div> :
          flags.length === 0 ? <div className="text-sm text-muted-foreground">Nenhuma marcação ainda.</div> :
          flags.map(f => (
            <div key={f.id} className="border-t border-border pt-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-accent">{f.tipo}</div>
                <div className="text-xs text-muted-foreground">{f.displayName ?? "anônimo"} · {new Date(f.created_at).toLocaleDateString("pt-BR")}</div>
              </div>
              {f.comentario && <p className="text-sm mt-1">{f.comentario}</p>}
              <div className="flex items-center gap-1 mt-2">
                <button disabled={!user} onClick={()=>vote(f.id, 1)} className="text-xs px-2 py-1 rounded hover:bg-muted disabled:opacity-40 inline-flex items-center gap-1">
                  <ThumbsUp className="size-3" />
                </button>
                <button disabled={!user} onClick={()=>vote(f.id, -1)} className="text-xs px-2 py-1 rounded hover:bg-muted disabled:opacity-40 inline-flex items-center gap-1">
                  <ThumbsDown className="size-3" />
                </button>
                <span className="text-xs text-muted-foreground ml-1">{votes[f.id] ?? 0}</span>
              </div>
            </div>
          ))
        }
      </div>
    </div>
  );
}
