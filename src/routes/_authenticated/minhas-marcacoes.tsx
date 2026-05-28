import { createFileRoute, Link } from "@tanstack/react-router";
import * as React from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  statusMarcacoesUsuario,
  type MarcacaoStatus,
} from "@/lib/data/marcacoes.functions";

export const Route = createFileRoute("/_authenticated/minhas-marcacoes")({
  component: MinhasMarcacoes,
  head: () => ({ meta: [{ title: "Minhas marcações — Auditoria Cidadã" }]}),
});

type Flag = { id: string; entidade_tipo: string; entidade_id: string; tipo: string; comentario: string | null; created_at: string };

const STATUS_LABEL: Record<string, { txt: string; cls: string }> = {
  aberto: { txt: "em análise", cls: "bg-muted text-muted-foreground" },
  confirmado: { txt: "confirmado", cls: "bg-destructive/10 text-destructive border border-destructive/30" },
  reportado: { txt: "reportado ao órgão", cls: "bg-accent/15 text-accent border border-accent/30" },
  corrigido_origem: { txt: "corrigido na origem", cls: "bg-emerald-500/10 text-emerald-600 border border-emerald-500/30" },
  falso_positivo: { txt: "falso positivo", cls: "bg-muted text-muted-foreground" },
  wontfix: { txt: "arquivado", cls: "bg-muted text-muted-foreground" },
};

function MinhasMarcacoes() {
  const { user } = useAuth();
  const [flags, setFlags] = React.useState<Flag[]>([]);
  const [loading, setLoading] = React.useState(true);
  const fetchStatus = useServerFn(statusMarcacoesUsuario);
  const { data: statusMap = {} } = useQuery({
    queryKey: ["minhas-marcacoes-status", user?.id],
    queryFn: () => fetchStatus(),
    enabled: !!user,
  });

  React.useEffect(() => {
    if (!user) return;
    supabase.from("user_flags").select("*").eq("user_id", user.id).order("created_at", { ascending: false })
      .then(({ data }) => { setFlags((data as Flag[]) ?? []); setLoading(false); });
  }, [user]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-4xl">Minhas marcações</h1>
      <p className="text-muted-foreground mt-2">
        Tudo que você marcou no app, com o status da revisão pela curadoria.
      </p>

      <div className="mt-8 space-y-3">
        {loading ? <p className="text-sm text-muted-foreground">Carregando…</p> :
         flags.length === 0 ? <p className="text-sm text-muted-foreground">Você ainda não marcou nada. Abra uma ficha de órgão, fornecedor ou contrato e use o painel "Marcações cidadãs".</p> :
         flags.map(f => {
           const href = f.entidade_tipo === "orgao" ? `/orgaos/${f.entidade_id}` :
                       f.entidade_tipo === "fornecedor" ? `/fornecedores/${f.entidade_id}` :
                       `/contratos/${f.entidade_id}`;
           const key = `${f.entidade_tipo}|${f.entidade_id}|marcacao_${f.tipo}`;
           const st: MarcacaoStatus | undefined = (statusMap as Record<string, MarcacaoStatus>)[key];
           const label = st ? STATUS_LABEL[st.status] : null;
           return (
             <Link key={f.id} to={href} className="block border border-border rounded-xl p-4 bg-card hover:border-accent">
               <div className="flex items-center justify-between gap-2 flex-wrap">
                 <div className="text-xs font-semibold uppercase tracking-wider text-accent">{f.tipo} · {f.entidade_tipo}</div>
                 {label && (
                   <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${label.cls}`}>
                     {label.txt}
                   </span>
                 )}
               </div>
               {f.comentario && <p className="text-sm mt-1">{f.comentario}</p>}
               <div className="text-xs text-muted-foreground mt-1">{new Date(f.created_at).toLocaleString("pt-BR")}</div>
               {st?.reportado_em && (
                 <div className="text-[11px] text-muted-foreground mt-0.5">
                   reportado em {new Date(st.reportado_em).toLocaleString("pt-BR")}
                   {st.reporte_canal ? ` · canal: ${st.reporte_canal}` : ""}
                 </div>
               )}
             </Link>
           );
         })}
      </div>
    </div>
  );
}
