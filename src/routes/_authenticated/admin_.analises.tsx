import { createFileRoute } from "@tanstack/react-router";
import { ensureAdminBeforeLoad } from "@/lib/admin-guard";
import { AdminEmBreve } from "@/components/AdminEmBreve";

export const Route = createFileRoute("/_authenticated/admin_/analises")({
  beforeLoad: ensureAdminBeforeLoad,
  component: () => (
    <AdminEmBreve
      titulo="Análises"
      descricao="Cruzamentos e relatórios prontos para a equipe de auditoria."
    />
  ),
  head: () => ({ meta: [{ title: "Análises — Admin" }] }),
});
