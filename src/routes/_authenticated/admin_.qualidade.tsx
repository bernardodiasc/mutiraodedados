import { createFileRoute } from "@tanstack/react-router";
import { ensureAdminBeforeLoad } from "@/lib/admin-guard";
import { AdminQualidadeContainer } from "@/containers/AdminQualidadeContainer";

export const Route = createFileRoute("/_authenticated/admin_/qualidade")({
  beforeLoad: ensureAdminBeforeLoad,
  component: AdminQualidadeContainer,
  head: () => ({ meta: [{ title: "Qualidade dos dados — Admin" }] }),
});
