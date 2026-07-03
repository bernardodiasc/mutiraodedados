import { createFileRoute } from "@tanstack/react-router";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { ensureAdminBeforeLoad } from "@/lib/admin-guard";
import { AdminImportPanel } from "@/components/AdminImportPanel";
import { AdminHeader } from "@/components/AdminHeader";

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
    <div className="mx-auto max-w-7xl px-4 py-10 space-y-8">
      <AdminHeader titulo="Dados">
        Ingestão multi-fonte, cobertura por período, governança LGPD e manutenção do banco.
      </AdminHeader>
      <AdminImportPanel />
    </div>
  );
}
