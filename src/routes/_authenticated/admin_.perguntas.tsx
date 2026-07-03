import { createFileRoute } from "@tanstack/react-router";
import { AdminPerguntasContainer } from "@/containers/AdminPerguntasContainer";
import { ensureAdminBeforeLoad } from "@/lib/admin-guard";

export const Route = createFileRoute("/_authenticated/admin_/perguntas")({
  beforeLoad: ensureAdminBeforeLoad,
  component: AdminPerguntasContainer,
  head: () => ({ meta: [{ title: "Perguntas — Admin" }] }),
});
