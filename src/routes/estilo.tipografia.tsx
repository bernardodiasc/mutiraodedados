import { createFileRoute } from "@tanstack/react-router";
import { TipografiaSection } from "@/components/style-guide/TipografiaSection";

export const Route = createFileRoute("/estilo/tipografia")({
  component: () => (
    <>
      <header>
        <h1 className="font-display text-3xl">Tipografia</h1>
      </header>
      <TipografiaSection />
    </>
  ),
});