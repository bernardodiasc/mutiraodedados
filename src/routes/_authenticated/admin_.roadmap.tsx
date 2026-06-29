import { createFileRoute } from "@tanstack/react-router";
import { ensureAdminBeforeLoad } from "@/lib/admin-guard";
import { AdminRoadmapContainer } from "@/containers/AdminRoadmapContainer";

export const Route = createFileRoute("/_authenticated/admin_/roadmap")({
  beforeLoad: ensureAdminBeforeLoad,
  component: AdminRoadmapContainer,
  head: () => ({ meta: [{ title: "Roadmap — Admin" }] }),
});