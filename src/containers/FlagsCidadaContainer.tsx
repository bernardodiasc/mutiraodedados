import * as React from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { aggregateVotes, validateSubmit } from "@/lib/flags-cidada/logic";
import { FlagsCidadaView, type FlagRow } from "@/components/FlagsCidadaView";

export type FlagsCidadaContainerProps = {
  entidadeTipo: "orgao" | "fornecedor" | "contrato";
  entidadeId: string;
};

export function FlagsCidadaContainer({ entidadeTipo, entidadeId }: FlagsCidadaContainerProps) {
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
    if (error) {
      toast.error("Não consegui carregar marcações");
      setLoading(false);
      return;
    }
    const rows = (data ?? []) as FlagRow[];
    if (rows.length) {
      const userIds = [...new Set(rows.map((r) => r.user_id))];
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,display_name")
        .in("id", userIds);
      const nameMap = new Map((profs ?? []).map((p) => [p.id, p.display_name]));
      for (const r of rows) r.displayName = nameMap.get(r.user_id) ?? null;
      const ids = rows.map((d) => d.id);
      const { data: vs } = await supabase
        .from("votos_flag")
        .select("flag_id,valor")
        .in("flag_id", ids);
      setVotes(aggregateVotes((vs ?? []) as Array<{ flag_id: string; valor: number }>));
    }
    setFlags(rows);
    setLoading(false);
  }, [entidadeTipo, entidadeId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const onSubmit = React.useCallback(async () => {
    if (!user) return;
    const v = validateSubmit(tipo, comentario);
    if (!v.ok) {
      toast.error(v.erro);
      return;
    }
    const { error } = await supabase.from("user_flags").insert({
      user_id: user.id,
      entidade_tipo: entidadeTipo,
      entidade_id: entidadeId,
      tipo,
      comentario: comentario.trim() || null,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setComentario("");
    toast.success("Marcação enviada");
    void load();
  }, [user, tipo, comentario, entidadeTipo, entidadeId, load]);

  const onVote = React.useCallback(
    async (flagId: string, valor: 1 | -1) => {
      if (!user) return;
      const { error } = await supabase.from("votos_flag").upsert({
        flag_id: flagId,
        user_id: user.id,
        valor,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      void load();
    },
    [user, load],
  );

  return (
    <FlagsCidadaView
      hasUser={!!user}
      loading={loading}
      flags={flags}
      votes={votes}
      tipo={tipo}
      onTipoChange={setTipo}
      comentario={comentario}
      onComentarioChange={setComentario}
      onSubmit={onSubmit}
      onVote={onVote}
    />
  );
}

FlagsCidadaContainer.displayName = "FlagsCidadaContainer";
