import { createFileRoute, Link } from "@tanstack/react-router";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { ensureAdminBeforeLoad } from "@/lib/admin-guard";
import { AdminNav, ADMIN_SECTIONS } from "@/components/AdminNav";
import { Shield, Lock } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listarRoadmap } from "@/lib/data/roadmap.functions";
import { listarArtigos } from "@/lib/data/artigos.functions";
import { statusFontes } from "@/lib/data/status.functions";
import { listarTodosModelos } from "@/lib/pergunta-modelos.functions";
import { listarPerguntasEmRevisao } from "@/lib/perguntas.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: ensureAdminBeforeLoad,
  component: AdminPage,
  head: () => ({ meta: [{ title: "Admin — Mutirão de Dados" }] }),
});

function AdminPage() {
  const { isAdmin, loading } = useIsAdmin();
  const fetchRoadmap = useServerFn(listarRoadmap);
  const fetchArtigos = useServerFn(listarArtigos);
  const fetchStatus = useServerFn(statusFontes);
  const fetchModelos = useServerFn(listarTodosModelos);
  const fetchRevisao = useServerFn(listarPerguntasEmRevisao);

  const { data: roadmap } = useQuery({
    queryKey: ["admin-roadmap-summary"],
    queryFn: () => fetchRoadmap(),
    enabled: isAdmin,
  });
  const { data: artigos } = useQuery({
    queryKey: ["admin-artigos-summary"],
    queryFn: () => fetchArtigos(),
    enabled: isAdmin,
  });
  const { data: status } = useQuery({
    queryKey: ["admin-dados-summary"],
    queryFn: () => fetchStatus(),
    enabled: isAdmin,
  });
  const { data: modelos } = useQuery({
    queryKey: ["admin-modelos-summary"],
    queryFn: () => fetchModelos(),
    enabled: isAdmin,
  });
  const { data: revisao } = useQuery({
    queryKey: ["admin-perguntas-revisao-summary"],
    queryFn: () => fetchRevisao(),
    enabled: isAdmin,
  });

  if (loading) return <div className="p-10 text-muted-foreground">Verificando permissões…</div>;
  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <Lock className="size-10 mx-auto text-muted-foreground" />
        <h1 className="font-display text-3xl mt-4">Acesso restrito</h1>
        <p className="text-muted-foreground mt-2">Esta página é apenas para administradores.</p>
      </div>
    );
  }

  const items = roadmap ?? [];
  const porStatus = {
    planejado: items.filter((i) => i.status === "planejado").length,
    em_andamento: items.filter((i) => i.status === "em_andamento").length,
    concluido: items.filter((i) => i.status === "concluido").length,
  };

  const artigosItems = artigos ?? [];
  const porCategoria = {
    mapa: artigosItems.filter((a) => a.categoria === "mapa").length,
    tutorial: artigosItems.filter((a) => a.categoria === "tutorial").length,
    nota: artigosItems.filter((a) => a.categoria === "nota").length,
  };

  // Resumo de Dados: foco em frescor das fontes, não em volume bruto.
  const fontes = status
    ? [
        { nome: "PNCP", ...status.pncp },
        { nome: "Siconfi", ...status.siconfi },
        { nome: "Transferegov", ...status.transferegov },
        { nome: "Câmara", ...status.camara },
        { nome: "Senado", ...status.senado },
        ...Object.entries(status.contratosPorOrgao).map(([orgao, s]) => ({
          nome: `Contratos ${orgao}`,
          ...s,
        })),
      ]
    : [];
  const fontesComDados = fontes.filter((f) => f.count > 0 && f.updatedAt);
  const maisRecente = fontesComDados.reduce<{ nome: string; updatedAt: string } | null>(
    (acc, f) =>
      !acc || (f.updatedAt && f.updatedAt > acc.updatedAt)
        ? { nome: f.nome, updatedAt: f.updatedAt! }
        : acc,
    null,
  );
  const agora = Date.now();
  const diasDesde = (iso: string) => Math.floor((agora - new Date(iso).getTime()) / 86_400_000);
  const fontesAtualizadas30d = fontesComDados.filter((f) => diasDesde(f.updatedAt!) <= 30).length;
  const formatRelativo = (iso: string) => {
    const d = diasDesde(iso);
    if (d <= 0) return "hoje";
    if (d === 1) return "ontem";
    if (d < 30) return `há ${d} dias`;
    const m = Math.floor(d / 30);
    return m === 1 ? "há 1 mês" : `há ${m} meses`;
  };

  const counts: Record<string, string> = {
    "/admin/roadmap":
      items.length > 0
        ? `${porStatus.em_andamento} em andamento · ${porStatus.planejado} planejados · ${porStatus.concluido} concluídos`
        : "Sem itens ainda",
    "/admin/artigos":
      artigosItems.length > 0
        ? `${porCategoria.mapa} mapas · ${porCategoria.tutorial} tutoriais · ${porCategoria.nota} notas`
        : "Sem artigos ainda",
    "/admin/dados":
      status && maisRecente
        ? `Última atualização ${formatRelativo(maisRecente.updatedAt)} (${maisRecente.nome}) · ${fontesAtualizadas30d}/${fontesComDados.length} fontes atualizadas em 30 dias`
        : status
          ? "Nenhuma fonte sincronizada ainda"
          : "Sem dados ainda",
    "/admin/perguntas":
      modelos || revisao
        ? `${(modelos ?? []).filter((m) => m.ativo).length} modelos ativos · ${(revisao ?? []).length} aguardando revisão`
        : "Sem dados ainda",
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 space-y-8">
      <header className="flex items-baseline gap-3">
        <Shield className="size-6 text-accent" />
        <div>
          <h1 className="font-display text-4xl">Painel do administrador</h1>
          <p className="text-muted-foreground mt-1 max-w-3xl text-sm">
            Ingestão de dados, governança, roadmap e conteúdo editorial da plataforma. Tudo o que é
            salvo aqui fica disponível para consulta pública.
          </p>
        </div>
      </header>

      <AdminNav />

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {ADMIN_SECTIONS.map((s) => {
          const Icon = s.icon;
          return (
            <Link
              key={s.to}
              to={s.to}
              className="group rounded-xl border border-border bg-card p-5 hover:border-accent/60 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Icon className="size-4 text-accent" />
                <h2 className="font-display text-lg">{s.label}</h2>
                {s.status === "em_breve" && (
                  <span className="ml-auto text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                    em breve
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-2">{s.description}</p>
              {counts[s.to] && <p className="text-xs text-foreground/80 mt-3">{counts[s.to]}</p>}
            </Link>
          );
        })}
      </section>
    </div>
  );
}
