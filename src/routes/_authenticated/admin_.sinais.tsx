import { createFileRoute } from "@tanstack/react-router";
import { ensureAdminBeforeLoad } from "@/lib/admin-guard";
import AdminSinaisContainer from "@/containers/AdminSinaisContainer";

export const Route = createFileRoute("/_authenticated/admin_/sinais")({
  beforeLoad: ensureAdminBeforeLoad,
  component: AdminSinaisContainer,
  head: () => ({ meta: [{ title: "Sinais — Admin" }] }),
});
