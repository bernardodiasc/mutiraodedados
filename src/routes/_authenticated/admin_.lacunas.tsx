import { createFileRoute } from "@tanstack/react-router";
import { ensureAdminBeforeLoad } from "@/lib/admin-guard";
import { AdminLacunasContainer } from "@/containers/AdminLacunasContainer";

export const Route = createFileRoute("/_authenticated/admin_/lacunas")({
  beforeLoad: ensureAdminBeforeLoad,
  component: AdminLacunasContainer,
  head: () => ({ meta: [{ title: "Lacunas — Admin" }] }),
});
