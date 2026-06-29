import { createFileRoute } from "@tanstack/react-router";
import { ensureAdminBeforeLoad } from "@/lib/admin-guard";
import { AdminMarcacoesContainer } from "@/containers/AdminMarcacoesContainer";

export const Route = createFileRoute("/_authenticated/admin_/marcacoes")({
  beforeLoad: ensureAdminBeforeLoad,
  component: AdminMarcacoesContainer,
  head: () => ({ meta: [{ title: "Marcações — Admin" }] }),
});
