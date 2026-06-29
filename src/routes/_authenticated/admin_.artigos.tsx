import { createFileRoute } from "@tanstack/react-router";
import { ensureAdminBeforeLoad } from "@/lib/admin-guard";
import { AdminArtigosContainer } from "@/containers/AdminArtigosContainer";

export const Route = createFileRoute("/_authenticated/admin_/artigos")({
  beforeLoad: ensureAdminBeforeLoad,
  component: AdminArtigosContainer,
  head: () => ({ meta: [{ title: "Artigos — Admin" }] }),
});
