import { createFileRoute } from "@tanstack/react-router";
import { AdminPromptsContainer } from "@/containers/AdminPromptsContainer";
import { ensureAdminBeforeLoad } from "@/lib/admin-guard";

export const Route = createFileRoute("/_authenticated/admin_/prompts")({
  beforeLoad: ensureAdminBeforeLoad,
  component: AdminPromptsContainer,
  head: () => ({ meta: [{ title: "Prompts — Admin" }] }),
});
