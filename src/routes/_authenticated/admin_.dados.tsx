import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { ensureAdminBeforeLoad } from "@/lib/admin-guard";
import { AdminImportPanel } from "@/components/AdminImportPanel";
import { AdminNav } from "@/components/AdminNav";

export const Route = createFileRoute("/_authenticated/admin_/dados")({
  beforeLoad: ensureAdminBeforeLoad,
  component: DadosPage,
  head: () => ({ meta: [{ title: "Dados — Admin" }] }),
});

function DadosPage() {
  const { isAdmin, loading } = useIsAdmin();
  if (loading) return <div className="p-10 text-muted-foreground">Verificando permissões…</div>;
  if (!isAdmin) return null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 space-y-6">
      <Link to="/admin" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
        <ArrowLeft className="size-3.5" /> voltar ao painel
      </Link>
      <header>
        <h1 className="font-display text-4xl">Dados</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
          Ingestão multi-fonte, cobertura por período, governança LGPD e manutenção do banco.
        </p>
      </header>
      <AdminNav />
      <AdminImportPanel />
    </div>
  );
}